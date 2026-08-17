import { Component, inject, signal } from '@angular/core';
import { getFirestore, collection, query, where, getCountFromServer } from 'firebase/firestore';
import app from '../../core/firebase';
import { UserService } from '../../core/services/user.service';
import { TranslatePipe } from '@ngx-translate/core';

// Creator landing tab - a passive "how am I doing" screen. `pendingEarnings`
// only ever moves once the in-chat paid-unlock mechanic exists (separate,
// not-yet-built feature) - shown honestly as 0 / empty until then, not
// faked.
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  imports: [TranslatePipe],
})
export class Dashboard {
  private readonly firestore = getFirestore(app);
  userService = inject(UserService);

  readonly contentCount = signal<number | null>(null);

  constructor() {
    const uid = this.userService.currentUser()?.uid;
    if (!uid) return;

    getCountFromServer(query(collection(this.firestore, 'content'), where('ownerId', '==', uid)))
      .then((snapshot) => this.contentCount.set(snapshot.data().count))
      .catch((err) => console.error('Error loading content count:', err));
  }
}
