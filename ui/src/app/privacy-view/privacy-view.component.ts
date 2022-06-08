import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-privacy-view',
  templateUrl: './privacy-view.component.html',
  styleUrls: ['./privacy-view.component.scss']
})
export class PrivacyViewComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    window.scrollTo(0, 0);
  }
}
