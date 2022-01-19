import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute, Params, Router } from '@angular/router';

import * as monaco from "monaco-editor";
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environment';
import { retry, filter } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';

type EditState = {
  NewText: string
  CursorPos: number
}

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss']
})
export class SessionViewComponent implements OnInit {

  editorOptions = { language: 'plaintext', theme: 'vs' };
  editor: monaco.editor.IStandaloneCodeEditor | null;
  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "typescript", "r");
  sessionID = "";

  pollingSubscription!: Subscription;

  lastBaseText = "";

  lastEditTimeMs = Date.now();

  sessionInvalid = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cookieService: CookieService,
    private httpClient: HttpClient,
    private cdRef: ChangeDetectorRef) {
    this.editor = null;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if ('language' in params) {
        this.editorOptions.language = params['language'];
      }
    });
    this.route.params.subscribe(params => {
      this.sessionID = params.session_id;
    })
    this.editorOptions.theme = this.cookieService.get('theme');
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
    const currText = this.editor!.getValue();
    const formData = new FormData();
    formData.append("BaseText", this.lastBaseText);
    formData.append("NewText", currText);
    formData.append("CursorPos", this.positionToNumber(this.editor!.getPosition!(), currText).toString());
    this.httpClient.post<EditState>(environment.api + this.sessionID, formData).pipe(
      retry(3)
    ).subscribe(
      data => {
        this.lastBaseText = data.NewText;

        if (this.editor!.getValue() != data.NewText) {
          this.editor!.setValue(data.NewText);
          this.editor!.setPosition(this.numberToPosition(data.CursorPos, data.NewText));
        }
      },
      err => {
        console.log("Failed to update session:", err);
      }
    )
  }

  updateThemeOnEditor() {
    if (this.editorOptions.theme != "" && this.editor !== null) {
      this.editor.updateOptions({
        theme: this.editorOptions.theme,
      });
    }
  }

  onInit(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.updateThemeOnEditor();

    this.httpClient.get<string>(environment.api + this.sessionID).pipe(
      retry(3)
    ).subscribe((data) => {
      this.editor?.setValue(data);
      this.lastBaseText = data;
    }, (err) => {
      console.log("Failed to get session:", err);
      this.sessionInvalid = true;
      this.pollingSubscription.unsubscribe();
      this.cdRef.detectChanges();
    });

    this.pollingSubscription = interval(500).pipe(filter(_ => {
      return (Date.now() - this.lastEditTimeMs) > 1000;
    })).subscribe(
      _ => { this.pollBackendTextState() }
    );

    this.editor.onKeyDown((e: monaco.IKeyboardEvent) => {
      this.lastEditTimeMs = Date.now();
    });
  }

  onLanguageChange(ev: MatSelectChange) {
    const model = monaco.editor.createModel(this.editor!.getValue(), ev.value, ev.value);
    this.editor?.getModel()?.dispose();
    this.editor?.setModel(model);

    const queryParams: Params = { language: ev.value };

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: queryParams,
        queryParamsHandling: 'merge',
      });
  }

  onThemeChange(ev: MatSelectChange) {
    this.editorOptions.theme = ev.value;
    this.cookieService.set('theme', ev.value, undefined, "/");
    this.updateThemeOnEditor();
  }

}
