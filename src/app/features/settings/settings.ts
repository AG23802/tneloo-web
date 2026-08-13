import { Component, inject, OnInit, output, signal } from '@angular/core';
import { IconComponent } from '../../components/icon/icon';
import { UserService } from '../../core/services/user.service';
import { Account } from './components/account/account';
import { FormsModule } from '@angular/forms';
import {
  getAuth,
  signInWithEmailAndPassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import app from '../../core/firebase';
import { PersonalDetails } from './components/account/personal-details/personal-details';
import { ChangePassword } from './components/account/change-password/change-password';
import { MainSettingsView } from './components/main-settings-view/main-settings-view';
import { SettingsView } from '../../core/models/settings-view.type';
import { ChangeLanguage } from './components/app-change-language/change-language.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-settings',
  imports: [
    IconComponent,
    Account,
    FormsModule,
    PersonalDetails,
    ChangePassword,
    MainSettingsView,
    ChangeLanguage,
    TranslatePipe,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  userService = inject(UserService);
  private auth = getAuth(app);

  // Inside your Settings class:
  requiresReauth = signal<boolean>(false);
  currentPasswordInput = '';

  emailInput = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  closeMenu = output<void>();
  activeView = signal<SettingsView>('main');

  onClose() {
    this.closeMenu.emit();
  }

  navigateTo(view: SettingsView) {
    if (view === 'personal-details') {
      this.emailInput.set(this.userService.userEmail() ?? '');
      this.errorMessage.set(null);
    }
    this.activeView.set(view);
  }

  async saveEmail() {
    const user = this.auth.currentUser;
    if (!user || !user.email) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      // If we already have a pending re-auth, sign in first
      if (this.requiresReauth()) {
        await signInWithEmailAndPassword(this.auth, user.email, this.currentPasswordInput);
        this.requiresReauth.set(false);
      }

      // Attempt to send verification to the new email
      await verifyBeforeUpdateEmail(user, this.emailInput());
      this.errorMessage.set(
        'Verification link sent! Please check your new email to complete the change.',
      );
    } catch (error: any) {
      console.error('Failed to update email:', error);

      if (error.code === 'auth/requires-recent-login' || error.code === 'auth/wrong-password') {
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
