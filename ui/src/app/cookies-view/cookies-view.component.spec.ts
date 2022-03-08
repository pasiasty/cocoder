import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CookiesViewComponent } from './cookies-view.component';

describe('CookiesViewComponent', () => {
  let component: CookiesViewComponent;
  let fixture: ComponentFixture<CookiesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CookiesViewComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CookiesViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
