import { TestBed } from '@angular/core/testing';

import { ApiService } from './api.service';

import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
      ],
    });
    service = TestBed.inject(ApiService);
    service.SetSessionID("abc");
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
