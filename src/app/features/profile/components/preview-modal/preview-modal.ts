import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MediaUploadService } from '../../../../core/services/media-upload.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-preview-modal',
  imports: [TranslatePipe],
  templateUrl: './preview-modal.html',
  styleUrl: './preview-modal.css',
})
export class PreviewModal {
  previewUrlInput = input<string | null>('');
  selectedFile = input<File | null>(null);
  container = input<string>('content');

  isVideo = computed(() => this.selectedFile()?.type.startsWith('video/') ?? false);
  // Only the avatar picker crops into a circle - gallery uploads keep
  // whatever shape the source media actually is (square, portrait, ...).
  isAvatar = computed(() => this.container() === 'profile-pictures');

  closed = output<void>();
  isUploading = signal(false);

  private uploadService = inject(MediaUploadService);
  private notificationService = inject(NotificationService);

  saveMedia() {
    const file = this.selectedFile();
    if (!file || this.isUploading()) return;

    this.isUploading.set(true);

    const uploadObservable: Observable<unknown> =
      this.container() === 'content'
        ? this.uploadService.uploadContent(file)
        : this.uploadService.uploadProfilePicture(file);

    uploadObservable.subscribe({
      next: () => {
        this.isUploading.set(false);
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.isUploading.set(false);
        this.notificationService.show(
          error instanceof Error ? error.message : 'Error uploading media.',
        );
        console.error('Error uploading media:', error);
      },
    });
  }

  cancelPreview() {
    if (this.isUploading()) return;
    this.closed.emit();
  }
}
