import { Component, OnInit } from '@angular/core';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-toasts-container',
  templateUrl: './toasts-container.component.html',
  styleUrls: ['./toasts-container.component.scss']
})
export class ToastsContainerComponent implements OnInit {

  readonly ToastService = this.toastService;

  constructor(private toastService: ToastService) { }

  ngOnInit(): void {
  }

}
