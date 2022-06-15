import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-highlightable-button',
  templateUrl: './highlightable-button.component.html',
  styleUrls: ['./highlightable-button.component.scss']
})
export class HighlightableButtonComponent implements OnInit {

  @Input() isActive: boolean = false;
  @Input() isHighlighted: boolean = false;

  @Output() buttonClicked: EventEmitter<void> = new EventEmitter<void>();

  constructor() { }

  ngOnInit(): void {
  }

  onClicked() {
    this.buttonClicked.emit();
  }
}
