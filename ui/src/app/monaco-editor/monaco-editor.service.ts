import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { MonacoLanguageClient, CloseAction, ErrorAction, MonacoServices, MessageTransports } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from '@codingame/monaco-jsonrpc';

import * as monaco from 'monaco-editor';

@Injectable({
  providedIn: 'root'
})
export class MonacoEditorService {

  loaded: boolean = false;

  public loadingFinished: Subject<void> = new Subject<void>();

  constructor() { }

  private finishLoading() {
    this.loaded = true;
    this.registerLanguages();
    this.loadingFinished.next();
  }

  public load() {
    // load the assets

    const baseUrl = './assets' + '/monaco-editor/min/vs';

    if (typeof (<any>window).monaco === 'object') {
      this.finishLoading();
      return;
    }

    const onGotAmdLoader: any = () => {
      // load Monaco
      (<any>window).require.config({ paths: { vs: `${baseUrl}` } });
      (<any>window).require([`vs/editor/editor.main`], () => {
        this.finishLoading();
      });
    };

    // load AMD loader, if necessary
    if (!(<any>window).require) {
      const loaderScript: HTMLScriptElement = document.createElement('script');
      loaderScript.type = 'text/javascript';
      loaderScript.src = `${baseUrl}/loader.js`;
      loaderScript.addEventListener('load', onGotAmdLoader);
      document.body.appendChild(loaderScript);
    } else {
      onGotAmdLoader();
    }
  }

  private registerLanguages() {
    // install Monaco language client services
    MonacoServices.install(monaco);

    // create the web socket
    const url = this.createUrl('localhost', 3000, '/python')
    const webSocket = new WebSocket(url);

    webSocket.onopen = () => {
      const socket = toSocket(webSocket);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);
      const languageClient = this.createLanguageClient({
        reader,
        writer
      });
      languageClient.start();
      reader.onClose(() => languageClient.stop());
    };
  }

  createLanguageClient(transports: MessageTransports): MonacoLanguageClient {
    return new MonacoLanguageClient({
      name: "Python",
      clientOptions: {
        // use a language id as a document selector
        documentSelector: ['python'],
        // disable the default error handler
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart })
        }
      },
      // create a language client connection from the JSON RPC connection on demand
      connectionProvider: {
        get: () => {
          return Promise.resolve(transports)
        }
      }
    });
  }

  createUrl(hostname: string, port: number, path: string): string {
    return 'ws://localhost:5000/api/lsp/my_user/python';
  }
}
