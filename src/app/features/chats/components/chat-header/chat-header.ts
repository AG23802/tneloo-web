import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { Avatar } from '../../../../components/avatar/avatar.component';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-chat-header',
  imports: [IconComponent, Avatar],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.css',
})
export class ChatHeader {
  user = input<User | null>();
  event = output();
}
