import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import * as monaco from 'monaco-editor';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  editor!: monaco.editor.IStandaloneCodeEditor;
  language!: string;
  theme!: string;

  constructor(private cookieService: CookieService) {
    this.theme = this.cookieService.get('theme');
  }

  SetEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    if (this.theme == '') {
      this.theme = 'vs';
    }

    this.editor = editor;
    this.language = 'plaintext';

    this.updateOptions();
  }

  createOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
    return {
      theme: this.theme,
    }
  }

  updateOptions() {
    this.editor.updateOptions({
      cursorBlinking: 'smooth',
      mouseWheelZoom: true,
      showUnused: true,
      theme: this.theme,
    });
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

  Text(): string {
    return this.editor.getValue();
  }

  SetText(t: string) {
    this.editor.setValue(t);
  }

  Position(): number {
    return this.positionToNumber(this.editor.getPosition(), this.Text());
  }

  SetPosition(p: number) {
    this.editor.setPosition(this.numberToPosition(p, this.Text()));
  }

  SetLanguage(l: string) {
    if (l == this.language)
      return;
    this.language = l;

    const model = monaco.editor.createModel(this.editor!.getValue(), l, monaco.Uri.parse(l));
    this.editor.getModel()?.dispose();
    this.editor.setModel(model);
  }

  SetTheme(t: string) {
    this.cookieService.set('theme', t, undefined, "/");
    this.theme = t;
    this.updateOptions();
  }

  Theme(): string {
    return this.theme;
  }
}
