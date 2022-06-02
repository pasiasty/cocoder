import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Title } from '@angular/platform-browser';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-session-view',
  templateUrl: './session-view.component.html',
  styleUrls: ['./session-view.component.scss'],
})
export class SessionViewComponent implements OnInit {
  sessionInvalid = false;

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private apiService: ApiService) {
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.apiService.StartSession(params.session_id);
      this.titleService.setTitle('coCoder ' + params.session_id.substring(params.session_id.length - 6));
    })
  }
}

