import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonacoEditorComponent } from './monaco-editor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, Renderer2 } from '@angular/core';
import { ApiService, EditResponse, GetSessionResponse, User } from '../api.service';
import { EditorService } from './editor.service';
import { MonacoEditorService } from './monaco-editor.service';
import { ThemeService } from '../utils/theme.service';
import { Observable, of } from 'rxjs';
import { AppRoutingModule } from '../app-routing.module';
import { RouterTestingModule } from '@angular/router/testing';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute } from '@angular/router';

@Component({
  template: `
  <div style="height: 500px">
    <app-monaco-editor (editorCreated)="onEditorInitialized()">
    </app-monaco-editor>
  </div>
`
})
class TestHostComponent {
  editorInitializedPromise: Promise<boolean>
  editorInitializedResolve!: (val: boolean) => void

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
  let editorService: EditorService;
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
    editorService.SetText(testText(5));
    editorService.UpdateCursors(generateCursors());
    editorService.editor!.setSelection({
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

  beforeEach(() => {
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
    editorService = fixture.debugElement.injector.get(EditorService);
    monacoEditorService = fixture.debugElement.injector.get(MonacoEditorService);
    themeService = fixture.debugElement.injector.get(ThemeService);

    monacoEditorService.load();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('colors presentation dark', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap-dark');

    await component.editorInitializedPromise;

    themeService.setDarkThemeEnabled(true);
    editorService.SetTheme('vs-dark');
    fillEditor();

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 100));
  });

  it('colors presentation light', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap');

    await component.editorInitializedPromise;

    themeService.setDarkThemeEnabled(false);
    editorService.SetText(testText(5));
    editorService.SetTheme('vs');
    fillEditor();

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 100));
  });
});
