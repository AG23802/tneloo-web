import { Component, inject } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { CommonModule } from '@angular/common';
import { getAuth } from 'firebase/auth';
import app from './../../core/firebase';

@Component({
  selector: 'app-debug',
  imports: [CommonModule],
  templateUrl: './debug.html',
  styleUrl: './debug.css',
})
export class Debug {
  userService = inject(UserService);
  auth = getAuth(app);

  get currentUser() {
    const user = this.auth.currentUser;
    if (!user) return null;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      photoURL: user.photoURL,
      providerData: user.providerData,
    };
  }
}
