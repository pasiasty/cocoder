import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { first, mergeMap, sampleTime } from 'rxjs/operators';
import { MonacoEditorService } from './monaco-editor.service';
import * as monaco from 'monaco-editor';
import { ThemeService } from '../utils/theme.service';
import { ApiService, GetSessionResponse, User } from '../api.service';
import { EditorControllerService } from './editor-controller.service';
import { from, Subject } from 'rxjs';
import { FileSaverService } from 'ngx-filesaver';
import { DiffMatchPatch, PatchObject } from 'diff-match-patch-typescript';
import { Selection } from '../common';

type DecorationDescription = {
  UserID: string
  Index: number
  Decoration: monaco.editor.IModelDeltaDecoration
};

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss']
})
export class MonacoEditorComponent implements AfterViewInit, OnInit {

  lastBaseText = "";

  language!: string;
  fontSize: number;
  oldDecorations: string[];
  currentDecorations: DecorationDescription[];
  editsSubject: Subject<void>;
  userID!: string;

  dmp: DiffMatchPatch;

  public _editor!: monaco.editor.IStandaloneCodeEditor;
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  @Output() invalidSession = new EventEmitter<void>();
  @Output() editorCreated = new EventEmitter<void>();

  constructor(
    private monacoEditorService: MonacoEditorService,
    private themeService: ThemeService,
    private apiService: ApiService,
    private editorControllerService: EditorControllerService,
    private cdRef: ChangeDetectorRef,
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

    this.editorControllerService.saveTriggersObservable().subscribe({
      next: _ => {
        this.fileSaverService.saveText(this.Text(), `code${this.GetLanguageExtension()}`);
      }
    });

    this.dmp = new DiffMatchPatch();
  }

  ngOnInit(): void {
    const initialStateObservable = from(this.apiService.GetSession().then((data: GetSessionResponse) => {
      this.editorControllerService.setLanguage(data.Language);
      this.cdRef.detectChanges();
      return data;
    },
      err => {
        console.log("Failed to get session:", err);
        this.invalidSession.emit();
        return null;
      },
    ));

    this.editorCreated.asObservable().pipe(
      mergeMap(() => initialStateObservable)
    ).subscribe({
      next: (data: GetSessionResponse | null) => {
        this.applyInitialState(data);
      }
    });

    this.editorCreated.asObservable().pipe(
      mergeMap(() => this.editorControllerService.languageChanges())
    ).subscribe({
      next: () => {
        this.updateSession();
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.monacoEditorService.loaded) {
      this.monacoEditorService.loadingFinished.pipe(first()).subscribe(() => {
        this.createEditor();
      });
    }
    else {
      this.createEditor();
    }
  }

  private createEditor(): void {
    this._editor = monaco.editor.create(
      this._editorContainer.nativeElement,
      {
        theme: this.themeService.editorThemeName(),
        language: this.language,
      }
    );
    this.updateOptions();
    this.BindEvents();
    this.SetUserID(this.apiService.GetUserID());

    this.editorCreated.emit();
  }

  onResize(): void {
    this._editor.layout();
  }

  updateSession() {
    const newText = this.Text();
    this.apiService.UpdateSession(this.lastBaseText, newText, this.Position(), this.OtherUsers(), this.Selection());
    this.lastBaseText = newText;
  }

  applyInitialState(data: GetSessionResponse | null) {
    if (data === null) {
      return;
    }
    this.SetText(data.Text);
    this.SetLanguage(data.Language);
    this.lastBaseText = data.Text;

    this.apiService.SessionObservable().subscribe({
      next: data => {
        if (data.Language)
          this.editorControllerService.setLanguage(data.Language);

        if (data.NewText !== this.Text()) {
          this.SetText(data.NewText!);
        }

        this.lastBaseText = data.NewText!;

        this.UpdateCursors(data.Users!);
      },
      error: err => {
        console.log("Failed to update session:", err);
      },
    });
  }

  GetLanguageExtension(): string {
    const lep = monaco.languages.getLanguages().find(val => val.id == this.language);
    if (lep === undefined || lep.extensions === undefined || lep.extensions?.length === 0)
      return '.txt';
    return lep.extensions[0];
  }

  BindEvents() {
    this._editor.onKeyDown(() => {
      this.editsSubject.next();
    });

    this._editor.onDidPaste(() => {
      this.editsSubject.next();
    });

    this._editor.onDidChangeCursorPosition(() => {
      this.editsSubject.next();
    });

    this._editor.onDidChangeCursorSelection(() => {
      this.editsSubject.next();
    });

    this.themeService.themeChanges().subscribe(() => {
      this.SetTheme(this.themeService.editorThemeName());
    });

    this.editorControllerService.languageChanges().subscribe(val => {
      this.SetLanguage(val);
    });

    this.editorControllerService.fontUpdates().subscribe(val => {
      this.fontSize += val;
      localStorage.setItem("font_size", this.fontSize.toString());
      this.updateOptions();
    });

    this.editorControllerService.toggleHintsObservable().subscribe(val => {
      this.updateOptions();
    });

    this.editsSubject.pipe(
      sampleTime(50),
    ).subscribe({
      next: () => {
        this.updateSession();
      },
    });
  }

  SetUserID(userID: string) {
    this.userID = userID;
  }

  updateOptions() {
    const withHints = this.editorControllerService.hintsAreEnabled();

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: !withHints,
      noSuggestionDiagnostics: !withHints,
      noSyntaxValidation: !withHints,
    });

    this._editor!.updateOptions({
      cursorBlinking: 'smooth',
      fontSize: this.fontSize,
      showUnused: withHints,
      scrollbar: {
        verticalScrollbarSize: 0,
      },
      parameterHints: {
        enabled: withHints,
      },
      inlayHints: {
        enabled: withHints,
      },
      inlineSuggest: {
        enabled: withHints,
      },
      quickSuggestions: withHints,
      snippetSuggestions: withHints ? 'inline' : 'none',
      showDeprecated: withHints,
      suggestOnTriggerCharacters: withHints,
    });
  }

