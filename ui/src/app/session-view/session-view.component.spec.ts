import { ComponentFixture, flush, TestBed } from '@angular/core/testing';

import { SessionViewComponent } from './session-view.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppRoutingModule } from '../app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { Renderer2, Type } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { EditorService } from '../editor.service';
import { ToastsContainerComponent } from '../toasts-container/toasts-container.component';
import { ApiService, GetSessionResponse } from '../api.service';

describe('SessionViewComponent', () => {
  let component: SessionViewComponent;
  let fixture: ComponentFixture<SessionViewComponent>;
  let renderer2: Renderer2;
  let editorService: EditorService;

  const apiServiceSpy = jasmine.createSpyObj('ApiService', ['GetSession', 'SetSessionID']);

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
    apiServiceSpy.GetSession.and.returnValue(new Promise<GetSessionResponse>((resolve, reject) => {
      resolve({ Language: "plaintext", Text: "aaa" });
    }));

    fixture = TestBed.createComponent(SessionViewComponent);
    component = fixture.componentInstance;
    renderer2 = fixture.debugElement.injector.get(Renderer2);
    editorService = fixture.debugElement.injector.get(EditorService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('colors presentation dark', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap-dark');

    fixture.detectChanges();

    editorService.SetText('abc');

    await new Promise(f => setTimeout(f, 3000));
  });

  it('colors presentation light', async () => {
    expect(component).toBeTruthy();
    renderer2.addClass(document.body, 'bootstrap');
    await new Promise(f => setTimeout(f, 1000));
  });
});
