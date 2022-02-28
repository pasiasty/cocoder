import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { from, interval, Observable, Subscription } from 'rxjs';
import { audit, filter, map, retry, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { EditorControllerService } from './editor-controller.service';
import {Selection } from './common';

export type User = {
  Index: number
  ID: string
  Position: number
  HasSelection: boolean
	SelectionStart: number
	SelectionEnd:number
}

type EditRequest = {
  BaseText: string
  CursorPos: number
  HasSelection: boolean
	SelectionStart: number
	SelectionEnd:number
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
export class ApiService implements OnDestroy {

  subject!: WebSocketSubject<EditRequest>;

  languageChangesSubscription?: Subscription;

  lastLanguageUpdateTimestamp!: number;
  lastUpdateTimestamp: number;
  selectedLanguage!: string;
  sessionID!: string;
  userID: string;

  constructor(
    private httpClient: HttpClient,
    private editorControllerService: EditorControllerService,
  ) {
    const userID = localStorage.getItem('user_id');
    if (userID !== null) {
      this.userID = userID;
    } else {
      this.userID = uuidv4();
      localStorage.setItem('user_id', this.userID);
    }
    this.lastUpdateTimestamp = 0;

    this.languageChangesSubscription = this.editorControllerService.languageChanges().subscribe(val => {
      this.lastLanguageUpdateTimestamp = Date.now();
      this.selectedLanguage = val;
    });
  }

  ngOnDestroy() {
    this.subject.unsubscribe();
    this.languageChangesSubscription?.unsubscribe();
  }

  SetSessionID(sessionID: string) {
    this.sessionID = sessionID;
    this.subject = webSocket<EditRequest>(this.WsUri() + sessionID + "/" + this.userID + "/ws");
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
    return this.subject.pipe(
      retry(),
      map(data => data as EditResponse),
      audit(() => interval(100).pipe(filter(() => (Date.now() - this.lastUpdateTimestamp) > 2000))),
    );
  }

  UpdateSession(baseText: string, newText: string, cursorPos: number, otherUsers: User[], selection?: Selection) {
    this.lastUpdateTimestamp = Date.now();
    let language = '';

    if (Date.now() - this.lastLanguageUpdateTimestamp < 500) {
      language = this.selectedLanguage;
    }

    const req: EditRequest = {
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

    this.subject.next(req);
  }

  GetSession(): Promise<GetSessionResponse> {
    return this.httpClient.get<GetSessionResponse>(environment.api + this.sessionID).pipe(
      retry(3),
      tap(data => this.selectedLanguage = data.Language),
    ).toPromise();
  }
}
