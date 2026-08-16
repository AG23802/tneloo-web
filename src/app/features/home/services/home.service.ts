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
import { Media } from '../../../core/models/media.model';

@Service()
export class HomeService {
  private readonly firestore = getFirestore(app);
  private readonly userService = inject(UserService);
  private readonly batchSize = 10;

  readonly users = signal<User[]>([]);
  readonly initialLoading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  private requested = false;
  private lastVisibleDoc: QueryDocumentSnapshot | null = null;

  constructor() {
    // Logging out clears the cache so the next login starts fresh instead
    // of reusing another account's feed / staying permanently "requested".
    effect(() => {
      if (!this.userService.currentUser()) this.clear();
    });
  }

  // Guarded so the fetch only ever fires once per session — the routed
  // Home component is destroyed/recreated by the router on every tab
  // switch, but this service is a root singleton, so re-navigating to the
  // tab just re-renders the already-loaded signals instead of re-querying.
  loadIfNeeded(): void {
    if (this.requested) return;
    this.requested = true;

    this.fetchPage()
      .then(({ users, lastVisible }) => {
        this.users.set(users);
        this.lastVisibleDoc = lastVisible;
        this.hasMore.set(users.length === this.batchSize);
        this.initialLoading.set(false);
      })
      .catch((err) => {
        console.error('Error loading home feed:', err);
        this.initialLoading.set(false);
        this.requested = false;
      });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);

    this.fetchPage(this.lastVisibleDoc ?? undefined)
      .then(({ users, lastVisible }) => {
        this.users.update((existing) => [...existing, ...users]);
        this.lastVisibleDoc = lastVisible;
        this.loadingMore.set(false);
        if (users.length < this.batchSize) this.hasMore.set(false);
      })
      .catch((err) => {
        console.error('Error loading more of the home feed:', err);
        this.loadingMore.set(false);
      });
  }

  private clear(): void {
    this.users.set([]);
    this.initialLoading.set(true);
    this.hasMore.set(true);
    this.loadingMore.set(false);
    this.lastVisibleDoc = null;
    this.requested = false;
  }

  private async fetchPage(
    lastVisibleDoc?: QueryDocumentSnapshot,
  ): Promise<{ users: User[]; lastVisible: QueryDocumentSnapshot | null }> {
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    let usersQuery = query(
      collection(this.firestore, 'users'),
      orderBy('__name__'),
      limit(this.batchSize),
    );
    if (lastVisibleDoc) {
      usersQuery = query(
        collection(this.firestore, 'users'),
        orderBy('__name__'),
        startAfter(lastVisibleDoc),
        limit(this.batchSize),
      );
    }

    const [userSnapshot, mediaSnapshot] = await Promise.all([
      getDocs(usersQuery),
      getDocs(collection(this.firestore, 'media')),
    ]);

    const lastVisible = userSnapshot.docs[userSnapshot.docs.length - 1] || null;

    let users: User[] = userSnapshot.docs.map((doc) => ({
      ...(doc.data() as User),
      uid: doc.id,
    }));

    const media: Media[] = mediaSnapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as Media,
    );

    if (currentUserId) {
      users = users.filter((user) => user.uid !== currentUserId);
    }

    const usersWithMedia = users.map((user) => ({
      ...user,
      media: media.filter((item) => item.ownerId === user.uid),
    }));

    return { users: usersWithMedia, lastVisible };
  }
}
