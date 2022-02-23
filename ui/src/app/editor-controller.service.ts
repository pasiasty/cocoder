import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EditorControllerService {

  selectedLanguage: string;
  languageSelection: BehaviorSubject<string>;
  saveTriggers: Subject<null>;

  constructor() {
    this.selectedLanguage = 'plaintext';
    this.languageSelection = new BehaviorSubject<string>(this.selectedLanguage);
    this.saveTriggers = new Subject<null>();
  }

  languageChanges(): Observable<string> {
    return this.languageSelection.asObservable();
  }

  setLanguage(val: string) {
    this.selectedLanguage = val;
    this.languageSelection.next(val);
  }

  saveContent() {
    this.saveTriggers.next(null);
  }

  saveTriggersObservable(): Observable<null> {
    return this.saveTriggers.asObservable();
  }
}
