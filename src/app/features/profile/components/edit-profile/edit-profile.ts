import { Component, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { User } from '../../../../core/models/user.model';
import { UserService } from '../../../../core/services/user.service';

@Component({
  selector: 'app-edit-profile',
  imports: [IconComponent],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfileComponent {
  user = input<User | null>(null);

  goBack = output<void>();
  saveChanges = output<{
    displayName: string;
    username: string;
    description: string;
  }>();

  displayName = signal('');
  username = signal('');
  description = signal('');
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  private userService = inject(UserService);

  ngOnInit() {
    const currentUser = this.user();
    if (currentUser) {
      this.displayName.set(currentUser.displayName || '');
      this.username.set(currentUser.username || '');
      this.description.set(currentUser.description || '');
    }
  }

  onNameChange(event: Event) {
    this.displayName.set((event.target as HTMLInputElement).value);
  }

  onUserameChange(event: Event) {
    this.username.set((event.target as HTMLInputElement).value);
  }

  onDescriptionChange(event: Event) {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  async onSave() {
    const currentUser = this.user();
    if (!currentUser || !currentUser.uid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const updatedData = {
      displayName: this.displayName(),
      username: this.username(),
      description: this.description(),
    };

    try {
      await this.userService.updateUserProfile(currentUser.uid, updatedData);
      this.isSaving.set(false);
      this.saveChanges.emit(updatedData);
    } catch (err: any) {
      this.isSaving.set(false);
      console.error('Error updating profile in Firestore:', err);
      this.errorMessage.set(
        err.message || 'Failed to update profile. Please try again.',
      );
    }
  }
}
