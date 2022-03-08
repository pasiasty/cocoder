import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-cookies-view',
  templateUrl: './cookies-view.component.html',
  styleUrls: ['./cookies-view.component.scss']
})
export class CookiesViewComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    window.scrollTo(0, 0);
  }

}
