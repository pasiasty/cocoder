import { AfterViewInit, Component, ElementRef, OnInit, QueryList, Renderer2, ViewChild, ViewChildren } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Title } from '@angular/platform-browser';
import { ApiService } from 'src/app/services/api.service';

import * as monaco from 'monaco-editor';
import { GoogleAnalyticsService } from 'src/app/services/google-analytics.service';
import { ClipboardService } from 'ngx-clipboard';
import { ToastService } from 'src/app/services/toast.service';
import { LanguageUpdate, MonacoEditorComponent, Mode } from 'src/app/monaco-editor/monaco-editor.component';

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss'],
})
export class SessionViewComponent implements OnInit, AfterViewInit {

  EditorMode = Mode;

  sessionInvalid = false;
  selectedLanguage!: string;
  supportsFormatting: boolean;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");

  hintsEnabled = true;

  @ViewChildren(MonacoEditorComponent)
  monacoEditorComponents!: QueryList<MonacoEditorComponent>;

  codeEditor!: MonacoEditorComponent;
  inputEditor!: MonacoEditorComponent;
  outputEditor!: MonacoEditorComponent;

  @ViewChild('bottomBar')
  bottomBar!: ElementRef<HTMLDivElement>;

  @ViewChild('editorContainer')
  editorContainer!: ElementRef<HTMLDivElement>;

  lastClientY: number = 0;
  isDragging: boolean = false;
  editorHeight: number = 0;
  bottomBarHeight: number = 0;
  fullHeight: number = 0;
  bottomBarCollapsed: boolean = false;
  resizeHandleCursor = 'ns-resize';

  stdoutActive = true;
  stderrActive = false;

  outputEditorMode: Mode = Mode.Stdout;

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private apiService: ApiService,
    private googleAnalyticsService: GoogleAnalyticsService,
    private clipboardService: ClipboardService,
    private toastService: ToastService,
    private renderer: Renderer2) {
    const enabledString = localStorage.getItem('hints_enabled');
    if (enabledString === 'disabled') {
      this.hintsEnabled = false;
    } else {
      this.hintsEnabled = true;
    }
    this.supportsFormatting = false;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.apiService.StartSession(params.session_id);
      this.titleService.setTitle('coCoder ' + params.session_id.substring(params.session_id.length - 6));
    })
  }

  ngAfterViewInit(): void {
    this.monacoEditorComponents.toArray().forEach(c => {
      switch (c.mode) {
        case Mode.Code:
          this.codeEditor = c;
          break;
        case Mode.Stdin:
          this.inputEditor = c;
          break;
        case Mode.Stdout:
        case Mode.Stderr:
          this.outputEditor = c;
          break;
      }
    });

    this.editorHeight = this.editorContainer.nativeElement.offsetHeight;
    this.bottomBarHeight = this.bottomBar.nativeElement.offsetHeight;
    this.fullHeight = this.editorHeight + this.bottomBarHeight;

    this.renderer.setStyle(this.bottomBar.nativeElement, 'height', `${this.bottomBar}px`);
    this.renderer.setStyle(this.editorContainer.nativeElement, 'height', `${this.editorHeight}px`);
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  onLanguageChange(val: string) {
    this.selectedLanguage = val;
    this.apiService.updateLanguage(val);
    this.codeEditor.SetLanguage(val);
    this.googleAnalyticsService.event('language_change', 'engagement', 'top_bar', val);
  }

  downloadButtonClicked(): void {
    this.codeEditor.saveContent();
    this.googleAnalyticsService.event('download_content', 'engagement', 'top_bar');
  }

  shareButtonClicked(): void {
    this.clipboardService.copy(window.location.href);
    this.toastService.show("", "Copied session URL to clipboard");
    this.googleAnalyticsService.event('share_button', 'engagement', 'top_bar');
  }

  zoomInButtonClicked(): void {
    this.codeEditor.updateFontSize(1);
    this.inputEditor.updateFontSize(1);
    this.outputEditor.updateFontSize(1);
    this.googleAnalyticsService.event('zoom', 'engagement', 'top_bar', 'increase');
  }

  zoomOutButtonClicked(): void {
    this.codeEditor.updateFontSize(-1);
    this.inputEditor.updateFontSize(-1);
    this.outputEditor.updateFontSize(-1);
    this.googleAnalyticsService.event('zoom', 'engagement', 'top_bar', 'decrease');
  }

  notificationsTitle(): string {
    return this.hintsEnabled ? 'Click to disable hints' : 'Click to enable hints';
  }

  notificationsButtonClicked(): void {
    this.hintsEnabled = !this.hintsEnabled;
    if (this.hintsEnabled)
      localStorage.setItem('hints_enabled', 'enabled');
    else
      localStorage.setItem('hints_enabled', 'disabled');
  }

  updateLanguage(ev: LanguageUpdate) {
    this.selectedLanguage = ev.language;
    this.supportsFormatting = ev.supportsFormatting;
  }

  startDragging(ev: MouseEvent) {
    if (this.bottomBarCollapsed) {
      return;
    }
    this.isDragging = true;
    this.lastClientY = ev.clientY;
  }

  stopDragging() {
    this.isDragging = false;
  }

  keepDragging(ev: MouseEvent) {
    if (this.isDragging) {
      const diff = this.lastClientY - ev.clientY;
      this.lastClientY = ev.clientY;
      this.bottomBarHeight += diff;
      this.editorHeight -= diff;

      if (this.editorHeight < 200) {
        this.editorHeight = 200;
        this.bottomBarHeight = this.fullHeight - this.editorHeight;
      }
      if (this.bottomBarHeight < 300) {
        this.bottomBarHeight = 300;
        this.editorHeight = this.fullHeight - this.bottomBarHeight;
      }

      this.renderer.setStyle(this.editorContainer.nativeElement, 'height', `${this.editorHeight}px`);
      this.renderer.setStyle(this.bottomBar.nativeElement, 'height', `${this.bottomBarHeight}px`);

      this.inputEditor.OnResize();
      this.outputEditor.OnResize();
    }
  }

  toggleCollapse() {
    if (this.bottomBarCollapsed) {
      this.renderer.setStyle(this.bottomBar.nativeElement, 'height', `${this.bottomBarHeight}px`);
      this.resizeHandleCursor = 'ns-resize';
      this.renderer.setStyle(this.editorContainer.nativeElement, 'height', `${this.editorHeight}px`);
    } else {
      this.renderer.setStyle(this.bottomBar.nativeElement, 'height', `75px`);
      this.resizeHandleCursor = '';
      this.renderer.setStyle(this.editorContainer.nativeElement, 'height', `${this.fullHeight - 75}px`);
    }

    this.bottomBarCollapsed = !this.bottomBarCollapsed;
  }

  stdoutClicked() {
    this.stdoutActive = true;
    this.stderrActive = false;
  }

  stderrClicked() {
    this.stdoutActive = false;
    this.stderrActive = true;
  }
}

