import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { MonacoEditorService } from './monaco-editor.service';
import * as monaco from 'monaco-editor';
import { ThemeService } from '../utils/theme.service';
import { EditorService } from './editor.service';
import { ApiService, GetSessionResponse } from '../api.service';
import { EditorControllerService } from './editor-controller.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss']
})
export class MonacoEditorComponent implements AfterViewInit, OnDestroy, OnInit {

  editorServiceInitialized = false;

  languageChangesSubscription?: Subscription;
  sessionSubscription?: Subscription;
  editsSubscription?: Subscription;

  initialSessionPromise!: Promise<GetSessionResponse | null>;

  lastBaseText = "";

  public _editor!: monaco.editor.IStandaloneCodeEditor;
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  @Output() invalidSession = new EventEmitter<void>();
  @Output() editorCreated = new EventEmitter<void>();

  constructor(
    private monacoEditorService: MonacoEditorService,
    private themeService: ThemeService,
    private editorService: EditorService,
    private apiService: ApiService,
    private editorControllerService: EditorControllerService,
    private cdRef: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.initialSessionPromise = this.apiService.GetSession().then(data => {
      this.editorControllerService.setLanguage(data.Language);
      this.cdRef.detectChanges();
      return data;
    },
      err => {
        console.log("Failed to get session:", err);
        this.invalidSession.emit();
        return null;
      },
    );

    this.languageChangesSubscription = this.editorControllerService.languageChanges().subscribe(_ => {
      if (this.editorServiceInitialized) {
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

  ngOnDestroy(): void {
    this.languageChangesSubscription?.unsubscribe();
    this.sessionSubscription?.unsubscribe();
    this.editsSubscription?.unsubscribe();
  }

  private createEditor(): void {
    this._editor = monaco.editor.create(
      this._editorContainer.nativeElement,
      {
        theme: this.themeService.editorThemeName(),
      }
    );

    this.editorService.SetEditor(this._editor);
    this.editorService.SetUserID(this.apiService.GetUserID());

    if (!this.editorServiceInitialized) {
      this.editorService.SetText('');
      this.editorServiceInitialized = true;
      this.initializeEditorService();
    }

    this.editorCreated.emit();
  }

  onResize(): void {
    this._editor.layout();
  }

  updateSession() {
    const newText = this.editorService.Text();
    this.apiService.UpdateSession(this.lastBaseText, newText, this.editorService.Position(), this.editorService.OtherUsers(), this.editorService.Selection());
    this.lastBaseText = newText;
  }

  initializeEditorService() {
    this.initialSessionPromise.then(
      data => {
        if (data === null) {
          return;
        }
        this.editorService.SetText(data.Text);
        this.editorService.SetLanguage(data.Language);
        this.lastBaseText = data.Text;

        this.sessionSubscription = this.apiService.SessionObservable().subscribe({
          next: data => {
            if (data.Language)
              this.editorControllerService.setLanguage(data.Language);

            if (data.NewText !== this.editorService.Text()) {
              this.editorService.SetText(data.NewText!);
            }

            this.lastBaseText = data.NewText!;

            this.editorService.UpdateCursors(data.Users!);
          },
          error: err => {
            console.log("Failed to update session:", err);
          },
        });
      },
    );

    this.editsSubscription = this.editorService.editsObservable().subscribe({
      next: () => {
        this.updateSession();
      },
    });
  }
}
