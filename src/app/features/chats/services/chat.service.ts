import { inject, Injectable, signal } from '@angular/core';
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
} from 'firebase/firestore';
import app from '../../../core/firebase';
import { Thread } from '../models/thread.model';
import { Message } from '../models/message.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private firestore = getFirestore(app);
  private router = inject(Router);

  threads = signal<Thread[]>([]);
  messages = signal<Message[]>([]);

  private threadsUnsubscribe: (() => void) | null = null;
  private messagesUnsubscribe: (() => void) | null = null;

  async initializeActiveThread(
    threadIdParam: string | null,
    recipientId: string | null,
    currentUid: string,
  ) {
    if (threadIdParam) {
      this.subscribeToMessages(threadIdParam);
      let thread = this.threads().find((t) => t.id === threadIdParam);
      if (!thread) thread = (await this.getThreadById(threadIdParam)) ?? undefined;

      return {
        threadId: threadIdParam,
        targetUid: thread ? this.getOtherParticipantUid(thread, currentUid) : null,
      };
    }

    if (recipientId) {
      const existingThreadId = await this.findExistingThread(currentUid, recipientId);
      if (existingThreadId) {
        this.subscribeToMessages(existingThreadId);
        this.router.navigate(['/thread', existingThreadId], { replaceUrl: true });
        return {
          threadId: existingThreadId,
          targetUid: recipientId,
        };
      }
      return {
        threadId: null,
        targetUid: recipientId, // Brand new chat
      };
    }

    return { threadId: null, targetUid: null };
  }

  loadUserThreads(userId: string) {
    if (this.threadsUnsubscribe) return;

    const threadsRef = collection(this.firestore, 'threads');
    const q = query(
      threadsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc'),
      limit(20),
    );

    this.threadsUnsubscribe = onSnapshot(q, (snapshot) => {
      const userThreads: Thread[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Thread[];

      this.threads.set(userThreads);
    });
  }

  getOtherParticipantUid(thread: Thread, currentUserId: string): string | undefined {
    return thread.participants?.find((p) => p !== currentUserId);
  }

  async findExistingThread(userA: string, userB: string): Promise<string | null> {
    const threadsRef = collection(this.firestore, 'threads');
    const q = query(threadsRef, where('participants', 'array-contains', userA));
    const snapshot = await getDocs(q);

    const matchingDoc = snapshot.docs.find((docSnap) => {
      const data = docSnap.data();
      const participants: string[] = data['participants'] || [];
      return participants.includes(userB);
    });

    return matchingDoc ? matchingDoc.id : null;
  }

  subscribeToMessages(threadId: string) {
    if (this.messagesUnsubscribe) this.messagesUnsubscribe();

    const messagesRef = collection(this.firestore, 'threads', threadId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(50));

    this.messagesUnsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as Message,
      );

      this.messages.set(msgs);
    });
  }

  clearMessages() {
    this.messages.set([]);
    if (this.messagesUnsubscribe) {
      this.messagesUnsubscribe();
      this.messagesUnsubscribe = null;
    }
  }

  async createNewThread(currentUserId: string, recipientId: string, text: string): Promise<string> {
    const newThreadRef = doc(collection(this.firestore, 'threads'));
    const activeThreadId = newThreadRef.id;

    const newThreadData = {
      id: activeThreadId,
      participants: [currentUserId, recipientId],
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
    };

    await setDoc(newThreadRef, newThreadData);

    this.threads.update((currentThreads) => [
      {
        ...newThreadData,
        lastMessage: text,
        lastMessageTime: new Date(),
      } as Thread,
      ...currentThreads,
    ]);

    this.subscribeToMessages(activeThreadId);

    return activeThreadId;
  }

  async sendMessage(
    textInput: string,
    threadId: string | null,
    recipientId: string | null,
    currentUserId: string,
  ): Promise<string | null> {
    const text = textInput.trim();
    if (!text || !currentUserId) return null;

    let activeThreadId = threadId;
    let recId = recipientId;

    try {
      if (!recId && activeThreadId) {
        let thread = this.threads().find((t) => t.id === activeThreadId);
        if (!thread) thread = (await this.getThreadById(activeThreadId)) ?? undefined;
        recId = thread ? this.getOtherParticipantUid(thread, currentUserId) || null : null;
      }

      if (!recId) return null;

      const isNewThread = !activeThreadId;

      if (isNewThread) {
        activeThreadId = await this.createNewThread(currentUserId, recId, text);
      }

      // Guard check: ensure TypeScript knows activeThreadId is definitely a string here
      if (!activeThreadId) return null;

      const messagesRef = collection(this.firestore, 'threads', activeThreadId, 'messages');
      const newMessageRef = doc(messagesRef);

      const messageData = {
        id: newMessageRef.id,
        threadId: activeThreadId,
        uid: currentUserId,
        receiverId: recId,
        text: text,
        createdAt: serverTimestamp(),
      };

      await setDoc(newMessageRef, messageData);

      await setDoc(
        doc(this.firestore, 'threads', activeThreadId),
        {
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
        },
        { merge: true },
      );

      if (isNewThread && activeThreadId) {
        this.subscribeToMessages(activeThreadId);
        this.router.navigate(['/thread', activeThreadId], { replaceUrl: true });
      }

      return activeThreadId;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }

  async getThreadById(threadId: string): Promise<Thread | null> {
    const threadRef = doc(this.firestore, 'threads', threadId);
    const docSnap = await getDoc(threadRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Thread;
    }
    return null;
  }
}
