import { User } from '../../../core/models/user.model';
import { FeedMedia } from '../../../core/models/feed-media';
import { ThreadParticipantInfo } from '../models/thread.model';
import { Message } from '../models/message.model';

// A chat message's media has no owner display info of its own - it just
// carries the sender's uid. This resolves that against whichever side of
// the conversation actually sent it, so it can be shown in the shared
// MediaViewerModal (which expects a FeedMedia, owner info included).
export function messageToFeedMedia(
  message: Message,
  currentUid: string | undefined,
  currentUser: User | null,
  otherUser: ThreadParticipantInfo | null,
): FeedMedia | null {
  if (!message.media) return null;

  const isOwnMessage = message.uid === currentUid;
  const sender = isOwnMessage ? currentUser : otherUser;

  return {
    id: message.id ?? message.media.url,
    type: message.media.type,
    url: message.media.url,
    thumbnailUrl: message.media.thumbnailUrl,
    duration: message.media.duration,
    uid: sender?.uid ?? message.uid,
    username: sender?.username ?? '',
    profilePictureURL: sender?.profilePictureURL ?? '',
  };
}
