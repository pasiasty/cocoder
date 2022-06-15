import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HighlightableButtonComponent } from './highlightable-button.component';

describe('HighlightableButtonComponent', () => {
  let component: HighlightableButtonComponent;
  let fixture: ComponentFixture<HighlightableButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HighlightableButtonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HighlightableButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
