import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import * as monaco from 'monaco-editor';
import { User } from './api.service';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class EditorService {

  editor!: monaco.editor.IStandaloneCodeEditor;
  language!: string;
  theme!: string;
  oldDecorations: string[];
  currentDescorations: monaco.editor.IModelDeltaDecoration[];
  editsSubject: Subject<void>;
  userID!: string;

  constructor(private cookieService: CookieService) {
    this.theme = this.cookieService.get('theme');
    this.oldDecorations = [];
    this.currentDescorations = [];
    this.editsSubject = new Subject<void>();
  }

  SetEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    if (this.theme == '') {
      this.theme = 'vs';
    }

    this.editor = editor;
    this.language = 'plaintext';

    this.updateOptions();

    this.editor.onKeyDown(() => {
      this.updateDecorations();
      this.editsSubject.next();
    });

    this.editor.onMouseDown(() => {
      this.editsSubject.next();
    });
  }

  SetUserID(userID: string) {
    this.userID = userID;
  }

  editsObservable(): Observable<void> {
    return this.editsSubject.pipe(
      debounceTime(100),
    )
  }

  createOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
    return {
      theme: this.theme,
    }
  }

  updateOptions() {
    this.editor.updateOptions({
      cursorBlinking: 'smooth',
      mouseWheelZoom: true,
      showUnused: true,
      theme: this.theme,
    });
  }

  positionToNumber(p: monaco.Position | null): number {
    let text = this.Text()

    if (p === null) {
      return 0;
    }
    let idx = 0;
    let foundNewlines = 0;
    while (foundNewlines < (p.lineNumber - 1)) {
      if (text[idx] == "\n")
        foundNewlines++;
      idx++;
    }

    return idx + p.column - 1;
  }

  numberToPosition(n: number): monaco.Position {
    let text = this.Text();
    let idx = 0;
    let lineNumber = 1;
    let lastNewline = 0;
    while (idx < n && idx < text.length) {
      if (text[idx] == '\n') {
        lastNewline = idx;
        lineNumber++;
      }

      idx++;
    }

    if (lineNumber > 1)
      lastNewline++;

    return new monaco.Position(lineNumber, n - lastNewline + 1);
  }

  Text(): string {
    return this.editor.getValue();
  }

  SetText(t: string) {
    this.editor.setValue(t);
  }

  Position(): number {
    return this.positionToNumber(this.editor.getPosition());
  }

  SetPosition(p: number) {
    this.editor.setPosition(this.numberToPosition(p));
  }

  SetLanguage(l: string) {
    if (l == this.language)
      return;
    this.language = l;

    const model = monaco.editor.createModel(this.editor!.getValue(), l, monaco.Uri.parse(l));
    this.editor.getModel()?.dispose();
    this.editor.setModel(model);
  }

  SetTheme(t: string) {
    this.cookieService.set('theme', t, undefined, "/");
    this.theme = t;
    this.updateOptions();
  }

  Theme(): string {
    return this.theme;
  }

  userToDecoration(u: User): monaco.editor.IModelDeltaDecoration {
    let userPos = this.numberToPosition(u.Position);
    let colorIdx = u.Index % 5 + 1
    return {
      range: new monaco.Range(userPos.lineNumber, userPos.column, userPos.lineNumber, userPos.column + 1),
      options: {
        className: `other-user-cursor-${colorIdx}`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }
  }

  updateDecorations() {
    this.oldDecorations = this.editor.deltaDecorations(this.oldDecorations, this.currentDescorations);
  }

  UpdateCursors(users: User[]) {
    this.currentDescorations = users.filter(u => this.userID != u.ID).map(u => this.userToDecoration(u));
    this.updateDecorations();
    for (const u of users) {
      if (u.ID == this.userID && this.Position() != u.Position) {
        this.SetPosition(u.Position);
      }
    }
  }
}
