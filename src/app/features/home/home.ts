import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { Card } from './components/card/card';
import { User } from '../../core/models/user.model';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  imports: [Card, TranslatePipe],
})
export class Home implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);

  users = signal<User[]>([]);
  isLoading = signal(true);

  isLoadingMore = signal<boolean>(false);
  hasMorePhotos = signal<boolean>(true);
  private batchSize = 10;
  private lastVisibleDoc: QueryDocumentSnapshot | null = null;

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    this.userService.getHomeFeedPaged(currentUserId, this.batchSize).subscribe({
      next: ({ users, lastVisible }) => {
        this.users.set(users);
        this.lastVisibleDoc = lastVisible;
        this.isLoading.set(false);

        this.hasMorePhotos.set(users.length === this.batchSize);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      },
    });
  }

  loadMorePhotos() {
    if (this.isLoadingMore() || !this.hasMorePhotos()) return;

    this.isLoadingMore.set(true);
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    this.userService
      .getHomeFeedPaged(currentUserId, this.batchSize, this.lastVisibleDoc ?? undefined)
      .subscribe({
        next: ({ users, lastVisible }) => {
          this.users.update((existing) => [...existing, ...users]);
          this.lastVisibleDoc = lastVisible;
          this.isLoadingMore.set(false);

          if (users.length < this.batchSize) {
            this.hasMorePhotos.set(false);
          }
        },
        error: (err) => {
          console.error(err);
          this.isLoadingMore.set(false);
        },
      });
  }
}
