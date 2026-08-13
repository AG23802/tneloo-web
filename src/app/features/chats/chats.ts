import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatService } from './services/chat.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './chats.html',
  styleUrl: './chats..css',
})
export class Chats {
  public chatService = inject(ChatService);
  private router = inject(Router);

  threads = this.chatService.enrichedThreads;

  selectThread(threadId: string) {
    this.router.navigate(['/thread', threadId]);
  }
}
