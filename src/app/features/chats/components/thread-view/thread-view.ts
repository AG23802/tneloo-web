import { Component, inject, signal, effect, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '../../../../components/icon/icon';
import { ChatHeader } from '../../../../chat-header/chat-header';
import { UserService } from '../../../../core/services/user.service';
import { ChatService } from '../../services/chat.service';
import { UserProfileMeta } from '../../models/user-profile-meta.model';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ReactiveFormsModule, ChatHeader],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public chatService = inject(ChatService);
  public userService = inject(UserService);
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  threadId = signal<string | null>(null);
  currentUid = signal<string | undefined>(undefined);
  recipientId = signal<string | null>(null);
  targetMeta = signal<UserProfileMeta>({ displayName: '' });
  newMessageText = '';

  constructor() {
    effect(async () => {
      const currentUser = this.userService.currentUser();
      if (!currentUser) return;
      this.currentUid.set(currentUser.uid);

      const threadIdParam = this.route.snapshot.paramMap.get('threadId');

      if (threadIdParam) {
        this.threadId.set(threadIdParam);
        this.chatService.subscribeToMessages(threadIdParam);
        this.loadThreadMeta(threadIdParam);
      } else {
        const navigationState = history.state as { recipientId?: string };
        const recipientId = navigationState?.recipientId;

        if (recipientId) {
          this.recipientId.set(recipientId);
          await this.initializeWithRecipient(currentUser.uid, recipientId);
        }
      }
    });
  }

  // ... existing constructor and methods ...

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      // Ignore scroll errors
    }
  }

  private async initializeWithRecipient(currentUid: string, recipientId: string) {
    this.fetchUserMeta(recipientId);

    const existingThreadId = await this.chatService.findExistingThread(currentUid, recipientId);

    if (existingThreadId) {
      this.threadId.set(existingThreadId);
      this.chatService.subscribeToMessages(existingThreadId);
      this.router.navigate(['/thread', existingThreadId], { replaceUrl: true });
    }
  }

  private loadThreadMeta(threadId: string) {
    const thread = this.chatService.threads().find((t) => t.id === threadId);
    const currentUid = this.userService.currentUser()?.uid;
    const otherUid = thread?.participants.find((p) => p !== currentUid);
    if (otherUid) {
      this.fetchUserMeta(otherUid);
    }
  }

  private fetchUserMeta(uid: string) {
    this.userService.getUserById?.(uid)?.subscribe((user) => {
      if (user) {
        this.targetMeta.set({
          displayName: user.displayName || '',
          profilePictureURL: user.profilePictureURL,
        });
      }
    });
  }

  onBackClicked() {
    this.router.navigate(['/chats']);
  }

  async handleSendMessage(text: string) {
    const currentUser = this.userService.currentUser();
    const currentThreadId = this.threadId();
    const recId =
      this.recipientId() ||
      (currentThreadId
        ? this.chatService
            .threads()
            .find((t) => t.id === currentThreadId)
            ?.participants.find((p) => p !== currentUser?.uid)
        : null);

    if (!currentUser || !recId) return;

    const resolvedThreadId = await this.chatService.sendMessage(
      text,
      currentThreadId,
      recId,
      currentUser.uid,
    );

    if (resolvedThreadId && !currentThreadId) {
      this.threadId.set(resolvedThreadId);
      this.chatService.subscribeToMessages(resolvedThreadId);
      this.router.navigate(['/thread', resolvedThreadId], { replaceUrl: true });
    }

    // Scroll down immediately after sending
    setTimeout(() => this.scrollToBottom(), 50);
  }

  ngOnDestroy() {
    this.chatService.clearMessages();
  }
}
