import { inject, Service, signal } from '@angular/core';
import {
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
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
import { deleteObject, getStorage, ref } from 'firebase/storage';
import { Location } from '@angular/common';
import app from '../../../core/firebase';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { Thread, ThreadParticipantInfo, getOtherParticipantUid } from '../models/thread.model';
import { Message, MessageMedia } from '../models/message.model';

// A single open conversation: resolving which thread that is, its messages,
// and sending. Doesn't touch the threads list at all (see ChatService for
// that) - ThreadView only ever needs a thread id (or a recipient id to
// start one), not the whole chat list.
@Service()
export class ThreadService {
  private readonly firestore = getFirestore(app);
  private readonly storage = getStorage(app);
  private readonly location = inject(Location);
  private readonly userService = inject(UserService);
  private readonly messageBatchSize = 15;
  private oldestMessageDoc: QueryDocumentSnapshot | null = null;
  private messagesUnsubscribe: (() => void) | null = null;
  private currentRecipientId: string | null = null;

  // Public so ThreadView can read it directly instead of keeping its own
  // copy - a thread created mid-session (see sendMessage) updates this
  // signal in place, with no route navigation/remount involved.
  readonly activeThreadId = signal<string | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly hasMoreMessages = signal(true);
  readonly isLoadingMoreMessages = signal(false);
  readonly initialMessagesLoaded = signal(false);

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
      console.log(`[thread.service t=${performance.now().toFixed(1)}] loadMoreMessages: skipped`, {
        isLoadingMoreMessages: this.isLoadingMoreMessages(),
        hasMoreMessages: this.hasMoreMessages(),
        hasOldestMessageDoc: !!this.oldestMessageDoc,
      });
      return [];
    }
    this.isLoadingMoreMessages.set(true);
    console.log(`[thread.service t=${performance.now().toFixed(1)}] loadMoreMessages: fetching`, {
      threadId,
    });
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
      console.log(`[thread.service t=${performance.now().toFixed(1)}] loadMoreMessages: fetched`, {
        docCount: snapshot.docs.length,
        dedupedCount: deduped.length,
        hasMoreMessages: this.hasMoreMessages(),
      });
      return deduped;
    } catch (error) {
      console.error('[thread.service] loadMoreMessages: error', error);
      return [];
    } finally {
      this.isLoadingMoreMessages.set(false);
    }
  }

  prependMessages(messages: Message[]): void {
    if (!messages.length) return;
    this.messages.update((existing) => [...messages, ...existing]);
    console.log(`[thread.service t=${performance.now().toFixed(1)}] prependMessages: applied`, {
      count: messages.length,
    });
  }

  clearMessages(): void {
    this.messages.set([]);
    this.oldestMessageDoc = null;
    this.hasMoreMessages.set(true);
    this.initialMessagesLoaded.set(false);
    this.activeThreadId.set(null);
    this.currentRecipientId = null;
    this.messagesUnsubscribe?.();
    this.messagesUnsubscribe = null;
  }

  async sendMessage(textInput: string, media?: MessageMedia): Promise<string | null> {
    const text = textInput.trim();
    const user = this.userService.currentUser();
    if ((!text && !media) || !user) return null;
    try {
      let threadId = this.activeThreadId();
      let recipientId = this.currentRecipientId;
      if (!recipientId && threadId) {
        const thread = await this.getOrFindThread(threadId);
        recipientId = thread ? (getOtherParticipantUid(thread, user.uid) ?? null) : null;
        this.currentRecipientId = recipientId;
      }
      if (!recipientId) return null;
      if (!threadId) {
        threadId = await this.createNewThread(user.uid, recipientId);
        this.activeThreadId.set(threadId);
        // Give the URL a real thread id (bookmarkable, survives a reload)
        // without going through the router - the /thread and /thread/:id
        // routes are different route configs, so a router.navigate here
        // would destroy and recreate this whole component (header included)
        // to swap between them, losing state and re-fetching for nothing.
        this.location.replaceState(`/thread/${threadId}`);
      }
      const threadRef = doc(this.firestore, 'threads', threadId);
      const messageRef = doc(collection(threadRef, 'messages'));

      const messageData: Record<string, unknown> = {
        id: messageRef.id,
        threadId,
        uid: user.uid,
        receiverId: recipientId,
        createdAt: serverTimestamp(),
      };
      if (text) messageData['text'] = text;
      if (media) messageData['media'] = media;

      await Promise.all([
        setDoc(messageRef, messageData),
        setDoc(
          threadRef,
          { lastMessage: text || this.previewTextFor(media), lastMessageTime: serverTimestamp() },
          { merge: true },
        ),
      ]);
      return threadId;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  // Bucket file(s) first, Firestore doc only after - matches
  // UserService.deleteContentByUrl's ordering so a failed storage delete
  // never leaves a message pointing at nothing, and a storage delete never
  // silently orphans a still-visible message.
  async deleteMessage(threadId: string, message: Message): Promise<void> {
    if (!message.id) return;

    if (message.media) {
      await this.deleteStorageObject(message.media.url);
      if (message.media.thumbnailUrl) {
        await this.deleteStorageObject(message.media.thumbnailUrl);
      }
    }

    await deleteDoc(doc(this.firestore, 'threads', threadId, 'messages', message.id));
    this.messages.update((existing) => existing.filter((m) => m.id !== message.id));
  }

  private async deleteStorageObject(url: string): Promise<void> {
    try {
      // ref() accepts a full https download URL directly, so no separate
      // storagePath needs to be stored on MessageMedia.
      await deleteObject(ref(this.storage, url));
    } catch (error) {
      if ((error as { code?: string })?.code !== 'storage/object-not-found') throw error;
    }
  }

  private previewTextFor(media: MessageMedia | undefined): string {
    return media?.type === 'video' ? '🎥 Video' : '📷 Photo';
  }

  private async createNewThread(currentUserId: string, recipientId: string): Promise<string> {
    const ref = doc(collection(this.firestore, 'threads'));
    const currentUser = this.userService.currentUser();
    const recipientSnap = await getDoc(doc(this.firestore, 'users', recipientId));
    const recipient = recipientSnap.data() as User | undefined;

    // Seeded once here; kept fresh afterward by the users/{uid} trigger.
    const participantsInfo: Record<string, ThreadParticipantInfo> = {};
    if (currentUser) {
      participantsInfo[currentUserId] = {
        uid: currentUserId,
        username: currentUser.username,
        displayName: currentUser.displayName ?? currentUser.username,
        profilePictureURL: currentUser.profilePictureURL ?? null,
      };
    }
    if (recipient) {
      participantsInfo[recipientId] = {
        uid: recipientId,
        username: recipient.username,
        displayName: recipient.displayName ?? recipient.username,
        profilePictureURL: recipient.profilePictureURL ?? null,
      };
    }

    const data = {
      id: ref.id,
      participants: [currentUserId, recipientId],
      participantsInfo,
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
    };
    await setDoc(ref, data);
    // Not pushed into ChatService's list here on purpose - ThreadService
    // doesn't depend on ChatService. The list's own onSnapshot listener
    // picks up this write (Firestore surfaces local writes immediately from
    // cache, before server ack), so the new thread appears there on its own.
    this.subscribeToMessages(ref.id);
    return ref.id;
  }

  private async getOrFindThread(threadId: string): Promise<Thread | null> {
    const snap = await getDoc(doc(this.firestore, 'threads', threadId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Thread) : null;
  }

  // Same lookup, exposed for read-only views (e.g. the thread's video list)
  // that need the thread doc but shouldn't touch activeThreadId/messages -
  // those are this session's "currently open conversation" state.
  getThread(threadId: string): Promise<Thread | null> {
    return this.getOrFindThread(threadId);
  }

  // One-shot, not realtime - this is a "view once" gallery. Filtering
  // client-side for media.type === 'video' avoids needing a composite
  // index just for this, since the messages collection is already small
  // per-thread and fully fetched here regardless.
  async getThreadVideos(threadId: string): Promise<Message[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firestore, 'threads', threadId, 'messages'),
        orderBy('createdAt', 'desc'),
      ),
    );
    return snapshot.docs
      .map((snap) => ({ id: snap.id, ...snap.data() }) as Message)
      .filter((message) => message.media?.type === 'video');
  }

  async findExistingThread(userA: string, userB: string): Promise<string | null> {
    const snapshot = await getDocs(
      query(collection(this.firestore, 'threads'), where('participants', 'array-contains', userA)),
    );
    return (
      snapshot.docs.find((snap) => (snap.data()['participants'] ?? []).includes(userB))?.id ?? null
    );
  }

  // targetUser comes straight off the thread's own denormalized
  // participantsInfo - callers that don't already have it via router state
  // (e.g. a raw reload of /thread/:id, with no state to pass) still get the
  // header populated without a separate live user fetch.
  async initializeActiveThread(
    threadId: string | null,
    recipientId: string | null,
    currentUid: string,
  ): Promise<{
    threadId: string | null;
    targetUid: string | null;
    targetUser: ThreadParticipantInfo | null;
  }> {
    this.activeThreadId.set(threadId);
    this.currentRecipientId = recipientId;
    if (threadId) {
      this.subscribeToMessages(threadId);
      const thread = await this.getOrFindThread(threadId);
      const targetUid = thread ? (getOtherParticipantUid(thread, currentUid) ?? null) : null;
      this.currentRecipientId = targetUid;
      const targetUser = targetUid ? (thread?.participantsInfo?.[targetUid] ?? null) : null;
      return { threadId, targetUid, targetUser };
    }
    if (!recipientId) return { threadId: null, targetUid: null, targetUser: null };
    const existingId = await this.findExistingThread(currentUid, recipientId);
    if (!existingId) return { threadId: null, targetUid: recipientId, targetUser: null };
    this.activeThreadId.set(existingId);
    this.subscribeToMessages(existingId);
    // Same reasoning as sendMessage: swap the URL in place, don't navigate
    // through the router between the two different /thread route configs.
    this.location.replaceState(`/thread/${existingId}`);
    const thread = await this.getOrFindThread(existingId);
    const targetUser = thread?.participantsInfo?.[recipientId] ?? null;
    return { threadId: existingId, targetUid: recipientId, targetUser };
  }
}
