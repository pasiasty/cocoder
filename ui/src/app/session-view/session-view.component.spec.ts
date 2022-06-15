import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionViewComponent } from './session-view.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TopBarComponent } from 'src/app/top-bar/top-bar.component';
import { Component, Renderer2 } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ToastsContainerComponent } from 'src/app/toasts-container/toasts-container.component';
import { MonacoEditorService } from 'src/app/monaco-editor/monaco-editor.service';
import { MonacoEditorComponent } from 'src/app/monaco-editor/monaco-editor.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ApiService, EditResponse, GetSessionResponse, User } from '../services/api.service';

@Component({
  template: `
  <div style="height: 500px">
    <app-session-view>
    </app-session-view>
  </div>`
})
class TestHostComponent {
}

describe('SessionViewComponent', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let sessionObservable: Observable<EditResponse>;
  let monacoEditorService: MonacoEditorService;
  let renderer2: Renderer2;

  const apiServiceSpy = jasmine.createSpyObj('ApiService', [
    'GetSession',
    'StartSession',
    'GetUserID',
    'UpdateSession',
    'SessionObservable',
    'openLSPWebsocket',
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppRoutingModule,
        RouterTestingModule,
        HttpClientTestingModule,
        NgbModule,
        BrowserAnimationsModule,
      ],
      declarations: [
        TestHostComponent,
        SessionViewComponent,
        ToastsContainerComponent,
        TopBarComponent,
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
      resolve({ Language: "python", Text: "aaa", InputText: "", Stdout: "", Stderr: "" });
    }));
    apiServiceSpy.SessionObservable.and.returnValue(sessionObservable);
    apiServiceSpy.GetUserID.and.returnValue('user-id');
    apiServiceSpy.UpdateSession.and.callFake((baseText: string, newText: string, cursorPos: number, otherUsers: User[], selection?: Selection) => {
      console.log('Called UpdateSession');
    });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    monacoEditorService = fixture.debugElement.injector.get(MonacoEditorService);
    renderer2 = fixture.debugElement.injector.get(Renderer2);

    renderer2.removeClass(document.body, 'bootstrap');
    renderer2.addClass(document.body, 'bootstrap-dark');

    monacoEditorService.load();
    fixture.detectChanges();
  });

  it('should create', async () => {
    expect(component).toBeTruthy();

    // workaround until session view correctly reports that all editors were created properly.
    await new Promise(f => setTimeout(f, 1000));
  });
});



