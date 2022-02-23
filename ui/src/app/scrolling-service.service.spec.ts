import { TestBed } from '@angular/core/testing';

import { ScrollingServiceService } from './scrolling-service.service';

describe('ScrollingServiceService', () => {
  let service: ScrollingServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScrollingServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
