import { Service, inject, signal, effect } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import app from '../../../core/firebase';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { FeedMedia } from '../../../core/models/feed-media';

@Service()
export class SearchService {
  private readonly firestore = getFirestore(app);
  private readonly userService = inject(UserService);
  private readonly batchSize = 30;

  readonly media = signal<FeedMedia[]>([]);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  private requested = false;
  private lastVisibleDoc: QueryDocumentSnapshot | null = null;

  constructor() {
    // Logging out clears the cache so the next login starts fresh instead
    // of reusing another account's gallery or staying "requested" forever.
    effect(() => {
      if (!this.userService.currentUser()) this.clear();
    });
  }

  // Guarded so the fetch only ever fires once per session — the routed
  // Search component is destroyed/recreated by the router on every tab
  // switch, but this service is a root singleton, so re-navigating to the
  // tab just re-renders the already-loaded signal instead of re-querying.
  loadIfNeeded(): void {
    if (this.requested) return;
    const currentUserId = this.userService.currentUser()?.uid;
    if (!currentUserId) return;
    this.requested = true;

    this.fetchPage(currentUserId)
      .then(({ media, lastVisible }) => {
        this.media.set(media);
        this.lastVisibleDoc = lastVisible;
        this.hasMore.set(media.length === this.batchSize);
      })
      .catch((err) => {
        console.error('Error loading search gallery:', err);
        this.requested = false;
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    this.fetchPage(currentUserId, this.lastVisibleDoc ?? undefined)
      .then(({ media, lastVisible }) => {
        this.media.update((existing) => [...existing, ...media]);
        this.lastVisibleDoc = lastVisible;
        this.loadingMore.set(false);
        if (media.length < this.batchSize) this.hasMore.set(false);
      })
      .catch((err) => {
        console.error('Error loading more of the search gallery:', err);
        this.loadingMore.set(false);
      });
  }

  private clear(): void {
    this.media.set([]);
    this.hasMore.set(true);
    this.loadingMore.set(false);
    this.lastVisibleDoc = null;
    this.requested = false;
  }

  private async fetchPage(
    currentUserId: string,
    lastVisibleDoc?: QueryDocumentSnapshot,
  ): Promise<{ media: FeedMedia[]; lastVisible: QueryDocumentSnapshot | null }> {
    let mediaQuery = query(
      collection(this.firestore, 'media'),
      orderBy('__name__'),
      limit(this.batchSize),
    );
    if (lastVisibleDoc) {
      mediaQuery = query(
        collection(this.firestore, 'media'),
        orderBy('__name__'),
        startAfter(lastVisibleDoc),
        limit(this.batchSize),
      );
    }

    const [mediaSnapshot, userSnapshot] = await Promise.all([
      getDocs(mediaQuery),
      getDocs(collection(this.firestore, 'users')),
    ]);

    const lastVisible = mediaSnapshot.docs[mediaSnapshot.docs.length - 1] || null;

    const usersMap = new Map<string, User>();
    userSnapshot.docs.forEach((doc) => {
      usersMap.set(doc.id, { ...(doc.data() as User), uid: doc.id });
    });

    const media: FeedMedia[] = [];
    mediaSnapshot.docs.forEach((doc) => {
      const mediaData = doc.data() as any;
      const ownerUid = mediaData.ownerId;

      if (currentUserId && ownerUid === currentUserId) return;

      const owner = usersMap.get(ownerUid);
      if (owner) {
        media.push({
          id: doc.id,
          type: mediaData.type ?? 'image',
          url: mediaData.url,
          thumbnailUrl: mediaData.thumbnailUrl ?? null,
          duration: mediaData.duration ?? null,
          uid: owner.uid,
          username: owner.username,
          profilePictureURL: owner.profilePictureURL ?? '',
        });
      }
    });

    return { media, lastVisible };
  }
}
