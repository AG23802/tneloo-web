import { Injectable, inject, signal, effect } from '@angular/core';
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
import { FeedPhoto } from '../../../core/models/feed-photo';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly firestore = getFirestore(app);
  private readonly userService = inject(UserService);
  private readonly batchSize = 30;

  readonly photos = signal<FeedPhoto[]>([]);
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
      .then(({ photos, lastVisible }) => {
        this.photos.set(photos);
        this.lastVisibleDoc = lastVisible;
        this.hasMore.set(photos.length === this.batchSize);
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
      .then(({ photos, lastVisible }) => {
        this.photos.update((existing) => [...existing, ...photos]);
        this.lastVisibleDoc = lastVisible;
        this.loadingMore.set(false);
        if (photos.length < this.batchSize) this.hasMore.set(false);
      })
      .catch((err) => {
        console.error('Error loading more of the search gallery:', err);
        this.loadingMore.set(false);
      });
  }

  private clear(): void {
    this.photos.set([]);
    this.hasMore.set(true);
    this.loadingMore.set(false);
    this.lastVisibleDoc = null;
    this.requested = false;
  }

  private async fetchPage(
    currentUserId: string,
    lastVisibleDoc?: QueryDocumentSnapshot,
  ): Promise<{ photos: FeedPhoto[]; lastVisible: QueryDocumentSnapshot | null }> {
    let photosQuery = query(
      collection(this.firestore, 'photos'),
      orderBy('__name__'),
      limit(this.batchSize),
    );
    if (lastVisibleDoc) {
      photosQuery = query(
        collection(this.firestore, 'photos'),
        orderBy('__name__'),
        startAfter(lastVisibleDoc),
        limit(this.batchSize),
      );
    }

    const [photoSnapshot, userSnapshot] = await Promise.all([
      getDocs(photosQuery),
      getDocs(collection(this.firestore, 'users')),
    ]);

    const lastVisible = photoSnapshot.docs[photoSnapshot.docs.length - 1] || null;

    const usersMap = new Map<string, User>();
    userSnapshot.docs.forEach((doc) => {
      usersMap.set(doc.id, { ...(doc.data() as User), uid: doc.id });
    });

    const photos: FeedPhoto[] = [];
    photoSnapshot.docs.forEach((doc) => {
      const photoData = doc.data() as any;
      const ownerUid = photoData.uid || photoData.userId;

      if (currentUserId && ownerUid === currentUserId) return;

      const owner = usersMap.get(ownerUid);
      if (owner) {
        photos.push({
          id: doc.id,
          url: photoData.url,
          uid: owner.uid,
          username: owner.username,
          profilePictureURL: owner.profilePictureURL ?? '',
        });
      }
    });

    return { photos, lastVisible };
  }
}
