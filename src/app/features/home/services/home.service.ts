import { Service, inject, signal, effect } from '@angular/core';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import app from '../../../core/firebase';
import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { Content } from '../../../core/models/content.model';

// The buyer swiper needs each creator's teaser content alongside her user
// doc - this is a view-model composed here, not part of the User model
// itself (a creator's content is never actually stored on her user doc).
export interface CreatorFeedEntry extends User {
  content: Content[];
}

@Service()
export class HomeService {
  private readonly firestore = getFirestore(app);
  private readonly userService = inject(UserService);
  private readonly batchSize = 10;

  readonly users = signal<CreatorFeedEntry[]>([]);
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
  ): Promise<{ users: CreatorFeedEntry[]; lastVisible: QueryDocumentSnapshot | null }> {
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    // The buyer swiper only ever shows creators - without this filter,
    // once buyers are a real cohort they'd start showing up in each
    // other's feed too.
    let usersQuery = query(
      collection(this.firestore, 'users'),
      where('role', '==', 'creator'),
      orderBy('__name__'),
      limit(this.batchSize),
    );
    if (lastVisibleDoc) {
      usersQuery = query(
        collection(this.firestore, 'users'),
        where('role', '==', 'creator'),
        orderBy('__name__'),
        startAfter(lastVisibleDoc),
        limit(this.batchSize),
      );
    }

    const [userSnapshot, contentSnapshot] = await Promise.all([
      getDocs(usersQuery),
      getDocs(collection(this.firestore, 'content')),
    ]);

    const lastVisible = userSnapshot.docs[userSnapshot.docs.length - 1] || null;

    let users: User[] = userSnapshot.docs.map((doc) => ({
      ...(doc.data() as User),
      uid: doc.id,
    }));

    const content: Content[] = contentSnapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as Content,
    );

    if (currentUserId) {
      users = users.filter((user) => user.uid !== currentUserId);
    }

    const usersWithContent: CreatorFeedEntry[] = users.map((user) => ({
      ...user,
      content: content.filter((item) => item.ownerId === user.uid),
    }));

    return { users: usersWithContent, lastVisible };
  }
}
