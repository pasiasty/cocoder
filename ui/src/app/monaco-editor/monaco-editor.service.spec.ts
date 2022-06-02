import { TestBed } from '@angular/core/testing';

import { MonacoEditorService } from './monaco-editor.service';

describe('MonacoEditorService', () => {
  let service: MonacoEditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MonacoEditorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
