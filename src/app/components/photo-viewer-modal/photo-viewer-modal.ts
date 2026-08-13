import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../avatar/avatar.component';
import { FeedPhoto } from '../../core/models/feed-photo';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-photo-viewer-modal',
  standalone: true,
  imports: [Avatar, CommonModule, IconComponent],
  templateUrl: './photo-viewer-modal.html',
  styleUrl: './photo-viewer-modal.css',
})
export class PhotoViewerModal {
  photo = input.required<FeedPhoto>();
  close = output<void>();

  private router = inject(Router); // Make sure inject is imported from '@angular/core'

  openProfile(username: string) {
    this.router.navigate(['/', username]);
  }
}
