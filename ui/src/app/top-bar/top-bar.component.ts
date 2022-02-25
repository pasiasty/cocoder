import { ChangeDetectorRef, Component, Input, OnInit, ViewChild } from '@angular/core';
import { EditorControllerService } from '../editor-controller.service';
import { ThemeService } from '../theme.service';
import * as monaco from 'monaco-editor';
import { ScrollingService } from '../scrolling.service';
import { ClipboardService } from 'ngx-clipboard'
import { ToastService } from '../toast.service';
import { NgbNav } from '@ng-bootstrap/ng-bootstrap';

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
    private toastService: ToastService) { }

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
  }

  themeButtonClicked(): void {
    this.themeService.toggleTheme();
    this.cdRef.detectChanges();
  }

  bugButtonClicked(): void {
    window.open("https://github.com/pasiasty/cocoder/issues", "_blank");
  }

  donateButtonClicked(): void {
    window.open("https://paypal.me/coCoderDonate", "_blank");
  }

  downloadButtonClicked(): void {
    this.editorControllerService.saveContent();
  }

  shareButtonClicked(): void {
    this.clipboardService.copy(window.location.href);
    this.toastService.show("", "Copied session URL to clipboard");
  }

  zoomInButtonClicked(): void {
    this.editorControllerService.updateFontSize(1);
  }

  zoomOutButtonClicked(): void {
    this.editorControllerService.updateFontSize(-1);
  }

  navClicked(val: string): void {
    this.scrollingService.scrollTo(val);

    if (val === 'home') {
      this.navigation?.select(null);
    }
  }
}
