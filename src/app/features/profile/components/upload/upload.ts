import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-upload',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './upload.html',
  styleUrl: './upload.css',
})
export class Upload {
  container = input<string>('media');

  // Avatars must be a still image; the gallery ('media') accepts either.
  accept = computed(() => (this.container() === 'media' ? 'image/*,video/*' : 'image/*'));

  fileSelected = output<{
    file: File;
    previewUrl: string;
    container: string;
  }>();

  // Reference the file input from the template
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  triggerUpload() {
    this.fileInput()?.nativeElement.click();
  }

  onFilesSelected(event: Event) {
    const inputElement = event.target as HTMLInputElement;

    if (inputElement.files && inputElement.files.length > 0) {
      const file = inputElement.files[0];
      const previewUrl = URL.createObjectURL(file);

      this.fileSelected.emit({
        file,
        previewUrl,
        container: this.container(),
      });
    }
    inputElement.value = '';
  }
}
