import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThreadService } from '../../services/thread.service';
import { MediaUploadService } from '../../../../core/services/media-upload.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../../components/icon/icon';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule, IconComponent, ReactiveFormsModule, TranslatePipe],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.css',
})
export class ChatInput {
  public threadService = inject(ThreadService);
  private mediaUploadService = inject(MediaUploadService);
  private notificationService = inject(NotificationService);

  newMessageText = '';
  isUploadingMedia = signal(false);

  private mediaInput = viewChild<ElementRef<HTMLInputElement>>('mediaInput');

  readonly messageSent = output<void>();

  async handleSendMessage() {
    const text = this.newMessageText.trim();
    if (!text) return;

    // Clear input immediately so UI updates instantly
    this.newMessageText = '';

    await this.threadService.sendMessage(text);
    this.messageSent.emit();
  }

  triggerMediaPicker(): void {
    if (this.isUploadingMedia()) return;
    this.mediaInput()?.nativeElement.click();
  }

  onMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.isUploadingMedia.set(true);
    this.mediaUploadService.uploadMedia(file, 'chat-media').subscribe({
      next: async (uploaded) => {
        await this.threadService.sendMessage('', {
          url: uploaded.url,
          type: uploaded.type,
          thumbnailUrl: uploaded.thumbnailUrl,
          duration: uploaded.duration,
        });
        this.isUploadingMedia.set(false);
        this.messageSent.emit();
      },
      error: (error: unknown) => {
        this.isUploadingMedia.set(false);
        this.notificationService.show(
          error instanceof Error ? error.message : 'Error uploading media.',
        );
      },
    });
  }
}
