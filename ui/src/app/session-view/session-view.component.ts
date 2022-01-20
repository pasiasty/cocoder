import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';

import * as monaco from "monaco-editor";
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environment';
import { retry } from 'rxjs/operators';
import { interval, Observable, Subscription } from 'rxjs';
import { Title } from '@angular/platform-browser';

type EditResponse = {
  NewText: string
  CursorPos: number
  WasMerged: boolean
  Language: string
}

type GetSessionResponse = {
  Text: string
  Language: string
}

type LanguageState = 'stable' | 'triggering' | 'triggered';

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

  languageState: LanguageState = 'stable';

  initialSessionPromise!: Promise<GetSessionResponse | null>;

  constructor(
    private route: ActivatedRoute,
    private cookieService: CookieService,
    private httpClient: HttpClient,
    private cdRef: ChangeDetectorRef,
    private titleService: Title) {
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
    })
    this.editorGlobalOptions.theme = this.cookieService.get('theme');
    this.titleService.setTitle('coCoder ' + this.sessionID.substr(this.sessionID.length - 6));

    this.initialSessionPromise = this.httpClient.get<GetSessionResponse>(environment.api + this.sessionID).pipe(
      retry(3)
    ).toPromise().then(data => {
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
    this.languageState = 'stable';
    const currText = this.editor!.getValue();
    const formData = new FormData();
    formData.append("BaseText", this.lastBaseText);
    formData.append("NewText", currText);
    formData.append("CursorPos", this.positionToNumber(this.editor!.getPosition!(), currText).toString());
    this.httpClient.post<EditResponse>(environment.api + this.sessionID, formData).pipe(
      retry(3)
    ).subscribe(
      data => {
        this.lastBaseText = data.NewText;
        if (data.Language && this.languageState == 'stable')
          this.setLanguage(data.Language);

        if (data.WasMerged) {
          this.editor!.setValue(data.NewText);
          this.editor!.setPosition(this.numberToPosition(data.CursorPos, data.NewText));
        }
      },
      err => {
        console.log("Failed to update session:", err);
      },
      () => {
        this.pollingSubscription = this.intervalObservable.subscribe(
          _ => { this.pollBackendTextState() }
        );
      }
    );
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
          this.setLanguage(this.editorConstructOptions.language);
      },
    );
  }

  setLanguage(l: string) {
    if (l == this.editorConstructOptions.language) {
      return;
    }
    this.editorConstructOptions.language = l;
    this.cdRef.detectChanges();
    const model = monaco.editor.createModel(this.editor!.getValue(), l, monaco.Uri.parse(l));
    this.editor?.getModel()?.dispose();
    this.editor?.setModel(model);
  }

  onLanguageChange(ev: MatSelectChange) {
    this.languageState = 'triggering';
    this.setLanguage(ev.value);
    const formData = new FormData();
    formData.append("Language", ev.value);
    this.httpClient.post(environment.api + this.sessionID + '/language', formData).pipe(
      retry(3)
    ).subscribe(
      data => {
        console.log(data);
      },
      err => {
        console.log("Failed to update session language:", err);
      },
      () => {
        this.languageState = 'triggered';
      }
    );
  }

  onThemeChange(ev: MatSelectChange) {
    this.editorGlobalOptions.theme = ev.value;
    this.cookieService.set('theme', ev.value, undefined, "/");
    this.updateEditorOptions();
  }

}
