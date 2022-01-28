import { TestBed } from '@angular/core/testing';

import { EditorControllerService } from './editor-controller.service';

describe('EditorControllerService', () => {
  let service: EditorControllerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorControllerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
