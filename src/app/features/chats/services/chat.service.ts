import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  QueryDocumentSnapshot,
  collection,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import app from '../../../core/firebase';
import { UserService } from '../../../core/services/user.service';
import { Thread, getOtherParticipantUid } from '../models/thread.model';

// The threads list only - opening/messaging within a specific conversation
// is ThreadService's job (see thread.service.ts). Chats (the list view)
// depends on this; ThreadView depends on ThreadService instead.
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly firestore = getFirestore(app);
  private readonly userService = inject(UserService);
  private readonly threadBatchSize = 20;
  private lastThreadDoc: QueryDocumentSnapshot | null = null;
  private threadsUnsubscribe: (() => void) | null = null;

  readonly threads = signal<Thread[]>([]);
  readonly hasMoreThreads = signal(true);
  readonly isLoadingMoreThreads = signal(false);

  // Every thread carries a denormalized copy of each participant's display
  // info, seeded at creation (ThreadService.createNewThread) and kept in
  // sync afterward by a Cloud Function trigger on users/{uid} - so this is
  // just a lookup, no extra read against `users` needed.
  readonly enrichedThreads = computed(() => {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return [];
    return this.threads().map((thread) => {
      const uid = getOtherParticipantUid(thread, currentUser.uid);
      return { ...thread, targetUser: uid ? (thread.participantsInfo?.[uid] ?? null) : null };
    });
  });

  constructor() {
    effect(() => {
      const currentUser = this.userService.currentUser();
      if (currentUser) this.loadInitialThreads(currentUser.uid);
      else this.clearThreads();
    });
  }

  loadInitialThreads(userId: string): void {
    if (this.threadsUnsubscribe) return;
    const ref = collection(this.firestore, 'threads');
    const q = query(
      ref,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc'),
      limit(this.threadBatchSize),
    );
    this.threadsUnsubscribe = onSnapshot(q, (snapshot) => {
      this.threads.set(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as Thread));
      this.lastThreadDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
      this.hasMoreThreads.set(snapshot.docs.length === this.threadBatchSize);
    });
  }

  async loadMoreThreads(): Promise<void> {
    const user = this.userService.currentUser();
    if (!user || !this.lastThreadDoc || this.isLoadingMoreThreads() || !this.hasMoreThreads())
      return;
    this.isLoadingMoreThreads.set(true);
    try {
      const q = query(
        collection(this.firestore, 'threads'),
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessageTime', 'desc'),
        startAfter(this.lastThreadDoc),
        limit(this.threadBatchSize),
      );
      const snapshot = await getDocs(q);
      const more = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }) as Thread);
      this.lastThreadDoc = snapshot.docs[snapshot.docs.length - 1] ?? this.lastThreadDoc;
      this.hasMoreThreads.set(snapshot.docs.length === this.threadBatchSize);
      this.threads.update((threads) => [...threads, ...more]);
    } catch (error) {
      console.error('Error loading more threads:', error);
    } finally {
      this.isLoadingMoreThreads.set(false);
    }
  }

  clearThreads(): void {
    this.threads.set([]);
    this.lastThreadDoc = null;
    this.hasMoreThreads.set(true);
    this.threadsUnsubscribe?.();
    this.threadsUnsubscribe = null;
  }
}
