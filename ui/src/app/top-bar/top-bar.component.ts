import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EditorControllerService } from '../editor-controller.service';
import { ThemeService } from '../theme.service';
import * as monaco from 'monaco-editor';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent implements OnInit {
  selectedLanguage!: string;

  languages = new Array("plaintext", "python", "java", "go", "cpp", "c", "r");

  constructor(
    private themeService: ThemeService,
    private cdRef: ChangeDetectorRef,
    private editorControllerService: EditorControllerService) { }

  ngOnInit(): void {
    this.editorControllerService.languageChanges().subscribe(val => {
      this.selectedLanguage = val;
      this.cdRef.detectChanges();
    });
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

  }

  donateButtonClicked(): void {

  }

  downloadButtonClicked(): void {

  }

  shareButtonClicked(): void {

  }

  zoomInButtonClicked(): void {

  }

  zoomOutButtonClicked(): void {

  }
}
