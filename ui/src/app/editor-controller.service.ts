import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EditorControllerService {

  selectedLanguage: string;
  languageSelection: BehaviorSubject<string>;

  constructor() {
    this.selectedLanguage = 'plaintext';
    this.languageSelection = new BehaviorSubject<string>(this.selectedLanguage);
  }

  languageChanges(): Observable<string> {
    return this.languageSelection.asObservable();
  }

  setLanguage(val: string) {
    this.selectedLanguage = val;
    this.languageSelection.next(val);
  }
}
