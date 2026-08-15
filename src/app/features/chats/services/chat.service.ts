import { inject, signal, computed, effect } from '@angular/core';
import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  getDoc,
  startAfter,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import app from '../../../core/firebase';
import { Thread } from '../models/thread.model';
import { Message } from '../models/message.model';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private firestore = getFirestore(app);
  private router = inject(Router);
  private userService = inject(UserService);

  threads = signal<Thread[]>([]);
  messages = signal<Message[]>([]);
  userMeta = signal<{ [uid: string]: User }>({});

  // Pagination states for threads
  hasMoreThreads = signal<boolean>(true);
  isLoadingMoreThreads = signal<boolean>(false);
  private lastThreadDoc: QueryDocumentSnapshot | null = null;
  private threadBatchSize = 20;

  // Pagination states for messages
  hasMoreMessages = signal<boolean>(true);
  isLoadingMoreMessages = signal<boolean>(false);
  private messageBatchSize = 10;

  enrichedThreads = computed(() => {
    const currentUser = this.userService.currentUser();
    const currentThreads = this.threads();
    const meta = this.userMeta();

    if (!currentUser) return [];

    return currentThreads.map((thread) => {
      const otherUid = this.getOtherParticipantUid(thread, currentUser.uid);

      if (otherUid && !meta[otherUid]) {
        this.fetchUserMeta(otherUid);
      }

      return {
        ...thread,
        targetUser: otherUid ? meta[otherUid] || null : null,
      };
    });
  });

  private currentActiveThreadId: string | null = null;
  private currentRecipientId: string | null = null;

  private threadsUnsubscribe: (() => void) | null = null;
  private messagesUnsubscribe: (() => void) | null = null;

  constructor() {
    effect(() => {
      const currentUser = this.userService.currentUser();
      if (currentUser) {
        this.loadInitialThreads(currentUser.uid);
      } else {
        this.clearThreads();
      }
    });
  }

  private fetchUserMeta(uid: string) {
    this.userService.getUserById?.(uid)?.subscribe({
      next: (user: User | null) => {
        if (user) {
          this.userMeta.update((meta) => ({
            ...meta,
            [uid]: user,
          }));
        }
      },
    });
  }

  loadInitialThreads(userId: string) {
    if (this.threadsUnsubscribe) return;

    const threadsRef = collection(this.firestore, 'threads');
    const q = query(
      threadsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc'),
      limit(this.threadBatchSize),
    );

    this.threadsUnsubscribe = onSnapshot(q, (snapshot) => {
      const userThreads: Thread[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
        } as Thread;
      });

      this.lastThreadDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      this.hasMoreThreads.set(snapshot.docs.length === this.threadBatchSize);
      this.threads.set(userThreads);
    });
  }

  async loadMoreThreads() {
    const currentUser = this.userService.currentUser();
    if (
      !currentUser ||
      this.isLoadingMoreThreads() ||
      !this.hasMoreThreads() ||
      !this.lastThreadDoc
    )
      return;

    this.isLoadingMoreThreads.set(true);

    try {
      const threadsRef = collection(this.firestore, 'threads');
      const q = query(
        threadsRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc'),
        startAfter(this.lastThreadDoc),
        limit(this.threadBatchSize),
      );

      const snapshot = await getDocs(q);
      const moreThreads: Thread[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
        } as Thread;
      });

      if (snapshot.docs.length > 0) {
        this.lastThreadDoc = snapshot.docs[snapshot.docs.length - 1];
      }

      if (snapshot.docs.length < this.threadBatchSize) {
        this.hasMoreThreads.set(false);
      }

      this.threads.update((existing) => [...existing, ...moreThreads]);
    } catch (err) {
      console.error('Error loading more threads:', err);
    } finally {
      this.isLoadingMoreThreads.set(false);
    }
  }

  clearThreads() {
    this.threads.set([]);
    this.lastThreadDoc = null;
    this.hasMoreThreads.set(true);
    if (this.threadsUnsubscribe) {
      this.threadsUnsubscribe();
      this.threadsUnsubscribe = null;
    }
  }

  getOtherParticipantUid(thread: Thread, currentUserId: string): string | undefined {
    return thread.participants?.find((p) => p !== currentUserId);
  }

  async findExistingThread(userA: string, userB: string): Promise<string | null> {
    const threadsRef = collection(this.firestore, 'threads');
    const q = query(threadsRef, where('participants', 'array-contains', userA));
    const snapshot = await getDocs(q);

    const matchingDoc = snapshot.docs.find((docSnap) => {
      const participants: string[] = docSnap.data()['participants'] || [];
      return participants.includes(userB);
    });

    return matchingDoc ? matchingDoc.id : null;
  }

  subscribeToMessages(threadId: string) {
    if (this.messagesUnsubscribe) this.messagesUnsubscribe();

    this.hasMoreMessages.set(true);
    const messagesRef = collection(this.firestore, 'threads', threadId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(this.messageBatchSize));

    this.messagesUnsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          } as Message;
        })
        .reverse();

      this.hasMoreMessages.set(snapshot.docs.length === this.messageBatchSize);
      this.messages.set(msgs);
    });
  }

  async loadMoreMessages(threadId: string) {
    if (this.isLoadingMoreMessages() || !this.hasMoreMessages() || this.messages().length === 0)
      return;

    this.isLoadingMoreMessages.set(true);

    try {
      const messagesRef = collection(this.firestore, 'threads', threadId, 'messages');
      const oldestMessage = this.messages()[0];
      const oldestDocSnap = await getDoc(
        doc(this.firestore, 'threads', threadId, 'messages', oldestMessage.id!),
      );

      if (!oldestDocSnap.exists()) {
        this.hasMoreMessages.set(false);
        return;
      }

      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(oldestDocSnap),
        limit(this.messageBatchSize),
      );

      const snapshot = await getDocs(q);
      const olderMsgs: Message[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          } as Message;
        })
        .reverse();

      if (snapshot.docs.length < this.messageBatchSize) {
        this.hasMoreMessages.set(false);
      }

      if (olderMsgs.length > 0) {
        this.messages.update((existing) => [...olderMsgs, ...existing]);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      this.isLoadingMoreMessages.set(false);
    }
  }

  clearMessages() {
    this.messages.set([]);
    this.hasMoreMessages.set(true);
    this.currentActiveThreadId = null;
    this.currentRecipientId = null;
    if (this.messagesUnsubscribe) {
      this.messagesUnsubscribe();
      this.messagesUnsubscribe = null;
    }
  }

  async sendMessage(textInput: string): Promise<string | null> {
    const text = textInput.trim();
    const currentUser = this.userService.currentUser();
    if (!text || !currentUser) return null;

    try {
      let activeThreadId = this.currentActiveThreadId;
      let recipientId = this.currentRecipientId;

      if (!recipientId && activeThreadId) {
        const thread = await this.getOrFindThread(activeThreadId);
        recipientId = thread ? this.getOtherParticipantUid(thread, currentUser.uid) || null : null;
        this.currentRecipientId = recipientId;
      }

      if (!recipientId) return null;

      if (!activeThreadId) {
        activeThreadId = await this.createNewThread(currentUser.uid, recipientId, text);
        this.currentActiveThreadId = activeThreadId;
        this.router.navigate(['/thread', activeThreadId], { replaceUrl: true });
      }

      const threadRef = doc(this.firestore, 'threads', activeThreadId);
      const newMessageRef = doc(collection(threadRef, 'messages'));

      const messageData = {
        id: newMessageRef.id,
        threadId: activeThreadId,
        uid: currentUser.uid,
        receiverId: recipientId,
        text: text,
        createdAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(newMessageRef, messageData),
        setDoc(
          threadRef,
          { lastMessage: text, lastMessageTime: serverTimestamp() },
          { merge: true },
        ),
      ]);

      return activeThreadId;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }

  private async createNewThread(
    currentUserId: string,
    recipientId: string,
    text: string,
  ): Promise<string> {
    const newThreadRef = doc(collection(this.firestore, 'threads'));
    const threadId = newThreadRef.id;

    const newThreadData = {
      id: threadId,
      participants: [currentUserId, recipientId],
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
    };

    await setDoc(newThreadRef, newThreadData);

    this.threads.update((currentThreads) => [
      { ...newThreadData, lastMessage: text, lastMessageTime: new Date() } as Thread,
      ...currentThreads,
    ]);

    this.subscribeToMessages(threadId);
    return threadId;
  }

  private async getOrFindThread(threadId: string): Promise<Thread | null> {
    let thread = this.threads().find((t) => t.id === threadId);
    if (!thread) {
      const docSnap = await getDoc(doc(this.firestore, 'threads', threadId));
      thread = docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Thread) : undefined;
    }
    return thread || null;
  }

  async initializeActiveThread(
    threadIdParam: string | null,
    recipientId: string | null,
    currentUid: string,
  ) {
    this.currentActiveThreadId = threadIdParam;
    this.currentRecipientId = recipientId;

    if (threadIdParam) {
      this.subscribeToMessages(threadIdParam);
      const thread = await this.getOrFindThread(threadIdParam);
      const targetUid = thread ? this.getOtherParticipantUid(thread, currentUid) : null;
      if (targetUid) {
        this.currentRecipientId = targetUid;
      }
      return {
        threadId: threadIdParam,
        targetUid: targetUid,
      };
    }

    if (recipientId) {
      const existingThreadId = await this.findExistingThread(currentUid, recipientId);
      if (existingThreadId) {
        this.currentActiveThreadId = existingThreadId;
        this.currentRecipientId = recipientId;
        this.subscribeToMessages(existingThreadId);
        this.router.navigate(['/thread', existingThreadId], { replaceUrl: true });
        return { threadId: existingThreadId, targetUid: recipientId };
      }
      return { threadId: null, targetUid: recipientId };
    }

    return { threadId: null, targetUid: null };
  }
}
