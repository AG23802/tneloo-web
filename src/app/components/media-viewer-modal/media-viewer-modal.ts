import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../avatar/avatar.component';
import { FeedMedia } from '../../core/models/feed-media';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon';
import { VideoPlayer } from '../video-player/video-player';

@Component({
  selector: 'app-media-viewer-modal',
  standalone: true,
  imports: [Avatar, CommonModule, IconComponent, VideoPlayer],
  templateUrl: './media-viewer-modal.html',
  styleUrl: './media-viewer-modal.css',
})
export class MediaViewerModal {
  media = input.required<FeedMedia>();
  close = output<void>();

  private router = inject(Router);

  openProfile(username: string) {
    this.router.navigate(['/', username]);
  }
}
