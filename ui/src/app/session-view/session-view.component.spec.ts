import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionViewComponent } from './session-view.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppRoutingModule } from '../app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { Component, Renderer2, Type } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { EditorService } from '../monaco-editor/editor.service';
import { ToastsContainerComponent } from '../toasts-container/toasts-container.component';
import { ApiService, EditResponse, GetSessionResponse, User } from '../api.service';
import { ThemeService } from '../utils/theme.service';
import { MonacoEditorService } from '../monaco-editor/monaco-editor.service';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';

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
        }
      ],
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});



