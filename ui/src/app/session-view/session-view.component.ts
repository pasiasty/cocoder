import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';

import * as monaco from "monaco-editor";
import { CookieService } from 'ngx-cookie-service';
import { interval, Observable, Subscription } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ApiService, GetSessionResponse } from '../api.service';

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss']
})
export class SessionViewComponent implements OnInit {
  editorConstructOptions: monaco.editor.IStandaloneEditorConstructionOptions = {};

  editorOptions: monaco.editor.IEditorOptions = {
    cursorBlinking: 'smooth',
    mouseWheelZoom: true,
    showUnused: true,
  };
  editorGlobalOptions: monaco.editor.IGlobalEditorOptions = {
    theme: 'vs',
  };

  editor: monaco.editor.IStandaloneCodeEditor | null;
  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "typescript", "r");
  sessionID = "";

  intervalObservable: Observable<number>;
  pollingSubscription!: Subscription;

  lastBaseText = "";

  sessionInvalid = false;

  initialSessionPromise!: Promise<GetSessionResponse | null>;

  constructor(
    private route: ActivatedRoute,
    private cookieService: CookieService,
    private cdRef: ChangeDetectorRef,
    private titleService: Title,
    private apiService: ApiService) {
    this.editor = null;
    this.intervalObservable = interval(500);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if ('language' in params) {
        this.editorConstructOptions.language = params['language'];
      }
    });
    this.route.params.subscribe(params => {
      this.sessionID = params.session_id;
      this.apiService.SetSessionID(this.sessionID);
    })
    this.editorGlobalOptions.theme = this.cookieService.get('theme');
    this.titleService.setTitle('coCoder ' + this.sessionID.substr(this.sessionID.length - 6));

    this.initialSessionPromise = this.apiService.GetSession().then(data => {
      this.editorConstructOptions.language = data.Language;
      this.cdRef.detectChanges();
      return data;
    },
      err => {
        console.log("Failed to get session:", err);
        this.sessionInvalid = true;
        this.cdRef.detectChanges();
        return null;
      },
    );
  }

  ngOnDestroy() {
    this.pollingSubscription.unsubscribe();
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  positionToNumber(p: monaco.Position | null, text: string): number {
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

  numberToPosition(n: number, text: string): monaco.Position {
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


  pollBackendTextState() {
    this.pollingSubscription.unsubscribe();
    const currText = this.editor!.getValue();

    this.apiService.UpdateSession(
      this.lastBaseText,
      currText,
      this.positionToNumber(this.editor!.getPosition!(), currText)).subscribe({
        next: data => {
          this.lastBaseText = data.NewText;
          if (data.Language)
            this.setLanguageInUI(data.Language);

          if (data.WasMerged) {
            this.editor!.setValue(data.NewText);
            this.editor!.setPosition(this.numberToPosition(data.CursorPos, data.NewText));
          }
        },
        error: err => {
          console.log("Failed to update session:", err);
        },
        complete: () => {
          this.pollingSubscription = this.intervalObservable.subscribe(
            _ => { this.pollBackendTextState() }
          );
        },
      });
  }

  updateEditorOptions() {
    if (this.editor !== null) {
      this.editor.updateOptions({
        ...this.editorOptions, ...this.editorGlobalOptions,
      });
    }
  }

  onInit(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.updateEditorOptions();

    this.initialSessionPromise.then(
      data => {
        if (data === null) {
          return;
        }
        this.editor?.setValue(data.Text);
        this.lastBaseText = data.Text;

        this.pollingSubscription = this.intervalObservable.subscribe(
          _ => { this.pollBackendTextState() }
        );

        if (this.editorConstructOptions.language !== undefined)
          this.setLanguageInUI(this.editorConstructOptions.language);
      },
    );
  }

  setLanguageInUI(l: string) {
    if (l == this.editorConstructOptions.language) {
      return;
    }
    this.editorConstructOptions.language = l;
    this.cdRef.detectChanges();
    const model = monaco.editor.createModel(this.editor!.getValue(), l, monaco.Uri.parse(l));
    this.editor?.getModel()?.dispose();
    this.editor?.setModel(model);
    this.editor?.onKeyDown
  }

  onLanguageChange(ev: MatSelectChange) {
    this.setLanguageInUI(ev.value);
    this.apiService.SetLanguage(ev.value);
  }

  onThemeChange(ev: MatSelectChange) {
    this.editorGlobalOptions.theme = ev.value;
    this.cookieService.set('theme', ev.value, undefined, "/");
    this.updateEditorOptions();
  }

}
