import { inject, Service } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { UserService } from './user.service';
import app from '../firebase';
import { from, Observable, switchMap } from 'rxjs';
import { Content, MediaType } from '../models/content.model';

@Service()
export class MediaUploadService {
  private storage = getStorage(app);
  private firestore = getFirestore(app);
  private userService = inject(UserService);

  // Videos longer than this are rejected rather than uploaded.
  readonly maxVideoDurationSeconds = 60;

  // A creator's teaser/portfolio upload - publicly browsable (Home/Search),
  // so it gets a `content` doc.
  uploadContent(file: File): Observable<Content> {
    const userId = this.userService.currentUser()?.uid;
    if (!userId) throw new Error('No authenticated user found');

    const type: MediaType = file.type.startsWith('video/') ? 'video' : 'image';

    return from(this.buildMediaPayload(file, type, userId, 'content')).pipe(
      switchMap(async (payload) => {
        const ref = await addDoc(collection(this.firestore, 'content'), payload);
        return { ...payload, id: ref.id };
      }),
    );
  }

  // A private chat attachment - Storage-only, no `content` doc, so it never
  // shows up in the public Home/Search feeds (it used to, via the shared
  // `media` collection - this split is the fix for that).
  uploadChatAttachment(file: File): Observable<Content> {
    const userId = this.userService.currentUser()?.uid;
    if (!userId) throw new Error('No authenticated user found');

    const type: MediaType = file.type.startsWith('video/') ? 'video' : 'image';

    return from(this.buildMediaPayload(file, type, userId, 'chat-media'));
  }

  uploadProfilePicture(file: File): Observable<string> {
    const userId = this.userService.currentUser()?.uid;
    if (!userId) throw new Error('No authenticated user found');

    const filePath = `profile-pictures/${userId}/profile.jpg`;

    return from(this.uploadToStorage(file, filePath)).pipe(
      switchMap(async (downloadURL) => {
        const userDocRef = doc(this.firestore, 'users', userId);
        await updateDoc(userDocRef, { profilePictureURL: downloadURL });
        return downloadURL;
      }),
    );
  }

  private async buildMediaPayload(
    file: File,
    type: MediaType,
    userId: string,
    container: string,
  ): Promise<Content> {
    const filePath = `${container}/${userId}/${Date.now()}_${file.name}`;

    if (type === 'video') {
      const { duration, width, height } = await this.readVideoMetadata(file);
      if (duration > this.maxVideoDurationSeconds) {
        throw new Error(`Videos must be at most ${this.maxVideoDurationSeconds} seconds long.`);
      }

      const url = await this.uploadToStorage(file, filePath);

      // A missing thumbnail degrades gracefully (grids just show nothing
      // until the video itself loads) - it shouldn't block the upload.
      let thumbnailUrl: string | null = null;
      try {
        const thumbnailBlob = await this.captureVideoThumbnail(file);
        thumbnailUrl = await this.uploadToStorage(thumbnailBlob, `${filePath}_thumb.jpg`);
      } catch (error) {
        console.error('Could not generate video thumbnail:', error);
      }

      return {
        ownerId: userId,
        type,
        url,
        thumbnailUrl,
        width,
        height,
        duration,
        storagePath: filePath,
        createdAt: new Date().toISOString(),
      };
    }

    const { width, height } = await this.readImageDimensions(file);
    const url = await this.uploadToStorage(file, filePath);

    return {
      ownerId: userId,
      type,
      url,
      thumbnailUrl: null,
      width,
      height,
      duration: null,
      storagePath: filePath,
      createdAt: new Date().toISOString(),
    };
  }

  private async uploadToStorage(file: File | Blob, path: string): Promise<string> {
    const storageRef = ref(this.storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  }

  // Some browsers never fire loadedmetadata/loadeddata on a <video> that
  // isn't attached to the document - it just hangs forever with no error.
  // Positioned off-screen (not display:none, which can also suppress
  // decoding) rather than visible.
  private createHiddenVideoElement(file: File): HTMLVideoElement {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '0';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.src = URL.createObjectURL(file);
    document.body.appendChild(video);
    return video;
  }

  private cleanupVideoElement(video: HTMLVideoElement): void {
    URL.revokeObjectURL(video.src);
    video.remove();
  }

  private readVideoMetadata(
    file: File,
  ): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const video = this.createHiddenVideoElement(file);
      const timeout = setTimeout(() => {
        this.cleanupVideoElement(video);
        reject(new Error('Timed out reading video metadata'));
      }, 15000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        const result = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        this.cleanupVideoElement(video);
        resolve(result);
      };
      video.onerror = () => {
        clearTimeout(timeout);
        this.cleanupVideoElement(video);
        reject(new Error('Could not read video metadata'));
      };
    });
  }

  private readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = URL.createObjectURL(file);

      image.onload = () => {
        const result = { width: image.naturalWidth, height: image.naturalHeight };
        URL.revokeObjectURL(image.src);
        resolve(result);
      };
      image.onerror = () => {
        URL.revokeObjectURL(image.src);
        reject(new Error('Could not read image dimensions'));
      };
    });
  }

  // Grabs a still frame partway into the clip (not frame 0, which is often
  // black/blank) and rasterizes it via canvas into a JPEG blob to use as a
  // poster image, so grids/sliders don't have to load the whole video just
  // to show a preview.
  private captureVideoThumbnail(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = this.createHiddenVideoElement(file);
      const timeout = setTimeout(() => {
        this.cleanupVideoElement(video);
        reject(new Error('Timed out capturing video thumbnail'));
      }, 15000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.1, video.duration / 2);
      };

      video.onseeked = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          this.cleanupVideoElement(video);
          reject(new Error('Canvas not supported'));
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            this.cleanupVideoElement(video);
            if (blob) resolve(blob);
            else reject(new Error('Could not capture video thumbnail'));
          },
          'image/jpeg',
          0.85,
        );
      };

      video.onerror = () => {
        clearTimeout(timeout);
        this.cleanupVideoElement(video);
        reject(new Error('Could not load video for thumbnail'));
      };
    });
  }
}