  positionToNumber(p: monaco.Position | null): number {
    let text = this.Text();

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
    return this._editor!.getModel()!.getValue(monaco.editor.EndOfLinePreference.CRLF);
  }

  SetText(t: string) {
    const oldSelection = this._editor.getSelection();

    this._editor!.getModel()!.applyEdits(this.NewTextToOperations(t));

    if (oldSelection !== null) {
      this._editor.setSelection(oldSelection);
    }
  }

  NewTextToOperations(newText: string): monaco.editor.IIdentifiedSingleEditOperation[] {
    let patches = this.dmp.patch_make(this.Text(), newText);
    let res: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    patches.forEach((patch: PatchObject) => {
      const start = patch.start1;
      const end = start + patch.length1;
      const startPos = this.numberToPosition(start);
      const endPos = this.numberToPosition(end);
      const text = this.Text().slice(start, end);
      const applied = this.dmp.patch_apply([patch], text)[0];
      res.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        text: applied,
      });
    });

    return res;
  }

  Position(): number {
    return this.positionToNumber(this._editor!.getPosition());
  }

  Selection(): Selection | undefined {
    const editorSelection = this._editor!.getSelection();
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
      const dr = this._editor!.getModel()!.getDecorationRange(this.oldDecorations[idx]);
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
    this._editor!.setPosition(this.numberToPosition(p));
  }

  SetLanguage(l: string) {
    this.language = l;
    monaco.editor.setModelLanguage(this._editor!.getModel()!, l);
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
    this.oldDecorations = this._editor!.deltaDecorations(this.oldDecorations, this.currentDecorations.map(d => d.Decoration));
  }

  UpdateCursors(users: User[]) {
    this.currentDecorations = users.filter(u => this.userID != u.ID).map(u => this.userToDecoration(u));
    this.updateDecorations();
    for (const u of users) {
      if (u.ID == this.userID && this.Position() != u.Position && this.Selection() === undefined) {
        this.SetPosition(u.Position);
      }
    }
  }
}
