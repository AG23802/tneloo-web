import { MediaType } from './media.model';

// A media item annotated with its owner's display info, for feeds (search
// grid) that show media from many different users at once.
export interface FeedMedia {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  uid: string;
  username: string;
  profilePictureURL: string;
}
