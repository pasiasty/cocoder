import { Component, OnInit, Renderer2 } from '@angular/core';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'coCoder';
  lightThemeClass = 'bootstrap';
  darkThemeClass = 'bootstrap-dark';

  constructor(private themeService: ThemeService, private renderer: Renderer2) { }

  ngOnInit(): void {
    if (this.themeService.isDarkThemeEnabled()) {
      this.renderer.addClass(document.body, this.darkThemeClass);
    } else {
      this.renderer.addClass(document.body, this.lightThemeClass);
    }

    this.themeService.themeChanges().subscribe(darkModeEnabled => {
      if (darkModeEnabled) {
        this.renderer.removeClass(document.body, this.lightThemeClass);
        this.renderer.addClass(document.body, this.darkThemeClass);
      } else {
        this.renderer.removeClass(document.body, this.darkThemeClass);
        this.renderer.addClass(document.body, this.lightThemeClass);
      }
    });
  }
}
