export type UserRole = 'buyer' | 'creator';

export interface User {
  uid: string;
  // Set once at signup; client-writable at doc creation but blocked from
  // client updates afterward (see firestore.rules) - accounts predating
  // this field have none, so every read of `role` falls back to 'buyer'.
  role?: UserRole;
  username: string;
  email: string;
  displayName?: string;
  description?: string;
  profilePictureURL?: string;
  createdAt?: string;
  country?: string; // Cloud-Function-only, set by the Stripe webhook
  stripeCustomerId?: string; // Cloud-Function-only
  tokenBalance?: number; // Cloud-Function-only; buyer-meaningful, defaults to 0
  pendingEarnings?: number; // Cloud-Function-only; creator-meaningful, defaults to 0
}
