import { Injectable, inject, Service } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  getFirestore,
  doc,
  updateDoc,
  collection,
  addDoc,
} from 'firebase/firestore';
import { UserService } from './user.service';
import app from '../firebase';
import { from, Observable, switchMap } from 'rxjs';

@Service()
export class PhotoUploadService {
  private storage = getStorage(app);
  private firestore = getFirestore(app);
  private userService = inject(UserService);

  uploadPhoto(file: File, container: string): Observable<string> {
    const userId = this.userService.currentUser()?.uid;
    if (!userId) throw new Error('No authenticated user found');

    const filePath = `${container}/${userId}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, filePath);

    return from(uploadBytes(storageRef, file)).pipe(
      switchMap((snapshot) => getDownloadURL(snapshot.ref)),
      switchMap(async (downloadURL) => {
        await addDoc(collection(this.firestore, 'photos'), {
          uid: userId,
          url: downloadURL,
          storagePath: filePath,
          createdAt: new Date().toISOString(),
        });
        return downloadURL;
      }),
    );
  }

  uploadProfilePicture(file: File): Observable<string> {
    const userId = this.userService.currentUser()?.uid;
    if (!userId) throw new Error('No authenticated user found');

    const filePath = `profile-pictures/${userId}/profile.jpg`;
    const storageRef = ref(this.storage, filePath);

    return from(uploadBytes(storageRef, file)).pipe(
      switchMap((snapshot) => getDownloadURL(snapshot.ref)),
      switchMap(async (downloadURL) => {
        const userDocRef = doc(this.firestore, 'users', userId);
        await updateDoc(userDocRef, { profilePictureURL: downloadURL });
        return downloadURL;
      }),
    );
  }
}
