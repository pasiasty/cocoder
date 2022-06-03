import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Title } from '@angular/platform-browser';
import { ApiService } from '../api.service';

import * as monaco from 'monaco-editor';
import { GoogleAnalyticsService } from '../utils/google-analytics.service';
import { ClipboardService } from 'ngx-clipboard';
import { ToastService } from '../utils/toast.service';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss'],
})
export class SessionViewComponent implements OnInit {
  sessionInvalid = false;
  selectedLanguage!: string;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");

  hintsEnabled = true;

  @ViewChild(MonacoEditorComponent)
  monacoEditorComponent!: MonacoEditorComponent;


  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private apiService: ApiService,
    private cdRef: ChangeDetectorRef,
    private googleAnalyticsService: GoogleAnalyticsService,
    private clipboardService: ClipboardService,
    private toastService: ToastService) {
    const enabledString = localStorage.getItem('hints_enabled');
    if (enabledString === 'disabled') {
      this.hintsEnabled = false;
    } else {
      this.hintsEnabled = true;
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.apiService.StartSession(params.session_id);
      this.titleService.setTitle('coCoder ' + params.session_id.substring(params.session_id.length - 6));
    })
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  onLanguageChange(val: string) {
    this.selectedLanguage = val;
    this.apiService.updateLanguage(val);
    this.monacoEditorComponent.SetLanguage(val);
    this.googleAnalyticsService.event('language_change', 'engagement', 'top_bar', val);
  }

  downloadButtonClicked(): void {
    this.monacoEditorComponent.saveContent();
    this.googleAnalyticsService.event('download_content', 'engagement', 'top_bar');
  }

  shareButtonClicked(): void {
    this.clipboardService.copy(window.location.href);
    this.toastService.show("", "Copied session URL to clipboard");
    this.googleAnalyticsService.event('share_button', 'engagement', 'top_bar');
  }

  zoomInButtonClicked(): void {
    this.monacoEditorComponent.updateFontSize(1);
    this.googleAnalyticsService.event('zoom', 'engagement', 'top_bar', 'increase');
  }

  zoomOutButtonClicked(): void {
    this.monacoEditorComponent.updateFontSize(-1);
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

}

