import { Injectable } from '@angular/core';
import * as monaco from 'monaco-editor';
import { User } from './api.service';
import { Observable, Subject } from 'rxjs';
import { sampleTime } from 'rxjs/operators';

type DecorationDescription = {
  UserID: string
  Index: number
  Decoration: monaco.editor.IModelDeltaDecoration
};


@Injectable({
  providedIn: 'root'
})
export class EditorService {

  editor?: monaco.editor.IStandaloneCodeEditor;
  language!: string;
  theme: string;
  oldDecorations: string[];
  currentDecorations: DecorationDescription[];
  editsSubject: Subject<void>;
  userID!: string;
  model: monaco.editor.ITextModel;

  constructor() {
    const theme = localStorage.getItem('theme');
    if (theme !== null) {
      this.theme = theme;
    } else {
      this.theme = '';
    }

    this.oldDecorations = [];
    this.currentDecorations = [];
    this.editsSubject = new Subject<void>();

    if (this.theme == '') {
      this.theme = 'vs';
    }

    this.language = 'plaintext';
    this.model = monaco.editor.createModel('', this.language, monaco.Uri.parse(this.language));
  }

  SetEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    const text = this.Text();
    if (this.editor !== undefined) {
      this.editor.dispose();
    }

    this.SetText(text);
    editor.setModel(this.model);

    this.editor = editor;

    this.updateOptions();

    this.editor.onKeyDown(() => {
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
      sampleTime(300),
    )
  }

  createOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
    return {
      theme: this.theme,
    }
  }

  updateOptions() {
    this.editor!.updateOptions({
      cursorBlinking: 'smooth',
      mouseWheelZoom: true,
      showUnused: true,
      theme: this.theme,
      scrollbar: {
        verticalScrollbarSize: 0,
      },
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
    return this.model.getValue(monaco.editor.EndOfLinePreference.CRLF);
  }

  SetText(t: string) {
    this.model.setValue(t);
  }

  Position(): number {
    return this.positionToNumber(this.editor!.getPosition());
  }

  OtherUsers(): User[] {
    const positions = this.oldDecorations.map(d => this.model.getDecorationRange(d)).map(r => {
      if (r === null) {
        return null;
      }
      return this.positionToNumber(new monaco.Position(r.startLineNumber, r.startColumn));
    })
    return this.currentDecorations.map((d, idx): User | null => {
      const p = positions[idx]
      if (p === null) {
        return null;
      }
      return {
        ID: d.UserID,
        Index: d.Index,
        Position: p,
      }
    }).filter(u => u !== null).map(u => u!);
  }

  SetPosition(p: number) {
    this.editor!.setPosition(this.numberToPosition(p));
  }

  SetLanguage(l: string, refresh: boolean = false) {
    if (l === this.language && !refresh) {
      return;
    }

    const text = this.Text();
    this.model.dispose();

    this.language = l;
    this.model = monaco.editor.createModel(text, l, monaco.Uri.parse(l));
    this.editor!.setModel(this.model);

    this.updateOptions();
  }

  SetTheme(t: string) {
    localStorage.setItem('theme', t);
    this.theme = t;
    this.updateOptions();
  }

  Theme(): string {
    return this.theme;
  }

  userToDecoration(u: User): DecorationDescription {
    let userPos = this.numberToPosition(u.Position);
    let colorIdx = u.Index % 5 + 1
    return {
      UserID: u.ID,
      Index: u.Index,
      Decoration: {
        range: new monaco.Range(userPos.lineNumber, userPos.column, userPos.lineNumber, userPos.column + 1),
        options: {
          className: `other-user-cursor-${colorIdx}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }
    }
  }

  updateDecorations() {
    this.oldDecorations = this.editor!.deltaDecorations(this.oldDecorations, this.currentDecorations.map(d => d.Decoration));
  }

  UpdateCursors(users: User[]) {
    this.currentDecorations = users.filter(u => this.userID != u.ID).map(u => this.userToDecoration(u));
    this.updateDecorations();
    for (const u of users) {
      if (u.ID == this.userID && this.Position() != u.Position) {
        this.SetPosition(u.Position);
      }
    }
  }
}
