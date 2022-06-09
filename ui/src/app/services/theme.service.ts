import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  darkThemeEnabled: boolean;
  themeSelection: BehaviorSubject<boolean>;

  constructor() {
    const theme = localStorage.getItem('theme');
    if (theme == 'light') {
      this.darkThemeEnabled = false;
    } else {
      this.darkThemeEnabled = true;
    }
    this.themeSelection = new BehaviorSubject<boolean>(this.darkThemeEnabled);
  }

  isDarkThemeEnabled(): boolean {
    return this.darkThemeEnabled;
  }

  setDarkThemeEnabled(enabled: boolean) {
    if (this.darkThemeEnabled != enabled) {
      this.toggleTheme();
    }
  }

  toggleTheme() {
    this.darkThemeEnabled = !this.darkThemeEnabled;
    if (this.darkThemeEnabled) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
    this.themeSelection.next(this.darkThemeEnabled);
  }

  themeChanges(): Observable<boolean> {
    return this.themeSelection.asObservable();
  }

  editorThemeName(): string {
    if (this.darkThemeEnabled) {
      return 'vs-dark';
    }
    return 'vs';
  }
}
