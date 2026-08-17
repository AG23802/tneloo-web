import { inject, Service, signal } from '@angular/core';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import app from '../../core/firebase';
import { NotificationService } from '../../core/services/notification.service';
import { UserRole } from '../../core/models/user.model';

@Service()
export class AuthService {
  private auth = getAuth(app);
  private firestore = getFirestore(app);
  private notificationService = inject(NotificationService);

  interactionInProgress = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  async login(email: string, pass: string) {
    this.interactionInProgress.set(true);
    this.errorMessage.set(null);
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
    } catch (err: any) {
      this.errorMessage.set(this.formatFirebaseError(err.code));
      this.notificationService.show(this.formatFirebaseError(err.code));
    } finally {
      this.interactionInProgress.set(false);
    }
  }

  async register(email: string, pass: string, role: UserRole) {
    this.interactionInProgress.set(true);
    this.errorMessage.set(null);
    try {
      // 1. Create Auth account (automatically signs user in)
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        pass,
      );
      const firebaseUser = credential.user;

      // 2. Create the missing Firestore user profile document
      const userDocRef = doc(this.firestore, 'users', firebaseUser.uid);
      // tokenBalance/country/stripeCustomerId/pendingEarnings are
      // Cloud-Function-only (see firestore.rules) - omitted here entirely
      // rather than set to 0, every read of them falls back to `?? 0`.
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        role,
        email: email,
        username: email.split('@')[0], // Default username from email prefix
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.errorMessage.set(this.formatFirebaseError(err.code));
      this.notificationService.show(this.formatFirebaseError(err.code));
    } finally {
      this.interactionInProgress.set(false);
    }
  }

  async logout() {
    await signOut(this.auth);
    window.location.href = '/';
  }

  private formatFirebaseError(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email address is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}
