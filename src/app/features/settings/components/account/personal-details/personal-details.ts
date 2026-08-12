import { Component, inject, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../components/icon/icon';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../../core/services/user.service';
import {
  getAuth,
  verifyBeforeUpdateEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import app from '../../../../../core/firebase';

@Component({
  selector: 'app-personal-details',
  imports: [IconComponent, FormsModule],
  templateUrl: './personal-details.html',
  styleUrl: './personal-details.css',
})
export class PersonalDetails {
  private userService = inject(UserService);
  private auth = getAuth(app);

  emailInput = signal<string>(this.userService.userEmail() ?? '');
  currentPasswordInput = '';
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  requiresReauth = signal<boolean>(false);

  navigateBack = output<void>();

  goBack() {
    this.navigateBack.emit();
  }

  async saveEmail() {
    const currentUser = this.auth.currentUser;
    if (!currentUser || !currentUser.email) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // 1. Handle re-authentication if required
      if (this.requiresReauth()) {
        await signInWithEmailAndPassword(
          this.auth,
          currentUser.email,
          this.currentPasswordInput,
        );
        this.requiresReauth.set(false);
        this.currentPasswordInput = '';
      }

      // 2. Always grab the freshest currentUser reference post-auth
      const activeUser = this.auth.currentUser;
      if (!activeUser) {
        throw new Error('No authenticated user found.');
      }

      // 3. Trigger email change verification
      await verifyBeforeUpdateEmail(activeUser, this.emailInput());

      this.errorMessage.set(
        'Bestätigungslink gesendet! Bitte überprüfe deine neue E-Mail-Adresse, um die Änderung abzuschließen.',
      );
    } catch (error: any) {
      console.error('Failed to update email:', error);

      if (
        error.code === 'auth/requires-recent-login' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        this.requiresReauth.set(true);
        this.errorMessage.set(
          'Sicherheitsüberprüfung: Bitte gib dein aktuelles Passwort ein, um fortzufahren.',
        );
      } else {
        this.errorMessage.set(error.message || 'Failed to update email.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
