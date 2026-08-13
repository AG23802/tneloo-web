import { Component, inject, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '../../../../../components/icon/icon';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule, IconComponent, ReactiveFormsModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.css',
})
export class ChatInput {
  public chatService = inject(ChatService);
  newMessageText = '';

  async handleSendMessage(text: string) {
    await this.chatService.sendMessage(text);
    this.newMessageText = '';
  }
}
