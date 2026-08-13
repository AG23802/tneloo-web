import { Component, inject, input, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '../../../../../components/icon/icon';
import { ChatService } from '../../../services/chat.service';
import { UserService } from '../../../../../core/services/user.service';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule, IconComponent, ReactiveFormsModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.css',
})
export class ChatInput {
  public chatService = inject(ChatService);
  public userService = inject(UserService);

  threadId = input.required<string | null>();
  recipientId = input.required<string | null>();

  threadCreated = output<string>();

  newMessageText = '';

  async handleSendMessage(text: string) {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    const currentThreadId = this.threadId();

    // Hand everything off to the service
    const resolvedThreadId = await this.chatService.sendMessage(
      text,
      currentThreadId,
      this.recipientId(),
      currentUser.uid,
    );

    // If a brand new thread was created, let the parent know via output
    if (resolvedThreadId && !currentThreadId) {
      this.threadCreated.emit(resolvedThreadId);
    }

    this.newMessageText = '';
  }
}
