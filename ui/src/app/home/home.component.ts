import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { retry } from 'rxjs/operators';

type NewSessionResponse = {
  sessionID: string
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(private router: Router, private httpClient: HttpClient) { }

  ngOnInit(): void {
  }

  newSession(): void {

    this.httpClient.get<NewSessionResponse>(environment.api + '/new_session').pipe(
      retry(3)
    ).subscribe((data) => {
      this.router.navigate(['/', data.sessionID]);
    })
  }

}
