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
    if (theme == 'dark') {
      this.darkThemeEnabled = true;
    } else {
      this.darkThemeEnabled = false;
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
}
