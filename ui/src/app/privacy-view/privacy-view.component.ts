import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { TopBarComponent } from '../top-bar/top-bar.component';

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
