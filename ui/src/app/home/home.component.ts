import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ScrollingService } from '../utils/scrolling.service';
import { Subscription } from 'rxjs';
import { Analytics } from 'aws-amplify';
import { GoogleAnalyticsService } from '../utils/google-analytics.service';
import { ToastService } from '../utils/toast.service';
import { NgbNav } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../api.service';

type ExampleUsage = {
  header: string
  text: string
  img: string
  imgMin: string
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(NgbNav)
  navigation?: NgbNav

  links = [
    { title: 'About', fragment: 'about' },
    { title: 'FAQ', fragment: 'faq' },
    { title: 'Contact', fragment: 'contact' },
  ];

  exampleUsages: ExampleUsage[] = [
    {
      header: "Instant code experimentation",
      text: "This tool will allow you to prototype a simple program within seconds. It's just one click away.",
      img: "/assets/code.jpg",
      imgMin: "/assets/code-min.jpg",
    },
    {
      header: "Collaboration",
      text: "You can use this website as a perfect solution for pair programming. No more resolution issues caused by screen sharing!",
      img: "/assets/collaboration.jpg",
      imgMin: "/assets/collaboration-min.jpg",
    },
    {
      header: "Technical interview preparation",
      text: "coCoder will help you prepare for technical job interviews. You can just create a session with your friend and you're good to go.",
      img: "/assets/job-interview.jpg",
      imgMin: "/assets/job-interview-min.jpg",
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
    private apiService: ApiService,
    private titleService: Title,
    private scrollingService: ScrollingService,
    private route: ActivatedRoute,
    private googleAnalyticsService: GoogleAnalyticsService,
    private toastService: ToastService) { }

  ngOnInit(): void {
    this.titleService.setTitle('coCoder');

    this.scrollingSubscription = this.scrollingService.scrollChanges().subscribe({
      next: val => {
        this.scrollToEl(val);
      },
    })

    const bannerShown = localStorage.getItem('policy_banner_shown');
    if (bannerShown !== 'true') {
      this.toastService.show('', 'By using this website you agree to our <a href="/cookies">Cookies</a> and <a href="/privacy">Privacy</a> policies.', 15000);
      localStorage.setItem('policy_banner_shown', 'true');
    }
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

  navClicked(val: string): void {
    this.scrollingService.scrollTo(val);

    if (val === 'home') {
      this.navigation?.select(null);
    }
    this.googleAnalyticsService.event('navigation', 'engagement', 'top_bar', val);
  }

  scrollToEl(el: string) {
    switch (el) {
      case "home":
        this.homeElement?.nativeElement.scrollIntoView({ behavior: "smooth" });
        break;
      case "about":
        this.aboutElement?.nativeElement.scrollIntoView({ behavior: "smooth" });
        break;
      case "faq":
        this.faqElement?.nativeElement.scrollIntoView({ behavior: "smooth" });
        break;
      case "contact":
        this.contactElement?.nativeElement.scrollIntoView({ behavior: "smooth" });
        break;
    }
  }

  newSession(): void {
    this.googleAnalyticsService.event('new_session', 'engagement', 'home');
    Analytics.record({ name: 'newSession' });

    this.apiService.NewSession().then(sessionID => {
      this.router.navigate(['/s/', sessionID]);
    });
  }

}
