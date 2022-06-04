import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { interval, Observable, of, Subject, Subscription } from 'rxjs';
import { filter, map, retry, sample, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { Selection } from './common';
import { ToastService } from './utils/toast.service';

const SILENCE_AFTER_EDITING = 1000
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
}

export type GetSessionResponse = {
  Text: string
  Language: string
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

  pingSubscription?: Subscription;
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
      url: this.WsUri() + this.sessionID + "/" + this.userID + "/ws",
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

  StartSession(sessionID: string) {
    this.sessionID = sessionID;
    this.connectWebsocket();

    this.pingSubscription = interval(PING_FREQUENCY).subscribe(_ => {
      this.wsSubject?.next({
        Ping: true,
      });
      const now = Date.now();
      if (now - this.lastPongTimestamp > PONG_THRESHOLD &&
        now - this.lastReconnectTimestamp > WEBSOCKET_RECONNECT_FREQUENCY) {
        console.log('Reconnecting the websocket');
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
}
