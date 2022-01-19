import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, retry } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  constructor(private router: Router, private httpClient: HttpClient, private titleService: Title) { }

  ngOnInit(): void {
    this.titleService.setTitle('coCoder');
  }

  newSession(): void {

    this.httpClient.get<string>(environment.api + 'new_session').pipe(
      retry(3)
    ).subscribe((data) => {
      this.router.navigate(['/s/', data]);
    })
  }

}
