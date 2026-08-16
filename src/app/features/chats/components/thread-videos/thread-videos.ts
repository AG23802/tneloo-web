import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IconComponent } from '../../../../components/icon/icon';
import { MediaViewerModal } from '../../../../components/media-viewer-modal/media-viewer-modal';
import { FeedMedia } from '../../../../core/models/feed-media';
import { UserService } from '../../../../core/services/user.service';
import { ThreadService } from '../../services/thread.service';
import { getOtherParticipantUid } from '../../models/thread.model';
import { messageToFeedMedia } from '../../utils/message-to-feed-media';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-thread-videos',
  standalone: true,
  imports: [IconComponent, MediaViewerModal, TranslatePipe],
  templateUrl: './thread-videos.html',
  styleUrl: './thread-videos.css',
})
export class ThreadVideos implements OnInit {
  private route = inject(ActivatedRoute);
  private threadService = inject(ThreadService);
  private userService = inject(UserService);

  readonly videos = signal<FeedMedia[]>([]);
  readonly isLoading = signal(true);
  readonly selectedVideo = signal<FeedMedia | null>(null);

  async ngOnInit(): Promise<void> {
    const threadId = this.route.snapshot.paramMap.get('threadId');
    const currentUser = this.userService.currentUser();
    if (!threadId || !currentUser) {
      this.isLoading.set(false);
      return;
    }

    const [thread, messages] = await Promise.all([
      this.threadService.getThread(threadId),
      this.threadService.getThreadVideos(threadId),
    ]);

    const otherUid = thread ? getOtherParticipantUid(thread, currentUser.uid) : undefined;
    const otherUser = otherUid ? (thread?.participantsInfo?.[otherUid] ?? null) : null;

    this.videos.set(
      messages
        .map((message) => messageToFeedMedia(message, currentUser.uid, currentUser, otherUser))
        .filter((item): item is FeedMedia => item !== null),
    );
    this.isLoading.set(false);
  }

  openVideo(video: FeedMedia): void {
    this.selectedVideo.set(video);
  }

  closeVideo(): void {
    this.selectedVideo.set(null);
  }

  goBack(): void {
    window.history.back();
  }
}
