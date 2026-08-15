import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatService } from './services/chat.service';
import { Thread } from './models/thread.model';
import { User } from '../../core/models/user.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './chats.html',
  styleUrl: './chats.css',
})
export class Chats {
  public chatService = inject(ChatService);
  private router = inject(Router);

  threads = this.chatService.enrichedThreads;

  selectThread(thread: Thread & { targetUser: User | null }) {
    // The list already has the recipient's user doc loaded (targetUser) —
    // pass it along so thread-view doesn't re-fetch it over the network.
    this.router.navigate(['/thread', thread.id], {
      state: { recipientUser: thread.targetUser },
    });
  }
}
