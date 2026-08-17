import { MediaType } from '../../../core/models/content.model';

export interface MessageMedia {
  url: string;
  type: MediaType;
  thumbnailUrl?: string | null;
  duration?: number | null;
}

export interface Message {
  id?: string;
  threadId: string;
  uid: string;
  receiverId: string;
  // A message needs text, media, or both - never neither.
  text?: string;
  media?: MessageMedia;
  createdAt: any;
}
