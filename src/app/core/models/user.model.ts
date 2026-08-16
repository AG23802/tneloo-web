import { Media } from './media.model';

export interface User {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  media?: Media[];
  description?: string;
  profilePictureURL?: string;
  createdAt?: string;
  country?: string;
  tokens: number;
}
