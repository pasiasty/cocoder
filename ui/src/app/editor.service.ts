import { Injectable, OnDestroy } from '@angular/core';
import * as monaco from 'monaco-editor';
import { User } from './api.service';
import { Observable, Subject, Subscription } from 'rxjs';
import { sampleTime } from 'rxjs/operators';
import { ThemeService } from './theme.service';
import { EditorControllerService } from './editor-controller.service';
import { FileSaverService } from 'ngx-filesaver';

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
  theme: string;
  oldDecorations: string[];
  currentDecorations: DecorationDescription[];
  editsSubject: Subject<void>;
  userID!: string;
  model: monaco.editor.ITextModel;

  themeChangesSubscription?: Subscription;
  languageChangesSubscription?: Subscription;

  contentChangeDisposable?: monaco.IDisposable;
  cursorPositionChangeDisposable?: monaco.IDisposable;
  cursorSelectionChangeDisposable?: monaco.IDisposable;

  constructor(
    private themeService: ThemeService,
    private editorControllerService: EditorControllerService,
    private fileSaverService: FileSaverService) {
    this.theme = themeService.editorThemeName();

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
        this.fileSaverService.saveText(this.Text(), `code.${this.GetLanguageExtension()}`);
      }
    })
  }

  GetLanguageExtension(): string {
    console.log(this.language);
    switch (this.language) {
      case "python":
        return "py";
      case "java":
        return "java";
      case "go":
        return "go";
      case "cpp":
        return "cpp";
      case "c":
        return "c";
      case "r":
        return "r";
      case "json":
        return "json";
      case "shell":
        return "sh";
      case "yaml":
        return "yaml";
      case "sql":
        return "sql";
      default:
        return "txt";
    }
  }

  DisposeEditorSubscriptions() {
    this.contentChangeDisposable?.dispose();
    this.cursorPositionChangeDisposable?.dispose();
    this.cursorSelectionChangeDisposable?.dispose();
  }

  SetEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor?.dispose();
    this.DisposeEditorSubscriptions();
    this.SetText("");
    editor.setModel(this.model);

    this.editor = editor;

    this.updateOptions();

    this.contentChangeDisposable = this.editor.onDidChangeModelContent(() => {
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
      fontSize: this.fontSize,
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

  SetLanguage(l: string) {
    this.language = l;
    monaco.editor.setModelLanguage(this.model, l);
  }

  SetTheme(t: string) {
    this.theme = t;
    this.updateOptions();
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
