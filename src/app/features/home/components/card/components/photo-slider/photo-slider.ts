import { Component, input, signal } from '@angular/core';
import { Photo } from '../../../../../../core/models/photo.model';
import { User } from '../../../../../../core/models/user.model';

@Component({
  selector: 'app-photo-slider',
  imports: [],
  templateUrl: './photo-slider.html',
  styleUrl: './photo-slider.css',
})
export class PhotoSlider {
  photos = input<Photo[]>([]);
  user = input<User | null>(null);

  currentSlide = signal(0);

  // If using a Set for tracking failed images by index:
  failedImages = new Set<number>();

  imageFailed(index: number) {
    this.failedImages.add(index);
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
