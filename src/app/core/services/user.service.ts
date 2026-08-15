import { Injectable, signal, computed, inject, Service } from '@angular/core';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  limit,
  orderBy,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  updateEmail as fbUpdateEmail,
} from 'firebase/auth';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import app from '../firebase';
import { User } from '../models/user.model';
import { Photo } from '../models/photo.model';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadingManagerService } from './loading.service';

@Service()
export class UserService {
  loadingManager = inject(LoadingManagerService);
  private firestore = getFirestore(app);
  private auth = getAuth(app);
  private storage = getStorage(app);

  private currentUserSignal = signal<User | null>(null);
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);

  constructor() {
    this.loadingManager.show();

    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        await this.fetchUserProfile(firebaseUser.uid);
      } else {
        this.currentUserSignal.set(null);
      }

      this.loadingManager.hide();
    });
  }

  readonly userEmail = computed(() => {
    return this.auth.currentUser?.email ?? null;
  });

  setCurrentUser(user: User | null): void {
    this.currentUserSignal.set(user);
  }

  async updateEmail(newEmail: string): Promise<void> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) throw new Error('No authenticated user found');

    await fbUpdateEmail(firebaseUser, newEmail);

    const userDocRef = doc(this.firestore, 'users', firebaseUser.uid);
    await updateDoc(userDocRef, { emailAddress: newEmail });

    const currentUser = this.currentUserSignal();
    if (currentUser) {
      this.currentUserSignal.set({ ...currentUser, email: newEmail });
    }
  }

  getUserById(id: string): Observable<User | null> {
    const docRef = doc(this.firestore, 'users', id);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => (docSnap.exists() ? (docSnap.data() as User) : null)),
    );
  }

  getUserPhotos(userId: string): Observable<Photo[]> {
    return new Observable((observer) => {
      const photosQuery = query(
        collection(this.firestore, 'photos'),
        where('uid', '==', userId),
        orderBy('createdAt', 'desc'),
      );

      const unsubscribe = onSnapshot(
        photosQuery,
        (snapshot) => {
          const photos = snapshot.docs.map((doc) => doc.data() as Photo);
          observer.next(photos);
        },
        (error) => {
          observer.error(error);
        },
      );

      return () => unsubscribe();
    });
  }

  getUserByUsernameRealtime(username: string): Observable<User | null> {
    return new Observable((observer) => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('username', '==', username), limit(1));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            observer.next(null);
            return;
          }
          const docSnap = snapshot.docs[0];
          observer.next({ ...(docSnap.data() as User), uid: docSnap.id });
        },
        (error) => observer.error(error),
      );

      return () => unsubscribe();
    });
  }

  async deletePhotoByUrl(photoUrl: string): Promise<void> {
    const photosRef = collection(this.firestore, 'photos');
    const q = query(photosRef, where('url', '==', photoUrl), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error('Photo not found in database');

    const docSnap = snapshot.docs[0];
    const photoData = docSnap.data() as Photo;

    // Delete the bucket object first — the table row must only be removed
    // once we know the file is actually gone. If bucket deletion fails, the
    // row stays so the photo doesn't silently vanish while an orphaned file
    // (or a file the user thinks is deleted) remains in storage.
    //
    // Derived from the download URL rather than photoData.storagePath: the
    // upload path never actually wrote that field to Firestore, so relying
    // on it silently skipped bucket deletion for every photo. ref() accepts
    // an https download URL directly, so this works regardless of whether
    // storagePath was ever populated.
    const storageRef = ref(this.storage, photoData.storagePath ?? photoUrl);
    try {
      await deleteObject(storageRef);
    } catch (error) {
      // Already gone from the bucket (e.g. deleted out-of-band) means the
      // goal state is already met — anything else should block the row
      // deletion rather than leave storage/table out of sync.
      if ((error as { code?: string })?.code !== 'storage/object-not-found') throw error;
    }

    await deleteDoc(doc(this.firestore, 'photos', docSnap.id));
  }

  private async fetchUserProfile(uid: string): Promise<void> {
    const docRef = doc(this.firestore, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      this.currentUserSignal.set(docSnap.data() as User);
    } else {
      this.currentUserSignal.set(null);
    }
  }

  searchUsers(queryStr: string): Observable<User[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(
      usersRef,
      where('username', '>=', queryStr),
      where('username', '<=', queryStr + '\uf8ff'),
    );
    return from(getDocs(q)).pipe(map((snapshot) => snapshot.docs.map((doc) => doc.data() as User)));
  }

  getUserByUsername(username: string): Observable<User | null> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('username', '==', username), limit(1));
    return from(getDocs(q)).pipe(
      map((snapshot) => {
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...(docSnap.data() as User), uid: docSnap.id };
      }),
    );
  }

  async updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
    const userDocRef = doc(this.firestore, 'users', uid);
    await updateDoc(userDocRef, data);

    const currentUser = this.currentUserSignal();
    if (currentUser && currentUser.uid === uid) {
      this.currentUserSignal.set({ ...currentUser, ...data });
    }
  }
}
