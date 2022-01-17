import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute, Params, Router } from '@angular/router';

import * as monaco from "monaco-editor";
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../environments/environment';
import { retry } from 'rxjs/operators';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cookieService: CookieService,
    private httpClient: HttpClient) {
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

    this.httpClient.get<string>(environment.api + '/api/' + this.sessionID).pipe(
      retry(3)
    ).subscribe((data) => {
      this.editor?.setValue(data);
    }, (err) => {
      console.log("Failed to get session:", err);
      this.router.navigate(['/not_found']).then(() => {
        window.location.reload();
      });
    })
  }

  onLanguageChange(ev: MatSelectChange) {
    const queryParams: Params = { language: ev.value };

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: queryParams,
        queryParamsHandling: 'merge',
      }).then(
        () => { window.location.reload(); }
      );
  }

  onThemeChange(ev: MatSelectChange) {
    this.editorOptions.theme = ev.value;
    this.cookieService.set('theme', ev.value);
    this.updateThemeOnEditor();
  }

}
