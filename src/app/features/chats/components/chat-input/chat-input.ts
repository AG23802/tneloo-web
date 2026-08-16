import { Component, inject, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThreadService } from '../../services/thread.service';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../../components/icon/icon';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule, IconComponent, ReactiveFormsModule, TranslatePipe],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.css',
})
export class ChatInput {
  public threadService = inject(ThreadService);
  newMessageText = '';

  readonly messageSent = output<void>();

  async handleSendMessage() {
    const text = this.newMessageText.trim();
    if (!text) return;

    // Clear input immediately so UI updates instantly
    this.newMessageText = '';

    await this.threadService.sendMessage(text);
    this.messageSent.emit();
  }
}
