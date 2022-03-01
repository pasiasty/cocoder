import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-progressive-img-loader',
  templateUrl: './progressive-img-loader.component.html',
  styleUrls: ['./progressive-img-loader.component.scss']
})
export class ProgressiveImgLoaderComponent implements OnInit {

  _initialImg!: string
  _finalImg!: string
  finalImgOpacity = 0

  constructor() { }

  ngOnInit(): void {
  }

  @Input()
  set initialImg(param: string) {
    this._initialImg = param;
  }

  @Input()
  set finalImg(param: string) {
    this._finalImg = param;
  }

  finalImgLoaded() {
    this.finalImgOpacity = 1;
  }
}
