import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '../../../../components/icon/icon';
import { Message } from '../../models/message.model';
import { ChatHeader } from '../../../../chat-header/chat-header';

@Component({
  selector: 'app-thread-view',
  imports: [FormsModule, IconComponent, ReactiveFormsModule, ChatHeader],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView {
  threadId = input<string>();
  currentUid = input.required<string | undefined>();
  messages = input.required<Message[]>();

  messageEmitter = output<string>();
  back = output<void>(); // <--- Dedicated back event

  newMessageText = '';

  url = input.required<string | undefined>();
  displayName = input.required<string>();

  onBackClicked() {
    this.back.emit(); // <--- Emit back separately
  }
}
