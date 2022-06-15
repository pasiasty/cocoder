import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionViewComponent } from './session-view.component';

import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TopBarComponent } from 'src/app/top-bar/top-bar.component';
import { Component, Renderer2 } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ToastsContainerComponent } from 'src/app/toasts-container/toasts-container.component';
import { MonacoEditorService } from 'src/app/monaco-editor/monaco-editor.service';
import { MonacoEditorComponent } from 'src/app/monaco-editor/monaco-editor.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

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



