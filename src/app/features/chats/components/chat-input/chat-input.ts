import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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

  // Selecting a file only stages it here - it's not uploaded until the user
  // actually hits send, same as text. Lets them attach media with no
  // caption, add a caption after picking, or back out via removePendingMedia
  // without anything ever having been uploaded.
  pendingFile = signal<File | null>(null);
  pendingPreviewUrl = signal<string | null>(null);
  isPendingVideo = computed(() => this.pendingFile()?.type.startsWith('video/') ?? false);

  isSending = signal(false);
  canSend = computed(
    () => (!!this.newMessageText.trim() || !!this.pendingFile()) && !this.isSending(),
  );

  private mediaInput = viewChild<ElementRef<HTMLInputElement>>('mediaInput');

  readonly messageSent = output<void>();

  triggerMediaPicker(): void {
    if (this.isSending()) return;
    this.mediaInput()?.nativeElement.click();
  }

  onMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.setPendingFile(file);
  }

  removePendingMedia(): void {
    this.setPendingFile(null);
  }

  private setPendingFile(file: File | null): void {
    const previousUrl = this.pendingPreviewUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    this.pendingFile.set(file);
    this.pendingPreviewUrl.set(file ? URL.createObjectURL(file) : null);
  }

  async handleSendMessage(): Promise<void> {
    if (!this.canSend()) return;
    const text = this.newMessageText.trim();
    const file = this.pendingFile();

    this.isSending.set(true);
    try {
      let media;
      if (file) {
        const uploaded = await firstValueFrom(
          this.mediaUploadService.uploadMedia(file, 'chat-media'),
        );
        media = {
          url: uploaded.url,
          type: uploaded.type,
          thumbnailUrl: uploaded.thumbnailUrl,
          duration: uploaded.duration,
        };
      }

      await this.threadService.sendMessage(text, media);

      // Only clear once we know it actually went through - on failure the
      // draft and attachment stay put so the user can just hit send again.
      this.newMessageText = '';
      this.setPendingFile(null);
      this.messageSent.emit();
    } catch (error: unknown) {
      this.notificationService.show(
        error instanceof Error ? error.message : 'Error uploading media.',
      );
    } finally {
      this.isSending.set(false);
    }
  }
}
