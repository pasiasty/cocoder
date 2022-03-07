import { Injectable, OnDestroy } from '@angular/core';
import * as monaco from 'monaco-editor';
import { User } from './api.service';
import { Observable, Subject, Subscription } from 'rxjs';
import { sampleTime } from 'rxjs/operators';
import { ThemeService } from './theme.service';
import { EditorControllerService } from './editor-controller.service';
import { FileSaverService } from 'ngx-filesaver';
import { Selection } from './common';

type DecorationDescription = {
  UserID: string
  Index: number
  Decoration: monaco.editor.IModelDeltaDecoration
};

@Injectable({
  providedIn: 'root'
})
export class EditorService implements OnDestroy {

  editor?: monaco.editor.IStandaloneCodeEditor;
  language!: string;
  fontSize: number;
  oldDecorations: string[];
  currentDecorations: DecorationDescription[];
  editsSubject: Subject<void>;
  userID!: string;
  model: monaco.editor.ITextModel;

  themeChangesSubscription?: Subscription;
  languageChangesSubscription?: Subscription;

  pastedDisposable?: monaco.IDisposable;
  keyPressedDisposable?: monaco.IDisposable;
  cursorPositionChangeDisposable?: monaco.IDisposable;
  cursorSelectionChangeDisposable?: monaco.IDisposable;

  constructor(
    private themeService: ThemeService,
    private editorControllerService: EditorControllerService,
    private fileSaverService: FileSaverService) {
    monaco.editor.setTheme(themeService.editorThemeName());

    this.oldDecorations = [];
    this.currentDecorations = [];
    this.editsSubject = new Subject<void>();

    this.language = 'plaintext';

    const fontSize = localStorage.getItem('font_size');
    if (fontSize !== null) {
      this.fontSize = parseInt(fontSize);
    } else {
      this.fontSize = 15;
    }
    this.model = monaco.editor.createModel('', this.language, monaco.Uri.parse(this.language));

    this.editorControllerService.saveTriggersObservable().subscribe({
      next: _ => {
        this.fileSaverService.saveText(this.Text(), `code${this.GetLanguageExtension()}`);
      }
    });
  }

  GetLanguageExtension(): string {
    const lep = monaco.languages.getLanguages().find(val => val.id == this.language);
    if (lep === undefined || lep.extensions === undefined || lep.extensions?.length === 0)
      return '.txt';
    return lep.extensions[0];
  }

  DisposeEditorSubscriptions() {
    this.keyPressedDisposable?.dispose();
    this.pastedDisposable?.dispose();
    this.cursorPositionChangeDisposable?.dispose();
    this.cursorSelectionChangeDisposable?.dispose();
  }

  SetEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor?.dispose();
    this.DisposeEditorSubscriptions();
    editor.setModel(this.model);

    this.editor = editor;

    this.updateOptions();

    this.keyPressedDisposable = this.editor.onKeyDown(() => {
      this.editsSubject.next();
    });

    this.pastedDisposable = this.editor.onDidPaste(() => {
      this.editsSubject.next();
    });

    this.cursorPositionChangeDisposable = this.editor.onDidChangeCursorPosition(() => {
      this.editsSubject.next();
    });

    this.cursorSelectionChangeDisposable = this.editor.onDidChangeCursorSelection(() => {
      this.editsSubject.next();
    });

    this.themeChangesSubscription = this.themeService.themeChanges().subscribe(() => {
      this.SetTheme(this.themeService.editorThemeName());
    });

    this.languageChangesSubscription = this.editorControllerService.languageChanges().subscribe(val => {
      this.SetLanguage(val);
    });

    this.editorControllerService.fontUpdates().subscribe(val => {
      this.fontSize += val;
      localStorage.setItem("font_size", this.fontSize.toString());
      this.updateOptions();
    });
  }

  ngOnDestroy() {
    this.themeChangesSubscription?.unsubscribe();
    this.languageChangesSubscription?.unsubscribe();
    this.DisposeEditorSubscriptions();
    this.model?.dispose();
    this.editor?.dispose();
  }

  SetUserID(userID: string) {
    this.userID = userID;
  }

  editsObservable(): Observable<void> {
    return this.editsSubject.pipe(
      sampleTime(50),
    )
  }

  updateOptions() {
    this.editor!.updateOptions({
      cursorBlinking: 'smooth',
      fontSize: this.fontSize,
      showUnused: true,
      scrollbar: {
        verticalScrollbarSize: 0,
      },
      parameterHints: {
        enabled: true,
      }
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

  Selection(): Selection | undefined {
    const editorSelection = this.editor!.getSelection()
    if (editorSelection === null || editorSelection.getStartPosition().equals(editorSelection.getEndPosition())) {
      return;
    }
    const start = this.positionToNumber(editorSelection.getStartPosition());
    const end = this.positionToNumber(editorSelection.getEndPosition());

    return {
      start: start,
      end: end,
    }
  }

  OtherUsers(): User[] {
    return this.currentDecorations.map((d, idx): User | null => {
      const dr = this.model.getDecorationRange(this.oldDecorations[idx]);
      if (dr === null) {
        return null;
      }
      const p = this.positionToNumber(dr.getStartPosition());
      const selStart = p;
      const selEnd = this.positionToNumber(dr.getEndPosition());
      return {
        ID: d.UserID,
        Index: d.Index,
        Position: p,
        HasSelection: selEnd - selStart > 1,
        SelectionStart: selStart,
        SelectionEnd: selEnd,
      }
    }).filter(u => u !== null).map(u => u!);
  }

  SetPosition(p: number) {
    this.editor!.setPosition(this.numberToPosition(p));
  }

  SetLanguage(l: string) {
    this.language = l;
    monaco.editor.setModelLanguage(this.model, l);
  }

  SetTheme(t: string) {
    monaco.editor.setTheme(t);
  }

  userToDecoration(u: User): DecorationDescription {
    const decorationThemeSelector = this.themeService.isDarkThemeEnabled() ? '-dark' : '';
    const colorIdx = u.Index % 5 + 1
    let decoration: monaco.editor.IModelDeltaDecoration
    if (u.HasSelection) {
      const selStart = this.numberToPosition(u.SelectionStart);
      const selEnd = this.numberToPosition(u.SelectionEnd);
      decoration = {
        range: new monaco.Range(selStart.lineNumber, selStart.column, selEnd.lineNumber, selEnd.column),
        options: {
          className: `other-user-selection${decorationThemeSelector}-${colorIdx}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }
    } else {
      let userPos = this.numberToPosition(u.Position);
      decoration = {
        range: new monaco.Range(userPos.lineNumber, userPos.column, userPos.lineNumber, userPos.column + 1),
        options: {
          className: `other-user-cursor${decorationThemeSelector}-${colorIdx}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }
    }
    return {
      UserID: u.ID,
      Index: u.Index,
      Decoration: decoration,
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
