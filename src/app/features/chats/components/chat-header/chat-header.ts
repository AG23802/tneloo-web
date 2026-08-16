import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { Avatar } from '../../../../components/avatar/avatar.component';
import { ThreadParticipantInfo } from '../../models/thread.model';

@Component({
  selector: 'app-chat-header',
  imports: [IconComponent, Avatar],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.css',
})
export class ChatHeader {
  user = input<ThreadParticipantInfo | null>();
  event = output();
}
