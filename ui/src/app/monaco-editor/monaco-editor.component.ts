import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { first, mergeMap, sampleTime } from 'rxjs/operators';
import { MonacoEditorService } from './monaco-editor.service';
import * as monaco from 'monaco-editor';
import { ThemeService } from 'src/app/services/theme.service';
import { ApiService, EditResponse, GetSessionResponse, User } from 'src/app/services/api.service';
import { from, Subject, Subscription } from 'rxjs';
import { FileSaverService } from 'ngx-filesaver';
import { Diff, DiffMatchPatch, DiffOperation } from 'diff-match-patch-typescript';
import { Selection } from 'src/app/common';

type DecorationDescription = {
  UserID: string
  Index: number
  Decoration: monaco.editor.IModelDeltaDecoration
};

export enum Mode {
  Code,
  Stdin,
  Stdout,
  Stderr,
}

class ModelsStore {
  models: Map<string, monaco.editor.ITextModel>;
  languageExtensions: Map<string, string>;

  private codeEditorUri(userID: string, mode: Mode, language: string): monaco.Uri {
    return monaco.Uri.parse(`file:///tmp/${language}/${userID}/${mode}_code.${this.languageExtensions.get(language)}`)
  }

  constructor(userID: string, mode: Mode) {
    this.languageExtensions = new Map<string, string>(Object.entries({
      "plaintext": "txt",
      "python": "py",
      "cpp": "cpp",
      "go": "go",
      "java": "java",
    }));

    if (mode == Mode.Code) {
      this.models = new Map<string, monaco.editor.ITextModel>(Object.entries({
        'plaintext': monaco.editor.createModel('', 'plaintext', this.codeEditorUri(userID, mode, 'plaintext')),
        'python': monaco.editor.createModel('', 'python', this.codeEditorUri(userID, mode, 'python')),
        'cpp': monaco.editor.createModel('', 'cpp', this.codeEditorUri(userID, mode, 'cpp')),
        'go': monaco.editor.createModel('', 'go', this.codeEditorUri(userID, mode, 'go')),
        'java': monaco.editor.createModel('', 'java', this.codeEditorUri(userID, mode, 'java')),
      }));
    }
    else {
      this.models = new Map<string, monaco.editor.ITextModel>(Object.entries({
        'plaintext': monaco.editor.createModel('', 'plaintext', this.codeEditorUri(userID, mode, 'plaintext')),
      }));
    }
  }

  getModel(language: string): monaco.editor.ITextModel {
    if (this.models.has(language)) {
      return this.models.get(language)!;
    }
    return this.models.get('plaintext')!;
  }

  dispose() {
    this.models.forEach(m => {
      m.dispose();
    });
  }
}

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss']
})
export class MonacoEditorComponent implements AfterViewInit, OnInit, OnChanges, OnDestroy {

  @Input() mode!: Mode;

  lastBaseText = "";

  language!: string;
  fontSize: number;
  oldDecorations: string[];
  currentDecorations: DecorationDescription[];
  editsSubject: Subject<void>;
  userID!: string;

  dmp: DiffMatchPatch;

  stdout: string = '';
  stderr: string = '';

  themeChangesSubscription?: Subscription;
  editsSubjectSubscription?: Subscription;

  models!: ModelsStore;

  public _editor!: monaco.editor.IStandaloneCodeEditor;
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  @Output() editorCreated = new EventEmitter<void>();

  @Input() hintsEnabled: boolean = true;

  initialSessionState: Promise<GetSessionResponse>;
  initialSessionStateResolver!: (resp: GetSessionResponse) => void;

  constructor(
    private monacoEditorService: MonacoEditorService,
    private themeService: ThemeService,
    private apiService: ApiService,
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

    this.dmp = new DiffMatchPatch();

    this.initialSessionState = new Promise<GetSessionResponse>((resolve) => {
      this.initialSessionStateResolver = resolve;
    });
  }

  setInitialSessionState(resp: GetSessionResponse) {
    this.initialSessionStateResolver(resp);
  }

  ngOnInit(): void {
    this.editorCreated.asObservable().subscribe({
      next: async () => {
        this.applyInitialState(await this.initialSessionState);
      },
    });

    this.SetUserID(this.apiService.GetUserID());

    this.models = new ModelsStore(this.userID, this.mode);
  }

