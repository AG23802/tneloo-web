import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { ChatService } from './services/chat.service';
import { UserProfileMeta } from './models/user-profile-meta.model';

@Component({
  selector: 'app-chats',
  standalone: true,

  imports: [CommonModule],

  templateUrl: './chats.html',

  styleUrl: './chats..css',
})
export class Chats implements OnInit {
  public userService = inject(UserService);

  public chatService = inject(ChatService);

  private router = inject(Router);

  userMeta = signal<{ [uid: string]: UserProfileMeta }>({});

  private isInitialized = false;

  constructor() {
    effect(() => {
      const currentUser = this.userService.currentUser();

      if (!currentUser || this.isInitialized) return;

      this.isInitialized = true;

      const navigationState = history.state as { recipientId?: string };

      const recipientId = navigationState?.recipientId;

      if (recipientId) {
        this.initializeWithRecipient(currentUser.uid, recipientId);
      } else {
        this.chatService.loadUserThreads(currentUser.uid, (uids) => {
          this.fetchParticipantMeta(uids);
        });
      }
    });
  }

  ngOnInit() {}

  private async initializeWithRecipient(currentUid: string, recipientId: string) {
    const existingThreadId = await this.chatService.findExistingThread(currentUid, recipientId);

    if (existingThreadId) {
      this.router.navigate(['/chats', existingThreadId]);
    } else {
      this.fetchParticipantMeta([recipientId]);
    }
  }

  private fetchParticipantMeta(uids: string[]) {
    const metaMap = { ...this.userMeta() };

    for (const uid of uids) {
      if (!metaMap[uid]) {
        this.userService.getUserById?.(uid)?.subscribe({
          next: (user: User | null) => {
            if (user) {
              metaMap[uid] = {
                displayName: user.displayName || '',

                profilePictureURL: user.profilePictureURL,
              };

              this.userMeta.set({ ...metaMap });
            }
          },
        });
      }
    }
  }

  getOtherParticipantUid(participants: string[]): string | undefined {
    const currentUser = this.userService.currentUser();

    return participants.find((p) => p !== currentUser?.uid);
  }

  getTargetUserMeta(participants: string[]): UserProfileMeta {
    const otherUid = this.getOtherParticipantUid(participants);
    if (!otherUid) return { displayName: '' };
    return this.userMeta()[otherUid] || { displayName: '' };
  }

  selectThread(threadId: string) {
    this.router.navigate(['/chats', threadId]);
  }
}
