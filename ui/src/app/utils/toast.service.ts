import { Injectable } from '@angular/core';

export type Toast = {
  header: string
  body: string
  delay?: number
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor() { }

  toasts: Toast[] = [];

  show(header: string, body: string, delay?: number) {
    this.toasts.push({
      header: header,
      body: body,
      delay: delay,
    });
  }

  remove(toast: Toast) {
    this.toasts = this.toasts.filter(t => t != toast);
  }
}
