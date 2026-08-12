import { Photo } from './photo.model';

export interface User {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  photos?: Photo[];
  description?: string;
  profilePictureURL?: string;
  createdAt?: string;
  country?: string;
  tokens: number;
}
