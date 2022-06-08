import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TopBarComponent } from 'src/app/top-bar/top-bar.component';
import { ProgressiveImgLoaderComponent } from 'src/app/progressive-img-loader/progressive-img-loader.component';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { Renderer2, Type } from '@angular/core';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let renderer2: Renderer2;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppRoutingModule,
        RouterTestingModule,
        HttpClientTestingModule,
        NgbModule,
      ],
      declarations: [
        HomeComponent,
        TopBarComponent,
        ProgressiveImgLoaderComponent,
      ],
      providers: [Renderer2],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeComponent);
    renderer2 = fixture.componentRef.injector.get<Renderer2>(Renderer2 as Type<Renderer2>);
    component = fixture.componentInstance;
    renderer2.addClass(document.body, 'bootstrap-dark');
    fixture.detectChanges();
  });

  it('should create', async () => {
    expect(component).toBeTruthy();
    await new Promise(f => setTimeout(f, 500));
  });
});
