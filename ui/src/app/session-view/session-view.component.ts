import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';

import { interval, Observable, Subscription } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ApiService, GetSessionResponse } from '../api.service';
import { EditorService } from '../editor.service';
import * as monaco from 'monaco-editor';
import { DiffMatchPatch } from 'diff-match-patch-typescript'

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss'],
  styles: [`
  .my-super-cursor {
    background: black;
    width: 100px !important;
  }
  `]
})
export class SessionViewComponent implements OnInit {
  selectedLanguage!: string;
  selectedTheme!: string;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");
  sessionID = "";

  sessionSubscription!: Subscription;

  lastBaseText = "";

  sessionInvalid = false;

  initialSessionPromise!: Promise<GetSessionResponse | null>;

  constructor(
    private route: ActivatedRoute,
    private cdRef: ChangeDetectorRef,
    private titleService: Title,
    private apiService: ApiService,
    private editorService: EditorService) {
    this.selectedTheme = this.editorService.Theme();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.sessionID = params.session_id;
      this.apiService.SetSessionID(this.sessionID);
    })
    this.titleService.setTitle('coCoder ' + this.sessionID.substr(this.sessionID.length - 6));

    this.initialSessionPromise = this.apiService.GetSession().then(data => {
      this.selectedLanguage = data.Language;
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
    this.sessionSubscription.unsubscribe();
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  onInit(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editorService.SetEditor(editor);
    this.editorService.SetUserID(this.apiService.GetUserID());

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
              this.setLanguageInUI(data.Language);

            if (data.NewText !== this.editorService.Text()) {
              let dmp = new DiffMatchPatch();
              const patches = dmp.patch_make(this.lastBaseText, data.NewText);
              const newText = dmp.patch_apply(patches, this.editorService.Text())[0];
              this.editorService.SetText(newText);
            }

            this.lastBaseText = data.NewText;

            this.editorService.UpdateCursors(data.Users);
          },
          error: err => {
            console.log("Failed to update session:", err);
          },
        });
      },
    );

    this.editorService.editsObservable().subscribe({
      next: () => {
        this.updateSession();
      },
    });
  }

  updateSession() {
    this.apiService.UpdateSession(this.lastBaseText, this.editorService.Text(), this.editorService.Position());
  }

  setLanguageInUI(l: string) {
    this.selectedLanguage = l;
    this.cdRef.detectChanges();
  }

  onLanguageChange(ev: MatSelectChange) {
    this.editorService.SetLanguage(ev.value);
    this.apiService.SetLanguage(ev.value);
    this.updateSession();
  }

  onThemeChange(ev: MatSelectChange) {
    this.editorService.SetTheme(ev.value);
  }

  editorCreateOptions() {
    return this.editorService.createOptions();
  }
}
