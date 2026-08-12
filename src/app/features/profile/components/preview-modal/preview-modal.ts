import { Component, inject, input, output, signal } from '@angular/core';
import { PhotoUploadService } from '../../../../core/services/photo-upload.service';

@Component({
  selector: 'app-preview-modal',
  imports: [],
  templateUrl: './preview-modal.html',
  styleUrl: './preview-modal.css',
})
export class PreviewModal {
  previewUrlInput = input<string | null>('');
  selectedFile = input<File | null>(null);
  container = input<string>('photos');

  closed = output<void>();
  isUploading = signal(false);

  private uploadService = inject(PhotoUploadService);

  savePhoto() {
    const file = this.selectedFile();
    if (!file || this.isUploading()) return;

    this.isUploading.set(true);

    const uploadObservable =
      this.container() === 'photos'
        ? this.uploadService.uploadPhoto(file, this.container())
        : this.uploadService.uploadProfilePicture(file);

    uploadObservable.subscribe({
      next: () => {
        this.isUploading.set(false);
        this.closed.emit();
      },
      error: (error) => {
        this.isUploading.set(false);
        console.error('Error uploading photo:', error);
      },
    });
  }

  cancelPreview() {
    if (this.isUploading()) return;
    this.closed.emit();
  }
}
