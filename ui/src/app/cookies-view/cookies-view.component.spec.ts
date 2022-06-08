import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TopBarComponent } from 'src/app/top-bar/top-bar.component';

import { CookiesViewComponent } from './cookies-view.component';

describe('CookiesViewComponent', () => {
  let component: CookiesViewComponent;
  let fixture: ComponentFixture<CookiesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
      ],
      declarations: [
        CookiesViewComponent,
        TopBarComponent,
      ],
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
