import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../../../components/icon/icon';
import { ChatHeader } from '../../../../chat-header/chat-header';
import { UserService } from '../../../../core/services/user.service';
import { UserProfileMeta } from '../../models/user-profile-meta.model';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ReactiveFormsModule, ChatHeader],
  templateUrl: './thread-view.html',
  styleUrl: './thread-view.css',
})
export class ThreadView implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public chatService = inject(ChatService);
  public userService = inject(UserService);

  private routeSub?: Subscription;

  threadId = signal<string | null>(null);
  currentUid = signal<string | undefined>(undefined);

  targetMeta = signal<UserProfileMeta>({ displayName: '' });
  newMessageText = '';

  ngOnInit() {
    // 1. Read threadId directly from the route parameters
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const threadId = params.get('threadId');
      this.threadId.set(threadId);

      const currentUser = this.userService.currentUser();
      this.currentUid.set(currentUser?.uid);

      if (threadId) {
        // 2. Load messages for this thread via service
        this.chatService.subscribeToMessages(threadId);
        this.loadThreadMeta(threadId);
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.chatService.clearMessages();
  }

  private loadThreadMeta(threadId: string) {
    const thread = this.chatService.threads().find((t) => t.id === threadId);
    if (thread) {
      const currentUid = this.userService.currentUser()?.uid;
      const otherUid = thread.participants.find((p) => p !== currentUid);
      if (otherUid) {
        // Pull user meta or fetch it if missing
        this.userService.getUserById?.(otherUid)?.subscribe((user) => {
          if (user) {
            this.targetMeta.set({
              displayName: user.displayName || '',
              profilePictureURL: user.profilePictureURL,
            });
          }
        });
      }
    }
  }

  onBackClicked() {
    this.router.navigate(['/chats']);
  }

  async handleSendMessage(text: string) {
    const currentUser = this.userService.currentUser();
    const threadId = this.threadId();
    if (!currentUser || !threadId) return;

    const thread = this.chatService.threads().find((t) => t.id === threadId);
    const recipientId = thread?.participants.find((p) => p !== currentUser.uid);

    if (!recipientId) return;

    await this.chatService.sendMessage(text, threadId, recipientId, currentUser.uid);
  }
}
