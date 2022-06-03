import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { ThemeService } from '../utils/theme.service';
import { GoogleAnalyticsService } from '../utils/google-analytics.service';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent {

  @Output() logoClicked = new EventEmitter<void>();

  constructor(
    private themeService: ThemeService,
    private cdRef: ChangeDetectorRef,
    private googleAnalyticsService: GoogleAnalyticsService) { }

  isDarkThemeEnabled(): boolean {
    return this.themeService.isDarkThemeEnabled();
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

  logoButtonClicked(): void {
    this.logoClicked.emit();
  }
}
