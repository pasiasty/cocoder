import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrivacyViewComponent } from './privacy-view.component';

describe('PrivacyViewComponent', () => {
  let component: PrivacyViewComponent;
  let fixture: ComponentFixture<PrivacyViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PrivacyViewComponent ]
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
