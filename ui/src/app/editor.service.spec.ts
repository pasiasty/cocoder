import { TestBed } from '@angular/core/testing';

import { EditorService } from './editor.service';

import * as monaco from 'monaco-editor';

fdescribe('EditorService', () => {
  let service: EditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorService);
    service.model.dispose();
    service.model = monaco.editor.createModel('');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('texts to operations', () => {
    service.model.setValue('some text was');
    expect(service.NewTextToOperations('some script was modified')).toEqual([{
      range: new monaco.Range(1, 2, 1, 14),
      text: 'ome script was modified',
    }]);
  })
});
