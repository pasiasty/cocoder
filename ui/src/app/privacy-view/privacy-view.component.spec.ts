import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TopBarComponent } from '../top-bar/top-bar.component';

import { PrivacyViewComponent } from './privacy-view.component';

describe('PrivacyViewComponent', () => {
  let component: PrivacyViewComponent;
  let fixture: ComponentFixture<PrivacyViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
      ],
      declarations: [
        PrivacyViewComponent,
        TopBarComponent,
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PrivacyViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
