import {
  Component,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnInit,
  NgZone,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { IconComponent } from '../../components/icon/icon';
import { ThreadView } from './components/thread-view/thread-view';
import { ChatService } from './chat.service';
import { UserProfileMeta } from './models/user-profile-meta.model';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ThreadView],
  templateUrl: './chats.component.html',
  styleUrl: './chats.component.css',
})
export class Chats implements OnInit, AfterViewChecked {
  public userService = inject(UserService);
  public chatService = inject(ChatService);
  private ngZone = inject(NgZone);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  userMeta = signal<{ [uid: string]: UserProfileMeta }>({});

  activeThreadId = signal<string | null>(null);
  activeRecipientId = signal<string | null>(null);

  private isInitialized = false;

  constructor() {
    // Effect safely waits for currentUser() to load asynchronously
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

  ngOnInit() {
    // Initialization is handled by the auth-aware effect above
  }

  private async initializeWithRecipient(currentUid: string, recipientId: string) {
    this.activeRecipientId.set(recipientId);

    const existingThreadId = await this.chatService.findExistingThread(currentUid, recipientId);

    if (existingThreadId) {
      this.activeThreadId.set(existingThreadId);
      this.chatService.subscribeToMessages(existingThreadId);
    } else {
      this.fetchParticipantMeta([recipientId]);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
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
    if (!otherUid) return { displayName: 'Chat' };
    return this.userMeta()[otherUid] || { displayName: otherUid };
  }

  getPendingTargetMeta(): UserProfileMeta {
    const recipientId = this.activeRecipientId();
    if (!recipientId) return { displayName: 'Chat' };
    return this.userMeta()[recipientId] || { displayName: recipientId };
  }

  async selectThread(threadId: string) {
    this.activeThreadId.set(threadId);

    const thread = this.chatService.threads().find((t) => t.id === threadId);
    if (thread) {
      const otherUid = this.getOtherParticipantUid(thread.participants);
      if (otherUid) this.activeRecipientId.set(otherUid);
    }

    this.chatService.subscribeToMessages(threadId);
  }

  backToThreads() {
    this.activeThreadId.set(null);
    this.activeRecipientId.set(null);
    this.chatService.clearMessages();

    history.replaceState({}, document.title, window.location.pathname);

    const currentUser = this.userService.currentUser();
    if (currentUser) {
      this.chatService.loadUserThreads(currentUser.uid, (uids) => {
        this.fetchParticipantMeta(uids);
      });
    }
  }

  async handleSendMessage(text: string) {
    const currentUser = this.userService.currentUser();
    const recipientId = this.activeRecipientId();
    if (!currentUser || !recipientId) return;

    const resolvedThreadId = await this.chatService.sendMessage(
      text,
      this.activeThreadId(),
      recipientId,
      currentUser.uid,
    );

    if (resolvedThreadId && !this.activeThreadId()) {
      this.activeThreadId.set(resolvedThreadId);
    }
  }

  private scrollToBottom(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        try {
          if (this.scrollContainer) {
            const el = this.scrollContainer.nativeElement;
            el.scrollTop = el.scrollHeight;
          }
        } catch (err) {}
      }, 0);
    });
  }
}
