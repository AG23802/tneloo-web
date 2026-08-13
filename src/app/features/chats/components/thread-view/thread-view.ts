import {
  Component,
  inject,
  signal,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatHeader } from '../chat-header/chat-header';
import { UserService } from '../../../../core/services/user.service';
import { ChatService } from '../../services/chat.service';
import { ChatInput } from '../chat-input/chat-input/chat-input';
import { Subscription } from 'rxjs';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ChatHeader, ChatInput],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute); // Route belongs here!
  public chatService = inject(ChatService);
  public userService = inject(UserService);

  threadId = signal<string | null>(null);
  currentUid = signal<string | undefined>(undefined);
  user = signal<User | null>(null);
  recipientId = signal<string | null>(null);
  private userMetaSub?: Subscription;

  async ngOnInit() {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return;
    this.currentUid.set(currentUser.uid);

    // 1. Read route and history state right here in the component
    const threadIdParam = this.route.snapshot.paramMap.get('threadId');
    const rawRecipientId = history.state?.recipientId || null;
    this.recipientId.set(rawRecipientId);

    // 2. Hand them over to the service to process
    const result = await this.chatService.initializeActiveThread(
      threadIdParam,
      rawRecipientId,
      currentUser.uid,
    );

    if (result.threadId) {
      this.threadId.set(result.threadId);
    }

    if (result.targetUid) {
      this.fetchUser(result.targetUid);
    }
  }

  private fetchUser(uid: string) {
    this.userMetaSub = this.userService.getUserById?.(uid)?.subscribe((user) => {
      if (user) {
        this.user.set(user); // Set the whole object directly!
      }
    });
  }

  onBackClicked() {
    this.router.navigate(['/chats']);
  }

  ngOnDestroy() {
    this.chatService.clearMessages();
    this.userMetaSub?.unsubscribe();
  }
}
