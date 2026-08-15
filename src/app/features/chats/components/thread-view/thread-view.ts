import { Component, effect, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { CdkAutoSizeVirtualScroll } from '@angular/cdk-experimental/scrolling';
import { Subscription } from 'rxjs';

import { ChatHeader } from '../chat-header/chat-header';
import { ChatInput } from '../chat-input/chat-input/chat-input';
import { UserService } from '../../../../core/services/user.service';
import { ChatService } from '../../services/chat.service';
import { Message } from '../../models/message.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [
    CommonModule,
    ChatHeader,
    ChatInput,
    CdkVirtualScrollViewport,
    CdkVirtualForOf,
    CdkAutoSizeVirtualScroll,
  ],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  public readonly chatService = inject(ChatService);
  public readonly userService = inject(UserService);
  private readonly scrollViewport = viewChild<CdkVirtualScrollViewport>('scrollViewport');

  readonly threadId = signal<string | null>(null);
  readonly currentUid = signal<string | undefined>(undefined);
  readonly user = signal<User | null>(null);
  readonly activeMessageId = signal<string | null>(null);
  readonly messageOffsets = signal<Record<string, number>>({});

  private userMetaSub?: Subscription;
  private touchStartX = 0;
  private readonly currentDraggingId = signal<string | null>(null);
  private restoringScrollPosition = false;
  private initiallyScrolledThreadId: string | null = null;

  private readonly initialScrollEffect = effect(() => {
    const threadId = this.threadId();
    if (!threadId || !this.chatService.initialMessagesLoaded()) return;
    if (this.initiallyScrolledThreadId === threadId) return;

    this.initiallyScrolledThreadId = threadId;
    this.scrollToBottom();
  });

  readonly trackByMessageId = (index: number, message: Message): string =>
    message.id ?? index.toString();

  async ngOnInit(): Promise<void> {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    this.currentUid.set(currentUser.uid);
    const recipientId = history.state?.recipientId ?? null;
    const result = await this.chatService.initializeActiveThread(
      this.route.snapshot.paramMap.get('threadId'),
      recipientId,
      currentUser.uid,
    );

    this.threadId.set(result.threadId);
    if (result.targetUid) this.fetchUser(result.targetUid);
  }

  private fetchUser(uid: string): void {
    this.userMetaSub = this.userService.getUserById?.(uid)?.subscribe((user) => {
      if (user) this.user.set(user);
    });
  }

  scrollToBottom(): void {
    const viewport = this.scrollViewport();
    if (!viewport) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = viewport.getElementRef().nativeElement;
        element.scrollTop = element.scrollHeight;
      });
    });
  }

  onViewportScroll(event: Event): void {
    const threadId = this.threadId();
    const scrollTop = (event.target as HTMLElement).scrollTop;

    if (
      scrollTop > 200 ||
      !threadId ||
      this.restoringScrollPosition ||
      this.chatService.isLoadingMoreMessages() ||
      !this.chatService.hasMoreMessages()
    ) {
      return;
    }

    void this.loadOlderMessages(threadId);
  }

  private waitForLayout(): Promise<void> {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  private async loadOlderMessages(threadId: string): Promise<void> {
    const viewport = this.scrollViewport();
    if (!viewport) return;

    const container = viewport.getElementRef().nativeElement;
    const contentWrapper = container.querySelector<HTMLElement>(
      '.cdk-virtual-scroll-content-wrapper',
    );

    this.restoringScrollPosition = true;
    let previousScrollHeight = container.scrollHeight;

    // The autosize strategy re-measures row heights over several render
    // passes as the newly prepended rows settle, so we keep compensating
    // scrollTop for every height change instead of correcting only once.
    const pinScrollPosition = (): void => {
      const scrollHeight = container.scrollHeight;
      const delta = scrollHeight - previousScrollHeight;
      if (delta !== 0) container.scrollTop += delta;
      previousScrollHeight = scrollHeight;
    };

    const resizeObserver = contentWrapper ? new ResizeObserver(pinScrollPosition) : null;
    resizeObserver?.observe(contentWrapper!);

    try {
      const didLoad = await this.chatService.loadMoreMessages(threadId);
      if (!didLoad) return;

      viewport.checkViewportSize();
      await this.waitForLayout();
      pinScrollPosition();
    } finally {
      resizeObserver?.disconnect();
      this.restoringScrollPosition = false;
    }
  }

  onTouchStart(messageId: string | undefined, event: TouchEvent): void {
    if (!messageId) return;
    this.touchStartX = event.touches[0].clientX;
    this.currentDraggingId.set(messageId);
  }

  onTouchMove(event: TouchEvent): void {
    const messageId = this.currentDraggingId();
    if (!messageId) return;

    const offset = Math.max(event.touches[0].clientX - this.touchStartX, -70);
    this.messageOffsets.update((offsets) => ({ ...offsets, [messageId]: Math.min(offset, 0) }));
    this.activeMessageId.set(offset < -40 ? messageId : null);
  }

  onTouchEnd(): void {
    const messageId = this.currentDraggingId();
    if (messageId) {
      this.messageOffsets.update((offsets) => ({ ...offsets, [messageId]: 0 }));
    }
    this.activeMessageId.set(null);
    this.currentDraggingId.set(null);
  }

  onBackClicked(): void {
    void this.router.navigate(['/chats']);
  }

  ngOnDestroy(): void {
    this.chatService.clearMessages();
    this.userMetaSub?.unsubscribe();
  }
}
