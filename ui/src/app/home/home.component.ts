import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { retry } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { ScrollingService } from '../scrolling.service';
import { Subscription } from 'rxjs';

type ExampleUsage = {
  header: string
  text: string
  img: string
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {

  exampleUsages: ExampleUsage[] = [
    {
      header: "Instant code experimentation",
      text: "This tool will allow you to prototype a simple program within seconds. It's just one click away.",
      img: "/assets/code.jpg",
    },
    {
      header: "Collaboration",
      text: "You can use this website as a perfect solution for pair programming. No more resolution issues caused by screen sharing!",
      img: "/assets/collaboration.jpg",
    },
    {
      header: "Technical interview preparation",
      text: "coCoder will help you prepare for technical job interviews. You can just create a session with your friend and you're good to go.",
      img: "/assets/job-interview.jpg",
    },
  ];

  @ViewChild('home')
  homeElement?: ElementRef;

  @ViewChild('about')
  aboutElement?: ElementRef;

  @ViewChild('faq')
  faqElement?: ElementRef;

  @ViewChild('contact')
  contactElement?: ElementRef;

  scrollingSubscription?: Subscription;
  fragmentSubscription?: Subscription;

  constructor(
    private router: Router,
    private httpClient: HttpClient,
    private titleService: Title,
    private scrollingService: ScrollingService,
    private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.titleService.setTitle('coCoder');

    this.scrollingSubscription = this.scrollingService.scrollChanges().subscribe({
      next: val => {
        this.scrollToEl(val);
      },
    })
  }

  ngAfterViewInit(): void {
    this.fragmentSubscription = this.route.fragment.subscribe({
      next: fragment => {
        if (fragment !== null) {
          this.scrollToEl(fragment);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.scrollingSubscription?.unsubscribe();
    this.fragmentSubscription?.unsubscribe();
  }

  scrollToEl(el: string) {
    switch (el) {
      case "home":
        this.homeElement?.nativeElement.scrollIntoView();
        break;
      case "about":
        this.aboutElement?.nativeElement.scrollIntoView();
        break;
      case "faq":
        this.faqElement?.nativeElement.scrollIntoView();
        break;
      case "contact":
        this.contactElement?.nativeElement.scrollIntoView();
        break;
    }
  }

  newSession(): void {

    this.httpClient.get<string>(environment.api + 'new_session').pipe(
      retry(3)
    ).subscribe((data) => {
      this.router.navigate(['/s/', data]);
    })
  }

}
