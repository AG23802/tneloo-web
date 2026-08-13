import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { ChatService } from './services/chat.service';
import { UserProfileMeta } from './models/user-profile-meta.model';
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

  userMeta = signal<{ [uid: string]: UserProfileMeta }>({});

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
            [uid]: {
              displayName: user.displayName || '',
              profilePictureURL: user.profilePictureURL,
            },
          }));
        }
      },
    });
  }

  getTargetUserMeta(participants: string[]): UserProfileMeta {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return { displayName: '' };
    const otherUid = this.chatService.getOtherParticipantUid(
      { participants } as Thread,
      currentUser.uid,
    );
    return otherUid ? this.userMeta()[otherUid] || { displayName: '' } : { displayName: '' };
  }

  selectThread(threadId: string) {
    this.router.navigate(['/thread', threadId]);
  }
}
