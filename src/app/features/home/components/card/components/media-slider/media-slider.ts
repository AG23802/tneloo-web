import { Component, input, signal } from '@angular/core';
import { Content } from '../../../../../../core/models/content.model';
import { User } from '../../../../../../core/models/user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { VideoPlayer } from '../../../../../../components/video-player/video-player';

@Component({
  selector: 'app-media-slider',
  imports: [TranslatePipe, VideoPlayer],
  templateUrl: './media-slider.html',
  styleUrl: './media-slider.css',
})
export class MediaSlider {
  media = input<Content[]>([]);
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
