import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  imports: [CommonModule, ChatHeader, ChatInput],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  public readonly chatService = inject(ChatService);
  public readonly userService = inject(UserService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly injector = inject(Injector);

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
    console.log('[thread-view] initial messages loaded, scrolling to bottom', { threadId });
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
    const container = this.scrollContainer()?.nativeElement;
    if (!container) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        console.log('[thread-view] scrollToBottom', {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
        });
      });
    });
  }

  private scrollRafId: number | null = null;

  // Scroll fires far more often than once per frame during a trackpad/wheel
  // gesture; without throttling every one of those events was doing signal
  // reads + logging, which is wasted main-thread work during the exact
  // moment we want scrolling to stay smooth.
  onScroll(event: Event): void {
    if (this.scrollRafId !== null) return;
    const target = event.target as HTMLElement;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = null;
      this.checkShouldLoadOlder(target.scrollTop);
    });
  }

  // Triggering right at the edge (e.g. 200px) means the fetch + scroll
  // corrections always land exactly where the user is currently looking.
  // Triggering much earlier gives the whole pipeline time to finish before
  // the user's gesture ever reaches that part of the list, so the messages
  // are already there — no correction happening under their eyes at all.
  private readonly loadTriggerDistancePx = 800;

  private checkShouldLoadOlder(scrollTop: number): void {
    const threadId = this.threadId();
    if (
      scrollTop > this.loadTriggerDistancePx ||
      !threadId ||
      this.restoringScrollPosition ||
      this.chatService.isLoadingMoreMessages() ||
      !this.chatService.hasMoreMessages()
    ) {
      return;
    }

    console.log('[thread-view] near top, loading older messages', { scrollTop });
    void this.loadOlderMessages(threadId);
  }

  // Runs `work` in the "write" phase of Angular's next render — after change
  // detection has patched the DOM but before the browser paints that frame.
  // Doing the scroll correction here (instead of after N requestAnimationFrame
  // waits) means there's no in-between frame where the browser paints the
  // unadjusted, jumped-to-top scroll position — which is what was causing
  // the visible flicker.
  private afterNextRenderWrite(work: () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      afterNextRender(
        {
          write: () => {
            work();
            resolve();
          },
        },
        { injector: this.injector },
      );
    });
  }

  // Splicing the whole 15-message page into the DOM in one shot means a
  // single ~700px scrollTop correction — mathematically exact, but still a
  // large instantaneous jump that can visibly interrupt an in-flight scroll
  // gesture. Inserting in smaller chunks turns that into several small,
  // easy-to-hide corrections instead of one big one, while still doing a
  // single Firestore round trip.
  private readonly insertChunkSize = 5;

  private async loadOlderMessages(threadId: string): Promise<void> {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) return;

    console.log('[thread-view] loadOlderMessages: start', { threadId });
    this.restoringScrollPosition = true;
    try {
      const older = await this.chatService.loadMoreMessages(threadId);
      if (!older.length) {
        console.log('[thread-view] loadOlderMessages: nothing returned');
        return;
      }

      const chunks: Message[][] = [];
      for (let i = 0; i < older.length; i += this.insertChunkSize) {
        chunks.push(older.slice(i, i + this.insertChunkSize));
      }

      // Insert the chunk closest to the existing content first, working
      // backward to the oldest chunk, so the array ends up in the same
      // order as inserting the whole batch at once would produce.
      for (let i = chunks.length - 1; i >= 0; i--) {
        const chunk = chunks[i];

        // Measure right before inserting, not before the network fetch —
        // the user can keep scrolling during the await, so an earlier
        // snapshot of scrollTop goes stale and produces the wrong correction.
        const previousScrollHeight = container.scrollHeight;
        this.chatService.prependMessages(chunk);

        await this.afterNextRenderWrite(() => {
          const previousScrollTop = container.scrollTop;
          const newScrollHeight = container.scrollHeight;
          const delta = newScrollHeight - previousScrollHeight;
          container.scrollTop = previousScrollTop + delta;

          console.log('[thread-view] loadOlderMessages: corrected scroll', {
            chunkIndex: i,
            chunkSize: chunk.length,
            previousScrollHeight,
            newScrollHeight,
            delta,
            previousScrollTop,
            newScrollTop: container.scrollTop,
          });
        });
      }
    } finally {
      this.restoringScrollPosition = false;
      console.log('[thread-view] loadOlderMessages: done');
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
    if (this.scrollRafId !== null) cancelAnimationFrame(this.scrollRafId);
    this.chatService.clearMessages();
    this.userMetaSub?.unsubscribe();
  }
}
