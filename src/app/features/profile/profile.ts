import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ProfileAvatar } from './components/profile-avatar/profile-avatar.component';
import { UserService } from '../../core/services/user.service';
import { IconComponent } from '../../components/icon/icon';
import { CommonModule } from '@angular/common';
import { User } from '../../core/models/user.model';
import { Content } from '../../core/models/content.model';
import { MediaViewerModal } from '../../components/media-viewer-modal/media-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';

interface UserProfileDetails {
  dateOfBirth?: string;
  canton?: string;
}

// A buyer viewing a creator's public profile - reached by tapping into her
// from Home/Search. Read-only: no upload, no edit, no delete, no settings
// entry point here. A creator never lands on this component for herself -
// her own content is managed from the Content tab instead.
@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  imports: [ProfileAvatar, CommonModule, IconComponent, RouterModule, MediaViewerModal, TranslatePipe],
})
export class Profile {
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  private routeParamMap = toSignal(this.route.paramMap);
  routeUsername = computed(() => this.routeParamMap()?.get('username') ?? null);

  profileUser = signal<User | null>(null);
  mediaList = signal<Content[]>([]);
  selectedMediaItem = signal<Content | null>(null);

  private profileDetails = signal<UserProfileDetails>({
    dateOfBirth: '1995-04-12',
    canton: 'Aargau (AG)',
  });

  constructor() {
    effect((onCleanup) => {
      const targetUsername = this.routeUsername();
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

      const subscription = this.userService.getUserContent(user.uid).subscribe({
        next: (content) => this.mediaList.set(content),
        error: (err) => console.error('Error fetching content:', err),
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

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

  openMedia(item: Content) {
    this.selectedMediaItem.set(item);
  }

  closeMedia() {
    this.selectedMediaItem.set(null);
  }

  goBack() {
    window.history.back();
  }
}
