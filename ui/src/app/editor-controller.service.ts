import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EditorControllerService {

  selectedLanguage: string;
  languageSelection: BehaviorSubject<string>;
  saveTriggers: Subject<null>;
  fontUpdate: Subject<number>;
  hintsTriggers: Subject<boolean>;
  hintsEnabled: boolean;

  constructor() {
    this.selectedLanguage = 'plaintext';
    this.languageSelection = new BehaviorSubject<string>(this.selectedLanguage);
    this.saveTriggers = new Subject<null>();
    this.fontUpdate = new Subject<number>();
    this.hintsTriggers = new Subject<boolean>();

    const enabledString = localStorage.getItem('hints_enabled');
    if (enabledString === 'disabled') {
      this.hintsEnabled = false;
    } else {
      this.hintsEnabled = true;
    }
  }

  languageChanges(): Observable<string> {
    return this.languageSelection.asObservable();
  }

  setLanguage(val: string) {
    if (val !== this.selectedLanguage) {
      this.languageSelection.next(val);
    }
    this.selectedLanguage = val;
  }

  saveContent() {
    this.saveTriggers.next(null);
  }

  saveTriggersObservable(): Observable<null> {
    return this.saveTriggers.asObservable();
  }

  updateFontSize(n: number) {
    this.fontUpdate.next(n);
  }

  fontUpdates(): Observable<number> {
    return this.fontUpdate.asObservable();
  }

  toggleHints(): void {
    this.hintsEnabled = !this.hintsEnabled;
    if (this.hintsEnabled)
      localStorage.setItem('hints_enabled', 'enabled');
    else
      localStorage.setItem('hints_enabled', 'disabled');

    this.hintsTriggers.next(this.hintsEnabled);
  }

  hintsAreEnabled(): boolean {
    return this.hintsEnabled;
  }

  toggleHintsObservable(): Observable<boolean> {
    return this.hintsTriggers.asObservable();
  }
}
