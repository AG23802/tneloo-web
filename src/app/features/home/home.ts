import { Component, inject, signal } from '@angular/core';
import { HomeService } from './services/home.service';
import { Card } from './components/card/card';
import { TranslatePipe } from '@ngx-translate/core';
import { PreserveScrollDirective } from '../../core/preserve-scroll.directive';

// One creator full-bleed at a time, vertical swipe to advance - swiping
// through a single creator's own photos (MediaSlider, inside Card) is a
// horizontal gesture, so this stays on a different axis to avoid the two
// gestures fighting over the same touch.
const SWIPE_THRESHOLD_PX = 80;

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  imports: [Card, TranslatePipe],
  hostDirectives: [PreserveScrollDirective],
})
export class Home {
  private homeService = inject(HomeService);

  users = this.homeService.users;
  isLoading = this.homeService.initialLoading;
  hasMorePhotos = this.homeService.hasMore;

  readonly currentIndex = signal(0);
  readonly dragOffset = signal(0);
  private isDragging = false;
  private touchStartY = 0;

  constructor() {
    this.homeService.loadIfNeeded();
  }

  onTouchStart(event: TouchEvent): void {
    this.isDragging = true;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    const offset = event.touches[0].clientY - this.touchStartY;
    // Can't drag past the first card (nothing above it) or past the last
    // loaded card (nothing below it yet) - resist instead of dragging free.
    const atStart = this.currentIndex() === 0 && offset > 0;
    const atEnd = this.currentIndex() >= this.users().length - 1 && offset < 0;
    this.dragOffset.set(atStart || atEnd ? offset / 4 : offset);
  }

  onTouchEnd(): void {
    this.isDragging = false;
    const offset = this.dragOffset();
    if (offset < -SWIPE_THRESHOLD_PX) {
      this.nextCreator();
    } else if (offset > SWIPE_THRESHOLD_PX) {
      this.prevCreator();
    }
    this.dragOffset.set(0);
  }

  nextCreator(): void {
    if (this.currentIndex() >= this.users().length - 1) return;
    this.currentIndex.update((i) => i + 1);
    // Keep a buffer of creators loaded ahead of where the buyer actually is.
    if (this.currentIndex() >= this.users().length - 3) {
      this.homeService.loadMore();
    }
  }

  prevCreator(): void {
    if (this.currentIndex() === 0) return;
    this.currentIndex.update((i) => i - 1);
  }

  // Positions the active card plus its immediate neighbors (only those
  // three are ever rendered) so a drag reveals the next/previous card
  // sliding in from off-screen instead of jumping straight to it.
  cardOffset(index: number): 'prev' | 'active' | 'next' | null {
    const active = this.currentIndex();
    if (index === active) return 'active';
    if (index === active - 1) return 'prev';
    if (index === active + 1) return 'next';
    return null;
  }

  cardTransform(index: number): string {
    const base = { prev: -100, active: 0, next: 100 }[this.cardOffset(index) ?? 'active'];
    return `translateY(calc(${base}% + ${this.dragOffset()}px))`;
  }
}
