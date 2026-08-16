import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ProfileAvatar } from './components/profile-avatar/profile-avatar.component';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../components/icon/icon';
import { Settings } from '../settings/settings';
import { CommonModule } from '@angular/common';
import { PreviewModal } from './components/preview-modal/preview-modal';
import { EditProfileComponent } from './components/edit-profile/edit-profile';
import { User } from '../../core/models/user.model';
import { Media } from '../../core/models/media.model';
import { Upload } from './components/upload/upload';
import { MediaViewerModal } from '../../components/media-viewer-modal/media-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';

interface UserProfileDetails {
  dateOfBirth?: string;
  canton?: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  imports: [
    ProfileAvatar,
    CommonModule,
    IconComponent,
    Settings,
    PreviewModal,
    EditProfileComponent,
    Upload,
    RouterModule,
    MediaViewerModal,
    TranslatePipe
  ],
})
export class Profile {
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  private routeParamMap = toSignal(this.route.paramMap);
  routeUsername = computed(() => this.routeParamMap()?.get('username') ?? null);

  profileUser = signal<User | null>(null);
  mediaList = signal<Media[]>([]);
  isMenuOpen = signal<boolean>(false);

  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  selectedMediaItem = signal<Media | null>(null);
  mediaPendingDeletion = signal<Media | null>(null);

  private pressTimer: any = null;

  toggleMenu() {
    this.isMenuOpen.update((open) => !open);
  }

  private profileDetails = signal<UserProfileDetails>({
    dateOfBirth: '1995-04-12',
    canton: 'Aargau (AG)',
  });

  constructor() {
    effect((onCleanup) => {
      const usernameParam = this.routeUsername();
      const sessionUser = this.userService.currentUser();
      const targetUsername = usernameParam ?? sessionUser?.username;

      if (!targetUsername) return;

      const subscription = this.userService
        .getUserByUsernameRealtime(targetUsername)
        .subscribe({
          next: (user) => {
            if (!user) return;
            this.profileUser.set(user);
          },
          error: (err) => console.error('Error fetching user profile:', err),
        });

      onCleanup(() => subscription.unsubscribe());
    });

    effect((onCleanup) => {
      const user = this.profileUser();
      if (!user || !user.uid) return;

      const subscription = this.userService.getUserMedia(user.uid).subscribe({
        next: (media) => this.mediaList.set(media),
        error: (err) => console.error('Error fetching media:', err),
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  uploadContainer = signal<string>('media');

  onFileSelected(data: { file: File; previewUrl: string; container: string }) {
    this.selectedFile.set(data.file);
    this.previewUrl.set(data.previewUrl);
    this.uploadContainer.set(data.container);
  }

  startLongPress(item: Media, event: MouseEvent | TouchEvent) {
    if (!this.isOwnProfile()) return;
    event.preventDefault();

    this.pressTimer = setTimeout(() => {
      this.mediaPendingDeletion.set(item);
    }, 600);
  }

  cancelLongPress() {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  async confirmDeleteMedia() {
    const item = this.mediaPendingDeletion();
    if (!item) return;

    try {
      await this.userService.deleteMediaByUrl(item.url);
      this.mediaPendingDeletion.set(null);
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  }

  cancelDelete() {
    this.mediaPendingDeletion.set(null);
  }

  isOwnProfile = computed(() => {
    const usernameParam = this.routeUsername();
    const sessionUser = this.userService.currentUser();
    return usernameParam === sessionUser?.username;
  });

  livingCanton = computed(() => {
    return (
      this.profileUser()?.country ??
      this.profileDetails().canton ??
      'Not specified'
    );
  });

  userAge = computed(() => {
    const dobStr = this.profileDetails().dateOfBirth;
    if (!dobStr) return null;

    const dob = new Date(dobStr);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  });

  media = computed(() => this.mediaList());

  cancelPreview() {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
  }

  openMedia(item: Media) {
    this.selectedMediaItem.set(item);
  }

  closeMedia() {
    this.selectedMediaItem.set(null);
  }

  activeProfileView = signal<'main' | 'edit'>('main');

  setProfileView(view: 'main' | 'edit') {
    this.activeProfileView.set(view);
  }

  saveProfile(updatedData: {
    displayName: string;
    description: string;
    username: string;
  }) {
    const current = this.profileUser();
    if (current) {
      this.profileUser.set({
        ...current,
        displayName: updatedData.displayName,
        username: updatedData.username,
        description: updatedData.description,
      });
    }

    this.setProfileView('main');
  }

  goBack() {
    window.history.back();
  }
}
