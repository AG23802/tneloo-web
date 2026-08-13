import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import app from '../../../../../core/firebase';
import { IconComponent } from '../../../../../components/icon/icon';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-change-password',
  imports: [IconComponent, FormsModule, TranslatePipe],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private auth = getAuth(app);

  navigateBack = output<void>();

  // Form inputs
  currentPasswordInput = '';
  newPassword = '';
  confirmPassword = '';

  // UI state signals
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Step control: false = show old password first, true = show new password fields
  isReauthenticated = signal(false);

  goBack() {
    this.navigateBack.emit();
  }

  async verifyCurrentPassword() {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const currentUser = this.auth.currentUser;
    if (!currentUser || !currentUser.email) {
      this.errorMessage.set('Kein Benutzer angemeldet.');
      return;
    }

    if (!this.currentPasswordInput) {
      this.errorMessage.set('Bitte gib dein aktuelles Passwort ein.');
      return;
    }

    this.isLoading.set(true);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        this.currentPasswordInput,
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Successfully reauthenticated: unlock the next step and clear old input
      this.isReauthenticated.set(true);
      this.currentPasswordInput = '';
    } catch (error: any) {
      console.error('Reauthentication failed:', error);
      if (
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        this.errorMessage.set('Das aktuelle Passwort ist falsch.');
      } else {
        this.errorMessage.set(
          'Fehler bei der Überprüfung. Bitte versuche es erneut.',
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateNewPassword() {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage.set(
        'Das neue Passwort muss mindestens 6 Zeichen lang sein.',
      );
      return;
    }

    const activeUser = this.auth.currentUser;
    if (!activeUser) {
      this.errorMessage.set('Kein authentifizierter Benutzer gefunden.');
      return;
    }

    this.isLoading.set(true);

    try {
      await updatePassword(activeUser, this.newPassword);

      // Success: Reset everything back to initial state, show success message
      this.successMessage.set('Passwort erfolgreich geändert!');
      this.newPassword = '';
      this.confirmPassword = '';
      this.currentPasswordInput = '';
      this.isReauthenticated.set(false);
    } catch (error: any) {
      console.error('Failed to update password:', error);
      this.errorMessage.set(
        'Fehler beim Ändern des Passworts. Bitte versuche es später erneut.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
