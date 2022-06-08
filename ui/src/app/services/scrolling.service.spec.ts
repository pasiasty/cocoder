import { TestBed } from '@angular/core/testing';

import { ScrollingService } from './scrolling.service';

describe('ScrollingService', () => {
  let service: ScrollingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScrollingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
