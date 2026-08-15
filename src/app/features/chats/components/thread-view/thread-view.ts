import { Component, inject, signal, OnDestroy, OnInit, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatHeader } from '../chat-header/chat-header';
import { UserService } from '../../../../core/services/user.service';
import { ChatService } from '../../services/chat.service';
import { ChatInput } from '../chat-input/chat-input/chat-input';
import { Subscription } from 'rxjs';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ChatHeader, ChatInput],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public chatService = inject(ChatService);
  public userService = inject(UserService);

  private scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  threadId = signal<string | null>(null);
  currentUid = signal<string | undefined>(undefined);
  user = signal<User | null>(null);
  recipientId = signal<string | null>(null);
  private userMetaSub?: Subscription;

  activeMessageId = signal<string | null>(null);
  private touchStartX = 0;
  private currentDraggingId = signal<string | null>(null);
  messageOffsets = signal<{ [key: string]: number }>({});

  async ngOnInit() {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;
    this.currentUid.set(currentUser.uid);

    const threadIdParam = this.route.snapshot.paramMap.get('threadId');
    const rawRecipientId = history.state?.recipientId || null;
    this.recipientId.set(rawRecipientId);

    const result = await this.chatService.initializeActiveThread(
      threadIdParam,
      rawRecipientId,
      currentUser.uid,
    );

    if (result.threadId) {
      this.threadId.set(result.threadId);
    }

    if (result.targetUid) {
      this.fetchUser(result.targetUid);
    }

    // Initial scroll to bottom once messages are rendered
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  private fetchUser(uid: string) {
    this.userMetaSub = this.userService.getUserById?.(uid)?.subscribe((user) => {
      if (user) {
        this.user.set(user);
      }
    });
  }

  public scrollToBottom() {
    const container = this.scrollContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  onContainerScroll(event: Event) {
    const container = event.target as HTMLElement;

    // Trigger when user scrolls close to the top
    if (container.scrollTop <= 50) {
      const currentThreadId = this.threadId();
      if (
        currentThreadId &&
        this.chatService.hasMoreMessages() &&
        !this.chatService.isLoadingMoreMessages()
      ) {
        // Record prior dimensions and scroll state
        const oldScrollHeight = container.scrollHeight;
        const oldScrollTop = container.scrollTop;

        this.chatService.loadMoreMessages(currentThreadId).then(() => {
          // Adjust scroll position precisely so the user doesn't lose their place
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
        });
      }
    }
  }

  onTouchStart(msgId: string | undefined, event: TouchEvent) {
    if (!msgId) return;
    this.touchStartX = event.touches[0].clientX;
    this.currentDraggingId.set(msgId);
  }

  onTouchMove(event: TouchEvent) {
    const msgId = this.currentDraggingId();
    if (!msgId) return;
    const currentX = event.touches[0].clientX;
    const diff = currentX - this.touchStartX;

    if (diff < 0) {
      const offset = Math.max(diff, -70);
      this.messageOffsets.update((offsets) => ({ ...offsets, [msgId]: offset }));
      if (offset < -40) {
        this.activeMessageId.set(msgId);
      }
    }
  }

  onTouchEnd() {
    const msgId = this.currentDraggingId();
    if (msgId) {
      this.messageOffsets.update((offsets) => ({ ...offsets, [msgId]: 0 }));
    }
    this.currentDraggingId.set(null);
  }

  onBackClicked() {
    this.router.navigate(['/chats']);
  }

  ngOnDestroy() {
    this.chatService.clearMessages();
    this.userMetaSub?.unsubscribe();
  }
}