  ngOnDestroy(): void {
    this.themeChangesSubscription?.unsubscribe();
    this.editsSubject?.unsubscribe();
    this._editor?.getModel()?.dispose();
    this._editor?.dispose();
    this.models.dispose();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this._editor !== undefined)
      this.updateOptions();

    if (changes.mode !== undefined) {
      this.updateOutputText();
    }
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
      },
    );

    this._editor.setModel(this.models.getModel(this.language));

    this.updateOptions();
    this.BindEvents();

    this._editor.addAction({
      id: "custom.editor.action.deleteLines",
      label: "Delete lines",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
      run: () => {
        this._editor.getAction("editor.action.deleteLines").run();
        this.editsSubject.next();
      },
    });

    this._editor.addAction({
      id: "custom.editor.action.saveFile",
      label: "Save file",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        this.saveContent();
      },
    });

    this.OnResize();
    this.editorCreated.emit();
  }

  async saveContent() {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: `code${this.GetLanguageExtension()}` });
      const writable = await handle.createWritable();
      await writable.write(this.Text());
      await writable.close();
    } else {
      this.fileSaverService.saveText(this.Text(), `code${this.GetLanguageExtension()}`);
    }
  }

  updateSession() {
    switch (this.mode) {
      case Mode.Code:
        const newText = this.Text();
        this.apiService.UpdateSession(this.lastBaseText, newText, this.Position(), this.OtherUsers(), this.Selection());
        this.lastBaseText = newText;
        break;
      case Mode.Stdin:
        if (this.lastBaseText !== this.Text()) {
          this.lastBaseText = this.Text();
          this.apiService.UpdateInputText(this.Text());
        }
        break;
    }
  }

  handleSessionUpdate(data: EditResponse) {
    switch (this.mode) {
      case Mode.Code:
        if (data.Language) {
          this.SetLanguage(data.Language);
        }

        // Check if the text should be updated
        if (data.NewText !== this.Text() && data.NewText !== this.lastBaseText) {
          this.SetText(data.NewText!);
        }

        this.lastBaseText = data.NewText!;

        this.UpdateCursors(data.Users!);
        break;
      case Mode.Stdin:
        if (data.UpdateInputText) {
          this.lastBaseText = data.InputText!;
          this.SetText(data.InputText!);
        }
        break;
      case Mode.Stdout:
      case Mode.Stderr:
        if (data.UpdateOutputText) {
          this.stdout = data.Stdout!.replace('\r\n', '\n');
          this.stderr = data.Stderr!.replace('\r\n', '\n');
          this.updateOutputText();
        }
        break;
    }
  }

  applyInitialState(data: GetSessionResponse | null) {
    if (data === null) {
      return;
    }

    switch (this.mode) {
      case Mode.Code:
        this.SetText(data.Text);
        this.SetLanguage(data.Language);
        this.lastBaseText = data.Text;
        break;
      case Mode.Stdin:
        this.SetText(data.InputText);
        this.lastBaseText = data.InputText;
        break;
      case Mode.Stdout:
      case Mode.Stderr:
        this.stdout = data.Stdout.replace('\r\n', '\n');
        this.stderr = data.Stderr.replace('\r\n', '\n');
        this.updateOutputText();
        break;
    }
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

    this.themeChangesSubscription = this.themeService.themeChanges().subscribe(() => {
      this.SetTheme(this.themeService.editorThemeName());
    });

    this.editsSubjectSubscription = this.editsSubject.pipe(
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

  updateFontSize(val: number) {
    this.fontSize += val;
    localStorage.setItem("font_size", this.fontSize.toString());
    this.updateOptions();
  }

  updateOptions() {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: !this.hintsEnabled,
      noSuggestionDiagnostics: !this.hintsEnabled,
      noSyntaxValidation: !this.hintsEnabled,
    });

    let options: monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions = {
      cursorBlinking: 'smooth',
      fontSize: this.fontSize,
      showUnused: this.hintsEnabled,
      scrollbar: {
        verticalScrollbarSize: 0,
        vertical: 'hidden',
      },
      parameterHints: {
        enabled: this.hintsEnabled,
      },
      inlayHints: {
        enabled: this.hintsEnabled,
      },
      inlineSuggest: {
        enabled: this.hintsEnabled,
      },
      quickSuggestions: this.hintsEnabled,
      snippetSuggestions: this.hintsEnabled ? 'inline' : 'none',
      showDeprecated: this.hintsEnabled,
      suggestOnTriggerCharacters: this.hintsEnabled,
    };

    if (this.mode !== Mode.Code) {
      options.minimap = {
        enabled: false,
      };
      options.scrollbar = {
        verticalScrollbarSize: 10,
        vertical: 'visible',
      };
    }

    if (this.mode === Mode.Stdout || this.mode === Mode.Stderr) {
      options.readOnly = true;
    }

    this._editor!.updateOptions(options);
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
    return this._editor!.getModel()!.getValue(monaco.editor.EndOfLinePreference.LF);
  }

  SetText(t: string) {
    // Workaround for unwanted selection produced as a side effect of invoking applyEdits.
    // Context: https://github.com/microsoft/monaco-editor/issues/1811

    const oldSelection = this._editor.getSelection();

    this._editor!.getModel()!.applyEdits(this.NewTextToOperations(t));

    if (oldSelection !== null) {
      this._editor.setSelection(oldSelection);
    }
  }

  NewTextToOperations(newText: string): monaco.editor.IIdentifiedSingleEditOperation[] {
    let res: monaco.editor.IIdentifiedSingleEditOperation[] = [];

    let diffs = this.dmp.diff_main(this.Text(), newText);

    let currIdx = 0;
    let currOperation: monaco.editor.IIdentifiedSingleEditOperation | null = null;

    diffs.forEach((diff: Diff) => {
      const operation: DiffOperation = diff[0];
      const val: string = diff[1];

      switch (operation) {
        case DiffOperation.DIFF_EQUAL:
          if (currOperation !== null) {
            res.push(currOperation)
            currOperation = null;
          }

          currIdx += val.length;
          break;
        case DiffOperation.DIFF_DELETE:
          const startPos = this.numberToPosition(currIdx);
          const endPos = this.numberToPosition(currIdx + val.length);
          const deleteRange = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);

          if (currOperation === null) {
            currOperation = {
              range: deleteRange,
              text: '',
            }
          } else {
            currOperation.range = deleteRange;
          }

          currIdx += val.length;
          break;
        case DiffOperation.DIFF_INSERT:
          const pos = this.numberToPosition(currIdx);
          const insertRange = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);

          if (currOperation === null) {
            currOperation = {
              range: insertRange,
              text: val,
            }
          } else {
            currOperation.text = val;
          }
          break;
      }
    });

    if (currOperation !== null) {
      res.push(currOperation);
    }

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
    if (l === this.language)
      return;

    this.language = l;
    const m = this.models.getModel(l);
    m.setValue(this.Text());
    this._editor.setModel(m);
    this.editsSubject.next();
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

  UpdateCursors(users: User[]) {
    this.currentDecorations = users.filter(u => this.userID != u.ID).map(u => this.userToDecoration(u));
    this.oldDecorations = this._editor!.deltaDecorations(this.oldDecorations, this.currentDecorations.map(d => d.Decoration));
  }

  FormatText() {
    if (this.language == "python") {
      this.apiService.FormatCode(this.Text()).then(resp => {
        this._editor.setValue(resp.Code);
      });
    } else {
      this._editor.getAction('editor.action.formatDocument').run();
    }
  }

  OnResize() {
    if (this._editor !== undefined)
      this._editor.layout();
  }

  SetOutputText(stdout: string, stderr: string) {
    this.stdout = stdout.replace('\r\n', '\n');
    this.stderr = stderr.replace('\r\n', '\n');

    this.updateOutputText();
  }

  private updateOutputText() {
    if (this._editor === undefined)
      return;
    switch (this.mode) {
      case Mode.Stdout:
        this._editor.setValue(this.stdout);
        break;
      case Mode.Stderr:
        this._editor.setValue(this.stderr);
        break;
    }
  }
}
