import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScrollingService {

  scrollSelection: BehaviorSubject<string>;

  constructor() {
    this.scrollSelection = new BehaviorSubject<string>("");
  }

  scrollChanges(): Observable<string> {
    return this.scrollSelection.asObservable();
  }

  scrollTo(target: string) {
    this.scrollSelection.next(target);
  }
}
