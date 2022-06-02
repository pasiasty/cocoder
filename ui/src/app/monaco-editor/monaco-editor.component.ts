import { AfterViewInit, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { first } from 'rxjs/operators';
import { MonacoEditorService } from './monaco-editor.service';
import * as monaco from 'monaco-editor';
import { ThemeService } from '../utils/theme.service';

@Component({
  selector: 'app-monaco-editor',
  templateUrl: './monaco-editor.component.html',
  styleUrls: ['./monaco-editor.component.scss']
})
export class MonacoEditorComponent implements AfterViewInit {

  public _editor!: monaco.editor.IStandaloneCodeEditor;
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  @Output() editorCreated = new EventEmitter<monaco.editor.IStandaloneCodeEditor>();

  constructor(private monacoEditorService: MonacoEditorService, private themeService: ThemeService) { }

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
      }
    );
    this.editorCreated.emit(this._editor);
  }

  onResize(): void {
    this._editor.layout();
  }
}
