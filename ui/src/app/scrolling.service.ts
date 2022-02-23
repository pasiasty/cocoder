import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollingService {

  scrollSelection: Subject<string>;

  constructor() {
    this.scrollSelection = new Subject<string>();
  }

  scrollChanges(): Observable<string> {
    return this.scrollSelection.asObservable();
  }

  scrollTo(target: string) {
    this.scrollSelection.next(target);
  }
}
