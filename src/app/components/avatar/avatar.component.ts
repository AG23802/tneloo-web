import { Component, input, signal } from '@angular/core';
import { AvatarUser } from '../../core/models/avatar-user.model';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  imports: [IconComponent],
})
export class Avatar {
  url = input<string | null | undefined>(null);
  imageFailed = signal(false);
}
