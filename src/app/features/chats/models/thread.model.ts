export interface ThreadParticipantInfo {
  uid: string;
  username: string;
  displayName: string;
  profilePictureURL: string | null;
}

export interface Thread {
  id: string;
  participants: string[];
  participantsInfo: Record<string, ThreadParticipantInfo>;
  createdAt: any;
  lastMessage?: string;
  lastMessageTime?: any;
}

// Pure lookup, no service dependency - shared by ChatService (the threads
// list) and ThreadService (a single open conversation) without either
// needing to depend on the other.
export function getOtherParticipantUid(thread: Thread, currentUserId: string): string | undefined {
  return thread.participants?.find((uid) => uid !== currentUserId);
}
