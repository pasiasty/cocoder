import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { interval, Observable, Subject } from 'rxjs';
import { filter, map, retry, sample, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { Selection } from 'src/app/common';
import { ToastService } from './toast.service';

const SILENCE_AFTER_EDITING = 1500
const PING_FREQUENCY = 1000
const PONG_THRESHOLD = 3000
const WEBSOCKET_RECONNECT_FREQUENCY = 6000
const LANGUAGE_SETTING_TIME_HORIZON = 500

export type User = {
  Index: number
  ID: string
  Position: number
  HasSelection: boolean
  SelectionStart: number
  SelectionEnd: number
}

type EditRequest = {
  BaseText?: string
  CursorPos?: number
  HasSelection?: boolean
  SelectionStart?: number
  SelectionEnd?: number
  UserID?: string
} | EditResponse;

export type EditResponse = {
  Ping: boolean
  NewText?: string
  Language?: string
  Users?: User[]

  UpdateInputText?: boolean
  InputText?: string

  UpdateOutputText?: boolean
  Stdout?: string
  Stderr?: string

  UpdateRunningState?: boolean
  Running?: boolean
}

export type GetSessionResponse = {
  Text: string
  Language: string
  InputText: string
  Stdout: string
  Stderr: string
}

export type ExecutionResponse = {
  ErrorMessage: string
  Stdout: string
  Stderr: string
}

export type FormatResponse = {
  Code: string
}

@Injectable({
  providedIn: 'root'
})
export class ApiService implements OnDestroy {

  wsSubject?: WebSocketSubject<EditRequest>;
  incomingSubject: Subject<EditResponse>;

  lastLanguageUpdateTimestamp!: number;
  lastUpdateTimestamp: number;
  selectedLanguage!: string;
  sessionID!: string;
  userID: string;

  lastPongTimestamp: number;
  lastReconnectTimestamp: number;

  constructor(
    private httpClient: HttpClient,
    private toastService: ToastService,
  ) {
    const userID = localStorage.getItem('user_id');
    if (userID !== null) {
      this.userID = userID;
    } else {
      this.userID = uuidv4();
      localStorage.setItem('user_id', this.userID);
    }
    this.lastUpdateTimestamp = 0;

    this.incomingSubject = new Subject<EditResponse>();
    this.lastPongTimestamp = Date.now();
    this.lastReconnectTimestamp = Date.now();
  }

  ngOnDestroy() {
    this.wsSubject?.unsubscribe();
  }

  updateLanguage(language: string): void {
    this.lastLanguageUpdateTimestamp = Date.now();
    this.selectedLanguage = language;
  }

  connectWebsocket() {
    if (this.wsSubject !== undefined) {
      this.wsSubject.unsubscribe();
      this.wsSubject.complete();
    }

    this.wsSubject = webSocket<EditRequest>({
      url: this.WsUri() + this.sessionID + "/" + this.userID + "/session_ws",
    });

    this.wsSubject.pipe(
      map(data => data as EditResponse),
      tap(data => {
        if (data.Ping) {
          this.lastPongTimestamp = Date.now();
        }
      }),
      filter(data => !data.Ping),
      sample(interval(100).pipe(filter(() => (Date.now() - this.lastUpdateTimestamp) > SILENCE_AFTER_EDITING))),
    ).subscribe(data => {
      this.incomingSubject.next(data);
    });
  }

  openLSPWebsocket(path: string, onOpenHandler: ((ws: WebSocket) => void)) {
    const url = `${this.WsUri()}lsp/${this.userID}/${path}`;
    const webSocket = new WebSocket(url);

    webSocket.onopen = () => {
      onOpenHandler(webSocket);
    };
    webSocket.onclose = () => {
      console.log(`Reconnecting LSP websocket for '${path}'`);
      this.openLSPWebsocket(path, onOpenHandler);
    }
  }

  StartSession(sessionID: string) {
    this.sessionID = sessionID;
    this.connectWebsocket();

    this.lastPongTimestamp = Date.now();
    this.lastReconnectTimestamp = Date.now();

    interval(PING_FREQUENCY).subscribe(_ => {
      this.wsSubject?.next({
        Ping: true,
      });
      const now = Date.now();
      if (now - this.lastPongTimestamp > PONG_THRESHOLD &&
        now - this.lastReconnectTimestamp > WEBSOCKET_RECONNECT_FREQUENCY) {
        console.log('Reconnecting the session websocket');
        this.toastService.show('', 'Lost connection to the server. Reconnecting...', 5000);
        try {
          this.connectWebsocket();
        } catch (err: any) {
          console.log('Failed to connect:', err);
        }

        this.lastReconnectTimestamp = now;
      }
    });
  }

  GetUserID(): string {
    return this.userID;
  }

  WsUri(): string {
    if (environment.apiWs.startsWith('ws://')) {
      return environment.apiWs;
    }
    return window.location.origin.replace('http', 'ws') + environment.apiWs;
  }

  SessionObservable(): Observable<EditResponse> {
    return this.incomingSubject;
  }

  UpdateSession(baseText: string, newText: string, cursorPos: number, otherUsers: User[], selection?: Selection) {
    if (baseText !== newText)
      this.lastUpdateTimestamp = Date.now();
    let language = '';

    if (Date.now() - this.lastLanguageUpdateTimestamp < LANGUAGE_SETTING_TIME_HORIZON) {
      language = this.selectedLanguage;
    }

    const req: EditRequest = {
      Ping: false,
      BaseText: baseText,
      NewText: newText,
      CursorPos: cursorPos,
      HasSelection: selection !== undefined,
      SelectionStart: selection !== undefined ? selection.start : 0,
      SelectionEnd: selection !== undefined ? selection.end : 0,
      UserID: this.userID,
      Language: language,
      Users: otherUsers,
    }

    this.wsSubject?.next(req);
  }

  UpdateInputText(text: string) {
    this.lastUpdateTimestamp = Date.now();
    const req: EditRequest = {
      Ping: false,
      UserID: this.userID,
      UpdateInputText: true,
      InputText: text,
    };

    this.wsSubject?.next(req);
  }

  CompleteExecution(stdout: string, stderr: string) {
    const req: EditRequest = {
      Ping: false,
      UserID: this.userID,
      UpdateOutputText: true,
      Stdout: stdout,
      Stderr: stderr,
      UpdateRunningState: true,
      Running: false,
    };

    this.wsSubject?.next(req);
  }

  TriggerExecution() {
    const req: EditRequest = {
      Ping: false,
      UserID: this.userID,
      UpdateOutputText: true,
      Stdout: '',
      Stderr: '',
      UpdateRunningState: true,
      Running: true,
    };

    this.wsSubject?.next(req);
  }

  GetSession(): Promise<GetSessionResponse> {
    return this.httpClient.get<GetSessionResponse>(environment.api + this.sessionID).pipe(
      retry(2),
      tap(data => this.selectedLanguage = data.Language),
    ).toPromise();
  }

  NewSession(): Promise<string> {
    return this.httpClient.get<string>(environment.api + 'new_session').pipe(
      retry(3)
    ).toPromise();
  }

  ExecuteCode(code: string, stdin: string): Promise<ExecutionResponse> {
    const formData = new FormData();
    formData.set('code', code);
    formData.set('stdin', stdin);
    return this.httpClient.post<ExecutionResponse>(`${environment.api}execute/${this.sessionID}/${this.userID}/${this.selectedLanguage}`, formData).toPromise();
  }

  FormatCode(code: string): Promise<FormatResponse> {
    const formData = new FormData();
    formData.set('code', code);
    return this.httpClient.post<FormatResponse>(`${environment.api}format/${this.userID}/${this.selectedLanguage}`, formData).toPromise();
  }
}
