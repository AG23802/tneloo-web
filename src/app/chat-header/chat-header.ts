import { Component, input, output } from '@angular/core';
import { IconComponent } from '../components/icon/icon';
import { UserProfileMeta } from '../features/chats/models/user-profile-meta.model';
import { Avatar } from '../components/avatar/avatar.component';

@Component({
  selector: 'app-chat-header',
  imports: [IconComponent, Avatar],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.css',
})
export class ChatHeader {
  title = input<string>();
  url = input<string>();
  displayName = input<string>();
  event = output();
}
