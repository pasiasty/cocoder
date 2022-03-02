import { ComponentFixture, flush, TestBed } from '@angular/core/testing';

import { SessionViewComponent } from './session-view.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppRoutingModule } from '../app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { Renderer2, Type } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { EditorService } from '../editor.service';
import { ToastsContainerComponent } from '../toasts-container/toasts-container.component';
import { ApiService, EditResponse, GetSessionResponse, User } from '../api.service';
import { ThemeService } from '../theme.service';

describe('SessionViewComponent', () => {
  let component: SessionViewComponent;
  let fixture: ComponentFixture<SessionViewComponent>;
  let renderer2: Renderer2;
  let editorService: EditorService;
  let themeService: ThemeService;
  let sessionObservable: Observable<EditResponse>;

  let testText = `def something():
  return [el for el in 'abc']
  
  this_is_yet_another_line_of_code
  this_is_yet_another_line_of_code
  this_is_yet_another_line_of_code
  this_is_yet_another_line_of_code
  this_is_yet_another_line_of_code
  `

  const apiServiceSpy = jasmine.createSpyObj('ApiService', [
    'GetSession',
    'SetSessionID',
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
        MonacoEditorModule.forRoot(),
      ],
      declarations: [
        SessionViewComponent,
        TopBarComponent,
        ToastsContainerComponent,
      ],
      providers: [
        Renderer2,
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

    fixture = TestBed.createComponent(SessionViewComponent);
    component = fixture.componentInstance;
    renderer2 = fixture.debugElement.injector.get(Renderer2);
    editorService = fixture.debugElement.injector.get(EditorService);
    themeService = fixture.debugElement.injector.get(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('colors presentation dark', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap-dark');

    await component.editorInitialized();

    themeService.setDarkThemeEnabled(true);
    editorService.SetText(testText);
    editorService.SetTheme('vs-dark');
    editorService.UpdateCursors(generateCursors());

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 500));
  });

  it('colors presentation light', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap');

    await component.editorInitialized();

    themeService.setDarkThemeEnabled(false);
    editorService.SetText(testText);
    editorService.SetTheme('vs');
    editorService.UpdateCursors(generateCursors());

    fixture.detectChanges();

    await new Promise(f => setTimeout(f, 3000));
  });
});

function generateCursors(): User[] {
  const firstUserPosition = 59;
  const selectionStartAddition = 5;
  const selectionEndAddition = 14;
  const userOffset = 36;

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

