import { ChangeDetectorRef, Component, Input, OnInit, ViewChild } from '@angular/core';
import { EditorControllerService } from '../editor-controller.service';
import { ThemeService } from '../theme.service';
import * as monaco from 'monaco-editor';
import { ScrollingService } from '../scrolling.service';
import { ClipboardService } from 'ngx-clipboard'
import { ToastService } from '../toast.service';
import { NgbNav } from '@ng-bootstrap/ng-bootstrap';
import { GoogleAnalyticsService } from '../google-analytics.service';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent implements OnInit {
  selectedLanguage!: string;
  _editorMode = false;
  _homeMode = false;
  showToast = false;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");

  @ViewChild(NgbNav)
  navigation?: NgbNav

  links = [
    { title: 'About', fragment: 'about' },
    { title: 'FAQ', fragment: 'faq' },
    { title: 'Contact', fragment: 'contact' },
  ];

  constructor(
    private themeService: ThemeService,
    private cdRef: ChangeDetectorRef,
    private editorControllerService: EditorControllerService,
    private scrollingService: ScrollingService,
    private clipboardService: ClipboardService,
    private toastService: ToastService,
    private googleAnalyticsService: GoogleAnalyticsService) { }

  ngOnInit(): void {
    this.editorControllerService.languageChanges().subscribe(val => {
      this.selectedLanguage = val;
      this.cdRef.detectChanges();
    });
  }

  @Input()
  set editorMode(param: string) {
    this._editorMode = true;
  }

  @Input()
  set homeMode(param: string) {
    this._homeMode = true;
  }

  isDarkThemeEnabled(): boolean {
    return this.themeService.isDarkThemeEnabled();
  }

  otherLanguages(): string[] {
    return monaco.languages.getLanguages().map((v, _) => v.id).filter(v => !this.languages.includes(v));
  }

  onLanguageChange(val: string) {
    this.editorControllerService.setLanguage(val);
    this.googleAnalyticsService.event('language_change', 'engagement', 'top_bar', val);
  }

  themeButtonClicked(): void {
    this.themeService.toggleTheme();
    this.cdRef.detectChanges();
    this.googleAnalyticsService.event('theme_change', 'engagement', 'top_bar', this.themeService.isDarkThemeEnabled() ? 'dark' : 'light');
  }

  bugButtonClicked(): void {
    window.open("https://github.com/pasiasty/cocoder/issues", "_blank");
    this.googleAnalyticsService.event('bug_report', 'engagement', 'top_bar');
  }

  donateButtonClicked(): void {
    window.open("https://paypal.me/coCoderFund", "_blank");
    this.googleAnalyticsService.event('donate', 'engagement', 'top_bar');
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

  navClicked(val: string): void {
    this.scrollingService.scrollTo(val);

    if (val === 'home') {
      this.navigation?.select(null);
    }
    this.googleAnalyticsService.event('navigation', 'engagement', 'top_bar', val);
  }
}
