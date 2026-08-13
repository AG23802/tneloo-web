import { Service, signal } from '@angular/core';
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

@Service()
export class ChatService {
  private firestore = getFirestore(app);

  threads = signal<Thread[]>([]);
  messages = signal<Message[]>([]);

  private threadsUnsubscribe: (() => void) | null = null;
  private messagesUnsubscribe: (() => void) | null = null;

  loadUserThreads(userId: string, onParticipantsFound: (uids: string[]) => void) {
    if (this.threadsUnsubscribe) this.threadsUnsubscribe();

    const threadsRef = collection(this.firestore, 'threads');
    const q = query(
      threadsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc'),
      limit(20),
    );

    this.threadsUnsubscribe = onSnapshot(q, (snapshot) => {
      const userThreads: Thread[] = [];
      const uidsToFetch = new Set<string>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const thread = { id: docSnap.id, ...data } as Thread;
        userThreads.push(thread);

        thread.participants.forEach((pUid) => {
          if (pUid !== userId) {
            uidsToFetch.add(pUid);
          }
        });
      });

      this.threads.set(userThreads);

      if (uidsToFetch.size > 0) {
        onParticipantsFound(Array.from(uidsToFetch));
      }
    });
  }

  async findExistingThread(userA: string, userB: string): Promise<string | null> {
    const threadsRef = collection(this.firestore, 'threads');
    const q = query(threadsRef, where('participants', 'array-contains', userA));
    const snapshot = await getDocs(q);

    // Find the first matching document where participants includes userB
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

    return activeThreadId; // Return the new ID!
  }

  async sendMessage(
    textInput: string,
    threadId: string | null,
    recipientId: string,
    currentUserId: string,
  ): Promise<string | null> {
    const text = textInput.trim();
    if (!text || !currentUserId || !recipientId) return null;

    let activeThreadId = threadId;

    try {
      if (!activeThreadId) {
        // Capture the returned ID
        activeThreadId = await this.createNewThread(currentUserId, recipientId, text);
      }

      const messagesRef = collection(this.firestore, 'threads', activeThreadId, 'messages');
      const newMessageRef = doc(messagesRef);

      const messageData = {
        id: newMessageRef.id,
        threadId: activeThreadId,
        uid: currentUserId,
        receiverId: recipientId,
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
