import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  QueryDocumentSnapshot,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
} from 'firebase/firestore';
import { Router } from '@angular/router';
import app from '../../../core/firebase';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { Thread } from '../models/thread.model';
import { Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly firestore = getFirestore(app);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly threadBatchSize = 20;
  private readonly messageBatchSize = 15;
  private lastThreadDoc: QueryDocumentSnapshot | null = null;
  private oldestMessageDoc: QueryDocumentSnapshot | null = null;
  private messagesUnsubscribe: (() => void) | null = null;
  private threadsUnsubscribe: (() => void) | null = null;
  private currentActiveThreadId: string | null = null;
  private currentRecipientId: string | null = null;

  readonly threads = signal<Thread[]>([]);
  readonly messages = signal<Message[]>([]);
  readonly userMeta = signal<Record<string, User>>({});
  readonly hasMoreThreads = signal(true);
  readonly isLoadingMoreThreads = signal(false);
  readonly hasMoreMessages = signal(true);
  readonly isLoadingMoreMessages = signal(false);
  readonly initialMessagesLoaded = signal(false);

  readonly enrichedThreads = computed(() => {
    const currentUser = this.userService.currentUser();
    const meta = this.userMeta();
    if (!currentUser) return [];
    return this.threads().map((thread) => {
      const uid = this.getOtherParticipantUid(thread, currentUser.uid);
      if (uid && !meta[uid]) this.fetchUserMeta(uid);
      return { ...thread, targetUser: uid ? (meta[uid] ?? null) : null };
    });
  });

  constructor() {
    effect(() => {
      const currentUser = this.userService.currentUser();
      if (currentUser) this.loadInitialThreads(currentUser.uid);
      else this.clearThreads();
    });
  }

  private fetchUserMeta(uid: string): void {
    this.userService.getUserById?.(uid)?.subscribe((user) => {
      if (user) this.userMeta.update((meta) => ({ ...meta, [uid]: user }));
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

  getOtherParticipantUid(thread: Thread, currentUserId: string): string | undefined {
    return thread.participants?.find((uid) => uid !== currentUserId);
  }

  async findExistingThread(userA: string, userB: string): Promise<string | null> {
    const snapshot = await getDocs(
      query(collection(this.firestore, 'threads'), where('participants', 'array-contains', userA)),
    );
    return (
      snapshot.docs.find((snap) => (snap.data()['participants'] ?? []).includes(userB))?.id ?? null
    );
  }

  subscribeToMessages(threadId: string): void {
    this.messagesUnsubscribe?.();
    this.messages.set([]);
    this.oldestMessageDoc = null;
    this.hasMoreMessages.set(true);
    this.initialMessagesLoaded.set(false);
    let firstSnapshot = true;
    const q = query(
      collection(this.firestore, 'threads', threadId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(this.messageBatchSize),
    );

    this.messagesUnsubscribe = onSnapshot(q, (snapshot) => {
      const newest = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }) as Message)
        .reverse();
      if (firstSnapshot) {
        firstSnapshot = false;
        this.oldestMessageDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
        this.hasMoreMessages.set(snapshot.docs.length === this.messageBatchSize);
        this.messages.set(newest);
        this.initialMessagesLoaded.set(true);
        return;
      }

      // A realtime update only contains the newest page. Keep earlier pages.
      const newestIds = new Set(newest.map((message) => message.id));
      this.messages.update((existing) => [
        ...existing.filter((message) => !newestIds.has(message.id)),
        ...newest,
      ]);
    });
  }

  // Fetches the next older page but does not apply it to `messages` — the
  // caller (thread-view) is responsible for splicing it in so it can manage
  // scroll position around the DOM update.
  async loadMoreMessages(threadId: string): Promise<Message[]> {
    if (this.isLoadingMoreMessages() || !this.hasMoreMessages() || !this.oldestMessageDoc) {
      console.log('[chat.service] loadMoreMessages: skipped', {
        isLoadingMoreMessages: this.isLoadingMoreMessages(),
        hasMoreMessages: this.hasMoreMessages(),
        hasOldestMessageDoc: !!this.oldestMessageDoc,
      });
      return [];
    }
    this.isLoadingMoreMessages.set(true);
    console.log('[chat.service] loadMoreMessages: fetching', { threadId });
    try {
      const q = query(
        collection(this.firestore, 'threads', threadId, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(this.oldestMessageDoc),
        limit(this.messageBatchSize),
      );
      const snapshot = await getDocs(q);
      const older = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }) as Message)
        .reverse();
      this.oldestMessageDoc = snapshot.docs[snapshot.docs.length - 1] ?? this.oldestMessageDoc;
      this.hasMoreMessages.set(snapshot.docs.length === this.messageBatchSize);
      const ids = new Set(this.messages().map((message) => message.id));
      const deduped = older.filter((message) => !ids.has(message.id));
      console.log('[chat.service] loadMoreMessages: fetched', {
        docCount: snapshot.docs.length,
        dedupedCount: deduped.length,
        hasMoreMessages: this.hasMoreMessages(),
      });
      return deduped;
    } catch (error) {
      console.error('[chat.service] loadMoreMessages: error', error);
      return [];
    } finally {
      this.isLoadingMoreMessages.set(false);
    }
  }

  prependMessages(messages: Message[]): void {
    if (!messages.length) return;
    this.messages.update((existing) => [...messages, ...existing]);
    console.log('[chat.service] prependMessages: applied', { count: messages.length });
  }

  clearMessages(): void {
    this.messages.set([]);
    this.oldestMessageDoc = null;
    this.hasMoreMessages.set(true);
    this.initialMessagesLoaded.set(false);
    this.currentActiveThreadId = null;
    this.currentRecipientId = null;
    this.messagesUnsubscribe?.();
    this.messagesUnsubscribe = null;
  }

  async sendMessage(textInput: string): Promise<string | null> {
    const text = textInput.trim();
    const user = this.userService.currentUser();
    if (!text || !user) return null;
    try {
      let threadId = this.currentActiveThreadId;
      let recipientId = this.currentRecipientId;
      if (!recipientId && threadId) {
        const thread = await this.getOrFindThread(threadId);
        recipientId = thread ? (this.getOtherParticipantUid(thread, user.uid) ?? null) : null;
        this.currentRecipientId = recipientId;
      }
      if (!recipientId) return null;
      if (!threadId) {
        threadId = await this.createNewThread(user.uid, recipientId, text);
        this.currentActiveThreadId = threadId;
        await this.router.navigate(['/thread', threadId], { replaceUrl: true });
      }
      const threadRef = doc(this.firestore, 'threads', threadId);
      const messageRef = doc(collection(threadRef, 'messages'));
      await Promise.all([
        setDoc(messageRef, {
          id: messageRef.id,
          threadId,
          uid: user.uid,
          receiverId: recipientId,
          text,
          createdAt: serverTimestamp(),
        }),
        setDoc(
          threadRef,
          { lastMessage: text, lastMessageTime: serverTimestamp() },
          { merge: true },
        ),
      ]);
      return threadId;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  private async createNewThread(
    currentUserId: string,
    recipientId: string,
    text: string,
  ): Promise<string> {
    const ref = doc(collection(this.firestore, 'threads'));
    const data = {
      id: ref.id,
      participants: [currentUserId, recipientId],
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
    };
    await setDoc(ref, data);
    this.threads.update((threads) => [
      { ...data, lastMessage: text, lastMessageTime: new Date() } as Thread,
      ...threads,
    ]);
    this.subscribeToMessages(ref.id);
    return ref.id;
  }

  private async getOrFindThread(threadId: string): Promise<Thread | null> {
    let thread = this.threads().find((item) => item.id === threadId);
    if (!thread) {
      const snap = await getDoc(doc(this.firestore, 'threads', threadId));
      if (snap.exists()) thread = { id: snap.id, ...snap.data() } as Thread;
    }
    return thread ?? null;
  }

  async initializeActiveThread(
    threadId: string | null,
    recipientId: string | null,
    currentUid: string,
  ): Promise<{ threadId: string | null; targetUid: string | null }> {
    this.currentActiveThreadId = threadId;
    this.currentRecipientId = recipientId;
    if (threadId) {
      this.subscribeToMessages(threadId);
      const thread = await this.getOrFindThread(threadId);
      const targetUid = thread ? (this.getOtherParticipantUid(thread, currentUid) ?? null) : null;
      this.currentRecipientId = targetUid;
      return { threadId, targetUid };
    }
    if (!recipientId) return { threadId: null, targetUid: null };
    const existingId = await this.findExistingThread(currentUid, recipientId);
    if (!existingId) return { threadId: null, targetUid: recipientId };
    this.currentActiveThreadId = existingId;
    this.subscribeToMessages(existingId);
    await this.router.navigate(['/thread', existingId], { replaceUrl: true });
    return { threadId: existingId, targetUid: recipientId };
  }
}
