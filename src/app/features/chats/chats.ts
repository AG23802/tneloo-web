import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { ChatService } from './services/chat.service';
import { Thread } from './models/thread.model';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chats.html',
  styleUrl: './chats..css',
})
export class Chats {
  public userService = inject(UserService);
  public chatService = inject(ChatService);
  private router = inject(Router);

  userMeta = signal<{ [uid: string]: User }>({});

  constructor() {
    effect(() => {
      const currentUser = this.userService.currentUser();
      if (!currentUser) return;

      this.chatService.loadUserThreads(currentUser.uid);
    });

    effect(() => {
      const currentUser = this.userService.currentUser();
      const threads = this.chatService.threads();
      if (!currentUser) return;

      threads.forEach((thread) => {
        const otherUid = this.chatService.getOtherParticipantUid(thread, currentUser.uid);
        if (otherUid && !this.userMeta()[otherUid]) {
          this.fetchUserMeta(otherUid);
        }
      });
    });
  }

  private fetchUserMeta(uid: string) {
    this.userService.getUserById?.(uid)?.subscribe({
      next: (user: User | null) => {
        if (user) {
          this.userMeta.update((meta) => ({
            ...meta,
            [uid]: user,
          }));
        }
      },
    });
  }

  getTargetUserMeta(participants: string[]): User | null {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return null;
    const otherUid = this.chatService.getOtherParticipantUid(
      { participants } as Thread,
      currentUser.uid,
    );
    return otherUid ? this.userMeta()[otherUid] || null : null;
  }

  selectThread(threadId: string) {
    this.router.navigate(['/thread', threadId]);
  }
}
