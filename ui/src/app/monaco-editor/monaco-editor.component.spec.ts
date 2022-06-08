import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonacoEditorComponent } from './monaco-editor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, Renderer2, ViewChild } from '@angular/core';
import { ApiService, EditResponse, GetSessionResponse, User } from 'src/app/services/api.service';
import { MonacoEditorService } from './monaco-editor.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Observable, of } from 'rxjs';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { RouterTestingModule } from '@angular/router/testing';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute } from '@angular/router';

import * as monaco from 'monaco-editor';

@Component({
  template: `
  <div style="height: 500px; display: flex">
    <app-monaco-editor style="width: 100%; height: 500px" (editorCreated)="onEditorInitialized()">
    </app-monaco-editor>
  </div>
`
})
class TestHostComponent {
  editorInitializedPromise: Promise<boolean>
  editorInitializedResolve!: (val: boolean) => void

  @ViewChild(MonacoEditorComponent) monacoEditorComponent!: MonacoEditorComponent;

  constructor() {
    this.editorInitializedPromise = new Promise<boolean>((resolve, _) => {
      this.editorInitializedResolve = resolve;
    });
  }

  onEditorInitialized() {
    this.editorInitializedResolve(true);
  }
}

describe('MonacoEditorComponent', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  let renderer2: Renderer2;
  let monacoEditorService: MonacoEditorService;
  let themeService: ThemeService;
  let sessionObservable: Observable<EditResponse>;

  let textPreamble = `# some comment
  
def something(): # local selection
  return [el for el in 'abc']
  
`;

  function sampleLine(idx: number): string {
    return `this_is_yet_another_line_of_code # this is user ${idx} selection`
  }

  function testText(numUsers: number): string {
    let res = textPreamble;

    for (let i = 0; i < numUsers; i++)
      res += sampleLine(i) + '\n';

    return res;
  }

  function generateCursors(): User[] {
    const firstUserPosition = textPreamble.length + 8;
    const selectionStartAddition = 5;
    const selectionEndAddition = 16;
    const userOffset = sampleLine(0).length + 2;

    const res: User[] = [];

    for (let i = 0; i < 5; i++) {
      res.push({
        ID: "some-id",
        Index: i,
        HasSelection: false,
        Position: firstUserPosition + i * userOffset,
        SelectionStart: 0,
        SelectionEnd: 0,
      });

      res.push({
        ID: "some-id",
        Index: i,
        HasSelection: true,
        Position: 0,
        SelectionStart: firstUserPosition + selectionStartAddition + i * userOffset,
        SelectionEnd: firstUserPosition + selectionEndAddition + i * userOffset,
      })
    }

    return res;
  }

  function fillEditor() {
    component.monacoEditorComponent.SetText(testText(5));
    component.monacoEditorComponent.UpdateCursors(generateCursors());
    component.monacoEditorComponent._editor!.setSelection({
      startLineNumber: 3,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 14,
    });
  }

  const apiServiceSpy = jasmine.createSpyObj('ApiService', [
    'GetSession',
    'StartSession',
    'GetUserID',
    'UpdateSession',
    'SessionObservable',
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppRoutingModule,
        RouterTestingModule,
        HttpClientTestingModule,
        NgbModule,
      ],
      declarations: [
        TestHostComponent,
        MonacoEditorComponent,
      ],
      providers: [
        Renderer2,
        MonacoEditorService,
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ session_id: "abcdefabcdef" }),
          },
        },
        {
          provide: ApiService,
          useValue: apiServiceSpy,
        }
      ],
    })
      .compileComponents();
  });

  beforeEach(async () => {
    sessionObservable = new Observable<EditResponse>();

    apiServiceSpy.GetSession.and.returnValue(new Promise<GetSessionResponse>((resolve, reject) => {
      resolve({ Language: "python", Text: "aaa" });
    }));
    apiServiceSpy.SessionObservable.and.returnValue(sessionObservable);
    apiServiceSpy.GetUserID.and.returnValue('user-id');
    apiServiceSpy.UpdateSession.and.callFake((baseText: string, newText: string, cursorPos: number, otherUsers: User[], selection?: Selection) => {
      console.log('Called UpdateSession');
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    renderer2 = fixture.debugElement.injector.get(Renderer2);
    monacoEditorService = fixture.debugElement.injector.get(MonacoEditorService);
    themeService = fixture.debugElement.injector.get(ThemeService);

    monacoEditorService.load();
    fixture.detectChanges();

    await component.editorInitializedPromise;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('colors presentation dark', async () => {
    expect(component).toBeTruthy();
    renderer2.removeClass(document.body, 'bootstrap');
    renderer2.addClass(document.body, 'bootstrap-dark');

    themeService.setDarkThemeEnabled(true);
    component.monacoEditorComponent.SetTheme('vs-dark');
    fillEditor();

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 100));
  });

  it('colors presentation light', async () => {
    expect(component).toBeTruthy();
    renderer2.removeClass(document.body, 'bootstrap-dark');
    renderer2.addClass(document.body, 'bootstrap');

    themeService.setDarkThemeEnabled(false);
    component.monacoEditorComponent.SetText(testText(5));
    component.monacoEditorComponent.SetTheme('vs');
    fillEditor();

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 100));
  });

  it('simple new text to operations', async () => {
    component.monacoEditorComponent._editor.setValue('some text was');
    expect(component.monacoEditorComponent.NewTextToOperations('some script was modified')).toEqual([
      {
        range: new monaco.Range(1, 6, 1, 9),
        text: 'scrip',
      },
      {
        range: new monaco.Range(1, 14, 1, 14),
        text: ' modified',
      },
    ]);
  });

  it('complex new text to operations', async () => {
    component.monacoEditorComponent._editor.setValue(`
    this line will be modified
    this line will be the same
    this line will also be modified
    `);
    const newText = `
    this line will really be modified
    this line will be the same
    this line will be modified
    `;

    expect(component.monacoEditorComponent.NewTextToOperations(newText)).toEqual([{
      range: new monaco.Range(2, 20, 2, 20),
      text: 'really ',
    }, {
      range: new monaco.Range(4, 19, 4, 24),
      text: '',
    }]);
  });

  function checkPair(n: number, pos: monaco.Position) {
    expect(component.monacoEditorComponent.numberToPosition(n)).toEqual(pos);
    expect(component.monacoEditorComponent.positionToNumber(pos)).toEqual(n);
  }

  it('cursor and position conversion', async () => {
    component.monacoEditorComponent._editor.setValue(`
something


another thing
and also

this thing
    `);
    checkPair(0, new monaco.Position(1, 1));
    checkPair(1, new monaco.Position(2, 1));
    checkPair(12, new monaco.Position(4, 1));
    checkPair(20, new monaco.Position(5, 8));
    checkPair(36, new monaco.Position(7, 1));
  });
});
