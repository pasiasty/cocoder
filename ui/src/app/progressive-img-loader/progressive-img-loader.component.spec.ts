import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressiveImgLoaderComponent } from './progressive-img-loader.component';

describe('ProgressiveImgLoaderComponent', () => {
  let component: ProgressiveImgLoaderComponent;
  let fixture: ComponentFixture<ProgressiveImgLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProgressiveImgLoaderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressiveImgLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
