import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { interval, Observable, pipe } from 'rxjs';
import { audit, filter, map, retry, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { CookieService } from 'ngx-cookie-service';
import { webSocket, WebSocketSubject } from "rxjs/webSocket";

export type User = {
  Index: number
  ID: string
  Position: number
}

type EditRequest = {
  BaseText: string
  CursorPos: number
  UserID: string
} | EditResponse;

export type EditResponse = {
  NewText: string
  Language: string
  Users: User[]
}

export type GetSessionResponse = {
  Text: string
  Language: string
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  subject!: WebSocketSubject<EditRequest>;

  lastLanguageUpdateTimestamp!: number;
  lastUpdateTimestamp: number;
  selectedLanguage!: string;
  sessionID !: string;
  userID: string;

  constructor(
    private httpClient: HttpClient,
    private cookieService: CookieService,
  ) {
    this.userID = this.cookieService.get('user_id');
    if (this.userID == '') {
      this.userID = uuidv4();
      this.cookieService.set('user_id', this.userID, undefined, "/");
    }
    this.lastUpdateTimestamp = 0;
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

  SetSessionID(sessionID: string) {
    this.sessionID = sessionID;
    this.subject = webSocket<EditRequest>(this.WsUri() + sessionID + "/" + this.userID + "/ws");
  }

  SessionObservable(): Observable<EditResponse> {
    return this.subject.pipe(
      retry(),
      map(data => data as EditResponse),
      audit(() => interval(100).pipe(filter(() => (Date.now() - this.lastUpdateTimestamp) > 2000))),
    );
  }

  UpdateSession(baseText: string, newText: string, cursorPos: number) {
    this.lastUpdateTimestamp = Date.now();
    let language = '';

    if (Date.now() - this.lastLanguageUpdateTimestamp < 500) {
      language = this.selectedLanguage;
    }

    const req: EditRequest = {
      BaseText: baseText,
      NewText: newText,
      CursorPos: cursorPos,
      UserID: this.userID,
      Language: language,
    }

    this.subject.next(req);
  }

  GetSession(): Promise<GetSessionResponse> {
    return this.httpClient.get<GetSessionResponse>(environment.api + this.sessionID).pipe(
      retry(3),
      tap(data => this.selectedLanguage = data.Language),
    ).toPromise();
  }

  SetLanguage(language: string) {
    this.lastLanguageUpdateTimestamp = Date.now();
    this.selectedLanguage = language;
  }
}
