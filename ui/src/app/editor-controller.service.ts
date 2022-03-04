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

  constructor() {
    this.selectedLanguage = 'plaintext';
    this.languageSelection = new BehaviorSubject<string>(this.selectedLanguage);
    this.saveTriggers = new Subject<null>();
    this.fontUpdate = new Subject<number>();
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
}
