import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Title } from '@angular/platform-browser';
import { ApiService } from '../api.service';
import { EditorControllerService } from '../monaco-editor/editor-controller.service';

import * as monaco from 'monaco-editor';
import { GoogleAnalyticsService } from '../utils/google-analytics.service';
import { ClipboardService } from 'ngx-clipboard';
import { ToastService } from '../utils/toast.service';

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss'],
})
export class SessionViewComponent implements OnInit {
  sessionInvalid = false;
  selectedLanguage!: string;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private apiService: ApiService,
    private editorControllerService: EditorControllerService,
    private cdRef: ChangeDetectorRef,
    private googleAnalyticsService: GoogleAnalyticsService,
    private clipboardService: ClipboardService,
    private toastService: ToastService) {
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.apiService.StartSession(params.session_id);
      this.titleService.setTitle('coCoder ' + params.session_id.substring(params.session_id.length - 6));
    })

    this.editorControllerService.languageChanges().subscribe(val => {
      this.selectedLanguage = val;
      this.cdRef.detectChanges();
    });
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  onLanguageChange(val: string) {
    this.editorControllerService.setLanguage(val);
    this.googleAnalyticsService.event('language_change', 'engagement', 'top_bar', val);
  }

  downloadButtonClicked(): void {
    this.editorControllerService.saveContent();
    this.googleAnalyticsService.event('download_content', 'engagement', 'top_bar');
  }

  shareButtonClicked(): void {
    this.clipboardService.copy(window.location.href);
    this.toastService.show("", "Copied session URL to clipboard");
    this.googleAnalyticsService.event('share_button', 'engagement', 'top_bar');
  }

  zoomInButtonClicked(): void {
    this.editorControllerService.updateFontSize(1);
    this.googleAnalyticsService.event('zoom', 'engagement', 'top_bar', 'increase');
  }

  zoomOutButtonClicked(): void {
    this.editorControllerService.updateFontSize(-1);
    this.googleAnalyticsService.event('zoom', 'engagement', 'top_bar', 'decrease');
  }

  notificationsTitle(): string {
    return this.areNotificationsEnabled() ? 'Click to disable hints' : 'Click to enable hints';
  }

  areNotificationsEnabled(): boolean {
    return this.editorControllerService.hintsAreEnabled();
  }

  notificationsButtonClicked(): void {
    this.editorControllerService.toggleHints();
    this.cdRef.detectChanges();
  }
}

