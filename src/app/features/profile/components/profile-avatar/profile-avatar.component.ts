import { Component, inject, input } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';

@Component({
  selector: 'app-profile-avatar',
  templateUrl: './profile-avatar.component.html',
  styleUrl: './profile-avatar.component.css',
  imports: [IconComponent],
})
export class ProfileAvatar {
  profilePictureURL = input<string | null | undefined>();
  isOwnProfile = input(false);
}
