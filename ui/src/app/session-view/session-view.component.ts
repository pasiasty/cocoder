import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { ActivatedRoute, Params, Router } from '@angular/router';

import * as monaco from "monaco-editor";

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss']
})
export class SessionViewComponent implements OnInit {

  editorOptions = { language: 'plaintext' };
  editor: monaco.editor.IStandaloneCodeEditor | null;
  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "typescript", "r");

  constructor(private route: ActivatedRoute, private router: Router) {
    this.editor = null;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if ('language' in params) {
        this.editorOptions.language = params['language'];
      }
    });
  }

  onInit(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
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

}
