import { Component, effect, inject, signal } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../components/icon/icon';
import { ProfileAvatar } from '../profile/components/profile-avatar/profile-avatar.component';
import { PreviewModal } from '../profile/components/preview-modal/preview-modal';
import { EditProfileComponent } from '../profile/components/edit-profile/edit-profile';
import { Upload } from '../profile/components/upload/upload';
import { Content } from '../../core/models/content.model';
import { MediaViewerModal } from '../../components/media-viewer-modal/media-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';

// A creator's own teaser/portfolio management tab - always her own content,
// so there's no isOwnProfile branching like the old shared Profile
// component needed. Teaser-only, never a price - pricing/paid content only
// ever happens inside a chat thread (separate, not-yet-built feature).
@Component({
  selector: 'app-content',
  templateUrl: './content.html',
  styleUrls: ['../profile/profile.css'],
  imports: [IconComponent, ProfileAvatar, PreviewModal, EditProfileComponent, Upload, MediaViewerModal, TranslatePipe],
})
export class ContentTab {
  userService = inject(UserService);

  mediaList = signal<Content[]>([]);
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  uploadContainer = signal<string>('content');
  selectedMediaItem = signal<Content | null>(null);
  contentPendingDeletion = signal<Content | null>(null);
  activeView = signal<'main' | 'edit'>('main');

  private pressTimer: any = null;

  constructor() {
    effect((onCleanup) => {
      const uid = this.userService.currentUser()?.uid;
      if (!uid) return;

      const subscription = this.userService.getUserContent(uid).subscribe({
        next: (content) => this.mediaList.set(content),
        error: (err) => console.error('Error fetching content:', err),
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  onFileSelected(data: { file: File; previewUrl: string; container: string }) {
    this.selectedFile.set(data.file);
    this.previewUrl.set(data.previewUrl);
    this.uploadContainer.set(data.container);
  }

  cancelPreview() {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
  }

  startLongPress(item: Content, event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.pressTimer = setTimeout(() => {
      this.contentPendingDeletion.set(item);
    }, 600);
  }

  cancelLongPress() {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  async confirmDeleteContent() {
    const item = this.contentPendingDeletion();
    if (!item) return;
    try {
      await this.userService.deleteContentByUrl(item.url);
      this.contentPendingDeletion.set(null);
    } catch (err) {
      console.error('Error deleting content:', err);
    }
  }

  cancelDelete() {
    this.contentPendingDeletion.set(null);
  }

  openMedia(item: Content) {
    this.selectedMediaItem.set(item);
  }

  closeMedia() {
    this.selectedMediaItem.set(null);
  }

  setView(view: 'main' | 'edit') {
    this.activeView.set(view);
  }

  saveProfile(): void {
    this.setView('main');
  }
}
