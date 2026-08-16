import { Service, Injector, OnDestroy, afterNextRender, effect, inject } from '@angular/core';
import { ThreadService } from './thread.service';
import { Message } from '../models/message.model';

// Component-scoped (see ThreadView's `providers`) - one instance per open
// conversation, not a root singleton. Everything here is DOM/scroll
// mechanics tied to a single container element, not shared app state, so
// two open thread views must never share an instance of this.
// autoProvided: false means it is NOT auto-registered at root - it only
// exists where a component explicitly lists it in its own `providers`.
@Service({ autoProvided: false })
export class ThreadScrollService implements OnDestroy {
  private readonly threadService = inject(ThreadService);
  private readonly injector = inject(Injector);

  private container: HTMLDivElement | null = null;
  private initiallyScrolledThreadId: string | null = null;

  // iOS (Safari, and any other browser there — they're all WebKit under the
  // hood) runs momentum/inertial scrolling on its own compositor thread,
  // separate from the main JS thread. Writing scrollTop from the main
  // thread while that compositor animation is still in flight can visibly
  // race with it — Chrome's wheel/trackpad scrolling doesn't have this
  // split, which is why this only shows up on iOS.
  private readonly isIOS =
    typeof navigator !== 'undefined' &&
    (/iP(hone|od|ad)/.test(navigator.platform) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // Every log line gets a performance.now() timestamp so log lines from
  // different sources (thread-view, thread.service, touch events) can be
  // lined up on one timeline to pinpoint exactly when something happened.
  private log(message: string, data?: unknown): void {
    console.log(`[thread-scroll t=${performance.now().toFixed(1)}] ${message}`, data ?? '');
  }

  constructor() {
    effect(() => {
      const threadId = this.threadService.activeThreadId();
      if (!threadId || !this.threadService.initialMessagesLoaded()) return;
      if (this.initiallyScrolledThreadId === threadId) return;

      this.initiallyScrolledThreadId = threadId;
      this.log('initial messages loaded, scrolling to bottom', { threadId });
      this.scrollToBottom();
    });
  }

  setContainer(container: HTMLDivElement | null): void {
    this.container = container;
  }

  // Setting scrollTop here fires a native 'scroll' event just like a user
  // gesture would. If the resulting position happens to already be under
  // the pagination trigger distance (short thread, first load), that event
  // was auto-triggering a fetch+correction immediately on mount — before
  // the user has done anything, while the page is still settling. Flagging
  // it lets onScroll skip that one event so the first load only happens
  // once the user actually scrolls.
  private suppressNextAutoLoadCheck = false;

  scrollToBottom(): void {
    const container = this.container;
    if (!container) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.suppressNextAutoLoadCheck = true;
        container.scrollTop = container.scrollHeight;
        this.log('scrollToBottom', {
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

      if (this.suppressNextAutoLoadCheck) {
        this.suppressNextAutoLoadCheck = false;
        this.log('onScroll: skipped (programmatic scrollToBottom)', {
          scrollTop: target.scrollTop,
        });
        return;
      }

      // Verbose per-tick trace, iOS only (Chrome doesn't need it and this
      // is real per-event overhead we don't want on the already-fixed path).
      if (this.isIOS) {
        this.log('onScroll: tick', { scrollTop: target.scrollTop });
      }

      this.checkShouldLoadOlder(target.scrollTop);
    });
  }

  // Triggering right at the edge (e.g. 200px) means the fetch + scroll
  // corrections always land exactly where the user is currently looking.
  // Triggering much earlier gives the whole pipeline time to finish before
  // the user's gesture ever reaches that part of the list, so the messages
  // are already there — no correction happening under their eyes at all.
  // iOS gets extra buffer: a fast flick can cover 800px before a mobile
  // network round trip finishes, and touch-momentum scrolling is more
  // sensitive to a correction landing mid-gesture than mouse/trackpad input.
  private readonly loadTriggerDistancePx = this.isIOS ? 1400 : 800;

  // On a fast/cached response, a reverted correction leaves scrollTop still
  // under the trigger distance, which immediately fires the next load —
  // logs showed 5 corrections stack up within ~250ms during one drag. That
  // dense a cascade never gives the touch handler a chance to settle
  // between writes; two corrections ~60ms apart in the same log actually
  // stuck. This puts a floor on the gap between loads so they can't stack
  // that tightly, independent of how fast the network answers.
  private lastLoadCompletedAt = 0;
  private readonly minLoadIntervalMs = this.isIOS ? 400 : 0;

  private checkShouldLoadOlder(scrollTop: number): void {
    const threadId = this.threadService.activeThreadId();
    if (
      scrollTop > this.loadTriggerDistancePx ||
      !threadId ||
      this.restoringScrollPosition ||
      this.threadService.isLoadingMoreMessages() ||
      !this.threadService.hasMoreMessages() ||
      performance.now() - this.lastLoadCompletedAt < this.minLoadIntervalMs
    ) {
      return;
    }

    this.log('near top, loading older messages', { scrollTop });
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

  private restoringScrollPosition = false;

  // Splicing the whole 15-message page into the DOM in one shot means a
  // single ~700px scrollTop correction — mathematically exact, but still a
  // large instantaneous jump that can visibly interrupt an in-flight scroll
  // gesture. Inserting in smaller chunks turns that into several small,
  // easy-to-hide corrections instead of one big one, while still doing a
  // single Firestore round trip.
  //
  // iOS is the opposite: WebKit runs touch-momentum scrolling on its own
  // compositor thread, independent of our main-thread writes. Chunk size 2
  // (8 scrollTop writes/page) made this visibly worse than chunk size 5 (3
  // writes/page) — more separate writes means more chances for our write to
  // land on the same frame the compositor is animating, which is what shows
  // up as a bounce. So for iOS we go the other way: one single correction
  // per page, minimizing total writes to one. The much larger iOS trigger
  // distance (see loadTriggerDistancePx) is what keeps that one big jump out
  // of the user's view, not chunking.
  private readonly insertChunkSize = this.isIOS ? Number.MAX_SAFE_INTEGER : 5;

  private async loadOlderMessages(threadId: string): Promise<void> {
    const container = this.container;
    if (!container) return;

    this.log('loadOlderMessages: start', { threadId });
    this.restoringScrollPosition = true;
    try {
      const older = await this.threadService.loadMoreMessages(threadId);
      if (!older.length) {
        this.log('loadOlderMessages: nothing returned');
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
        this.threadService.prependMessages(chunk);

        let targetScrollTop = 0;
        await this.afterNextRenderWrite(() => {
          const previousScrollTop = container.scrollTop;
          const newScrollHeight = container.scrollHeight;
          const delta = newScrollHeight - previousScrollHeight;
          targetScrollTop = previousScrollTop + delta;
          container.scrollTop = targetScrollTop;

          this.log('loadOlderMessages: corrected scroll', {
            isIOS: this.isIOS,
            touchActive: this.touchActive,
            chunkIndex: i,
            chunkSize: chunk.length,
            previousScrollHeight,
            newScrollHeight,
            delta,
            previousScrollTop,
            targetScrollTop,
            newScrollTop: container.scrollTop,
          });
        });

        // Only fight to keep the correction in place when nothing else is
        // actively driving scroll (post-lift-off momentum) — logs showed
        // that works. While a finger is actively dragging, iOS re-imposes
        // the finger-tracked position every frame; reasserting against that
        // failed on every attempt in a row and just added more flicker, so
        // we leave it alone and let the one best-effort write stand.
        if (this.isIOS && !this.touchActive) {
          await this.reassertScrollTopIfReverted(container, targetScrollTop);
        } else if (this.isIOS) {
          this.log('loadOlderMessages: skipping reassert (touch active)', { targetScrollTop });
        }
      }
    } finally {
      this.restoringScrollPosition = false;
      this.lastLoadCompletedAt = performance.now();
      this.log('loadOlderMessages: done');
    }
  }

  private waitForNextFrame(): Promise<void> {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  // A drift under this is normal continued momentum after a write that
  // stuck; a drift at or above it means the compositor reverted our write
  // back toward its pre-correction position (which is close to a full
  // chunk's delta, ~250-750px in practice) — not something to leave alone.
  private readonly revertDriftThresholdPx = 200;

  private async reassertScrollTopIfReverted(
    container: HTMLDivElement,
    targetScrollTop: number,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.waitForNextFrame();
      const actual = container.scrollTop;
      const drift = Math.abs(actual - targetScrollTop);

      this.log('loadOlderMessages: scroll check', { attempt, targetScrollTop, actual, drift });
      if (drift <= this.revertDriftThresholdPx) return;

      container.scrollTop = targetScrollTop;
      this.log('loadOlderMessages: scroll reasserted', { attempt, targetScrollTop });
    }
  }

  // While a finger is actively down and dragging, iOS re-imposes the
  // finger-tracked scroll position every single frame — logs showed a
  // correction fail on every reassert attempt in a row during an active
  // drag, unlike post-lift-off momentum where reasserting once was enough.
  // That's not winnable by writing harder, so reassertScrollTopIfReverted
  // only runs when this is false; during an active drag we do one
  // best-effort write and leave it alone.
  private touchActive = false;

  // Container-level touch tracking. Separate from ThreadView's per-row
  // swipe-to-reveal-timestamp handlers - this fires in addition to those
  // via bubbling, which is fine.
  onContainerTouchStart(event: TouchEvent): void {
    this.touchActive = true;
    this.log('container touchstart', {
      touches: event.touches.length,
      scrollTop: this.container?.scrollTop,
    });
  }

  onContainerTouchEnd(event: TouchEvent): void {
    this.touchActive = event.touches.length > 0;
    this.log('container touchend', {
      touches: event.touches.length,
      touchActive: this.touchActive,
      scrollTop: this.container?.scrollTop,
    });
  }

  ngOnDestroy(): void {
    if (this.scrollRafId !== null) cancelAnimationFrame(this.scrollRafId);
  }
}
