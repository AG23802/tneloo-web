import { Component, input, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '../../../../components/icon/icon';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-thread-view',
  imports: [FormsModule, IconComponent, ReactiveFormsModule],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView {
  currentUid = input<string>();
  messages = input.required<Message[]>();
  messageEmitter = output<any>();

  newMessageText = '';
}
