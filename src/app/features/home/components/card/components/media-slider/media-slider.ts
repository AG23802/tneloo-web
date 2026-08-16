import { Component, input, signal } from '@angular/core';
import { Media } from '../../../../../../core/models/media.model';
import { User } from '../../../../../../core/models/user.model';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-media-slider',
  imports: [TranslatePipe],
  templateUrl: './media-slider.html',
  styleUrl: './media-slider.css',
})
export class MediaSlider {
  media = input<Media[]>([]);
  user = input<User | null>(null);

  currentSlide = signal(0);

  // If using a Set for tracking failed items by index:
  failedItems = new Set<number>();

  itemFailed(index: number) {
    this.failedItems.add(index);
  }

  onGalleryScroll(event: Event) {
    const container = event.target as HTMLElement;

    const index = Math.round(container.scrollLeft / container.clientWidth);

    this.currentSlide.set(index);
  }

  getCurrentSlide() {
    return this.currentSlide();
  }
}
