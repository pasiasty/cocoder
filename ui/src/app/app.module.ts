import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BrowserModule } from '@angular/platform-browser';

import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SessionViewComponent } from './session-view/session-view.component';
import { HomeComponent } from './home/home.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { CookieService } from 'ngx-cookie-service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { TopBarComponent } from './top-bar/top-bar.component';
import { FileSaverModule } from 'ngx-filesaver';
import { ClipboardModule } from 'ngx-clipboard';
import { ToastsContainerComponent } from './toasts-container/toasts-container.component';
import { ProgressiveImgLoaderComponent } from './progressive-img-loader/progressive-img-loader.component';
import { MonacoEditorComponent } from './monaco-editor/monaco-editor.component';
import { PrivacyViewComponent } from './privacy-view/privacy-view.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 's/:session_id', component: SessionViewComponent },
  { path: 's/:session_id/', component: SessionViewComponent },
  { path: 'privacy/', component: PrivacyViewComponent },
  { path: 'privacy', component: PrivacyViewComponent },
  { path: '**', component: PageNotFoundComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    SessionViewComponent,
    HomeComponent,
    PageNotFoundComponent,
    TopBarComponent,
    ToastsContainerComponent,
    ProgressiveImgLoaderComponent,
    MonacoEditorComponent,
    PrivacyViewComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    NgbModule,
    FileSaverModule,
    ClipboardModule,
  ],
  exports: [RouterModule],
  providers: [CookieService],
  bootstrap: [AppComponent]
})
export class AppModule { }
