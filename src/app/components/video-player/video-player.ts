import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon';

// No native <video controls> anywhere it's used - just a centered
// play/pause toggle, Instagram-style. One shared component so every
// content-viewing surface (feed, viewer, chat) behaves the same way.
@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './video-player.html',
  styleUrl: './video-player.css',
})
export class VideoPlayer {
  src = input.required<string>();
  poster = input<string | null | undefined>(null);
  autoplay = input(false);
  preload = input<'none' | 'metadata' | 'auto'>('metadata');
  // 'cover' fills the container and crops (grid/bubble use this for
  // uniform sizing). 'height' matches the container's height and lets
  // width follow the video's own aspect ratio instead - nothing gets
  // cropped, at the cost of letterboxing left/right when narrower.
  fit = input<'cover' | 'height'>('cover');
  // Instead of playing inline, tapping just asks the parent (via `expand`)
  // to show this video somewhere bigger - used for the small chat-bubble
  // preview, which is too cramped to actually watch a video in.
  expandOnTap = input(false);

  error = output<void>();
  expand = output<void>();

  private videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  isPlaying = signal(false);
  // Starts muted (Reels/TikTok convention) - also sidesteps the browser
  // autoplay-with-sound block entirely, so this doubles as the muted flag
  // autoplay callers need.
  isMuted = signal(true);

  togglePlay(event: Event): void {
    event.stopPropagation();
    if (this.expandOnTap()) {
      this.expand.emit();
      return;
    }
    const video = this.videoRef()?.nativeElement;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  toggleMute(event: Event): void {
    event.stopPropagation();
    const muted = !this.isMuted();
    this.isMuted.set(muted);
    // The [muted] property binding alone doesn't reliably re-sync once a
    // video has already autoplayed muted - set the element property
    // directly so unmuting actually takes effect, not just the icon.
    const video = this.videoRef()?.nativeElement;
    if (video) video.muted = muted;
  }

  onPlay(): void {
    this.isPlaying.set(true);
  }

  onPause(): void {
    this.isPlaying.set(false);
  }

  onError(): void {
    this.error.emit();
  }
}
