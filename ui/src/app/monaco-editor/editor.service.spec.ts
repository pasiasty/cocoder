import { TestBed } from '@angular/core/testing';

import { EditorService } from './editor.service';

import * as monaco from 'monaco-editor';

describe('EditorService', () => {
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

  it('simple new text to operations', () => {
    service.model.setValue('some text was');
    expect(service.NewTextToOperations('some script was modified')).toEqual([{
      range: new monaco.Range(1, 2, 1, 14),
      text: 'ome script was modified',
    }]);
  });

  it('complex new text to operations', () => {
    service.model.setValue(`
    this line will be modified
    this line will be the same
    this line will also be modified
    `);
    const newText = `
    this line will really be modified
    this line will be the same
    this line will be modified
    `;

    const t0 = `
    this line will be modif`;

    const t1 = `ine will really be modi`;

    const t2 = `dified
    this line wil`;

    const t3 = `ame
    this lin`;

    const t4 = `be modif`;

    const t5 = "ified\n  ";

    expect(service.NewTextToOperations(newText)).toEqual([{
      range: new monaco.Range(1, 1, 2, 28),
      text: t0,
    }, {
      range: new monaco.Range(2, 11, 2, 27),
      text: t1,
    }, {
      range: new monaco.Range(2, 25, 3, 18),
      text: t2,
    }, {
      range: new monaco.Range(3, 28, 4, 13),
      text: t3,
    }, {
      range: new monaco.Range(4, 20, 4, 33),
      text: t4,
    }, {
      range: new monaco.Range(4, 31, 5, 3),
      text: t5,
    },
    ]);
  });
});
