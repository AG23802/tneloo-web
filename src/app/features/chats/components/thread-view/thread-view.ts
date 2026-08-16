import {
  Component,
  ElementRef,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ChatHeader } from '../chat-header/chat-header';
import { ChatInput } from '../chat-input/chat-input';
import { UserService } from '../../../../core/services/user.service';
import { ThreadService } from '../../services/thread.service';
import { ThreadScrollService } from '../../services/thread-scroll.service';
import { ThreadParticipantInfo } from '../../models/thread.model';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [DatePipe, ChatHeader, ChatInput],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
  // Scoped here, not root - it's one scroll container's worth of DOM/touch
  // state (see ThreadScrollService), not shared app state. A fresh instance
  // per ThreadView means two open thread views can never fight over it.
  providers: [ThreadScrollService],
})
export class ThreadView implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  public readonly threadService = inject(ThreadService);
  public readonly scrollService = inject(ThreadScrollService);
  public readonly userService = inject(UserService);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  // Owned by ThreadService, not a local copy - a thread created mid-session
  // (first message in a new conversation) updates it in place there, with
  // no route navigation/remount involved. See ThreadService.sendMessage.
  readonly threadId = this.threadService.activeThreadId;
  readonly currentUid = signal<string | undefined>(undefined);
  readonly user = signal<ThreadParticipantInfo | null>(null);
  readonly activeMessageId = signal<string | null>(null);
  readonly messageOffsets = signal<Record<string, number>>({});

  // Swipe-to-reveal-timestamp on a message row - a per-row gesture, not part
  // of the scroll container's own pagination/momentum handling, so it stays
  // here rather than in ThreadScrollService.
  private touchStartX = 0;
  private readonly currentDraggingId = signal<string | null>(null);

  private readonly syncScrollContainerEffect = effect(() => {
    this.scrollService.setContainer(this.scrollContainer()?.nativeElement ?? null);
  });

  async ngOnInit(): Promise<void> {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;

    this.currentUid.set(currentUser.uid);
    const recipientId = history.state?.recipientUser?.uid ?? null;
    // The chats list and profile "Message" button already have this user's
    // doc loaded - they pass it through router state so we can show the
    // header immediately with zero reads. Anything else (e.g. a bare reload
    // of /thread/:id, with no router state) falls back to the thread's own
    // denormalized participantsInfo, resolved as part of initializeActiveThread.
    const passedUser =
      (history.state?.recipientUser as ThreadParticipantInfo | null | undefined) ?? null;
    const result = await this.threadService.initializeActiveThread(
      this.route.snapshot.paramMap.get('threadId'),
      recipientId,
      currentUser.uid,
    );

    // threadId is already updated - initializeActiveThread sets it on
    // ThreadService directly.
    this.user.set(passedUser ?? result.targetUser);
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
    this.threadService.clearMessages();
  }
}
