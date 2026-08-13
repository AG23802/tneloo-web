import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { User } from '../../core/models/user.model';
import { FeedPhoto } from '../../core/models/feed-photo';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { PhotoViewerModal } from '../../components/photo-viewer-modal/photo-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-search',
  templateUrl: './search.html',
  styleUrl: './search.css',
  imports: [FormsModule, RouterLink, PhotoViewerModal, TranslatePipe],
})
export class Search implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);

  searchQuery = signal<string>('');
  users = signal<User[]>([]);
  photos = signal<FeedPhoto[]>([]);
  searchResults = signal<User[]>([]);

  // Signal to hold the active photo for the full-screen modal view
  selectedPhoto = signal<FeedPhoto | null>(null);

  isLoadingMore = signal<boolean>(false);
  hasMorePhotos = signal<boolean>(true);
  private batchSize = 30;
  private lastVisibleDoc: QueryDocumentSnapshot | null = null;

  isSearchVisible = signal<boolean>(true);
  private lastScrollTop = 0;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    if (currentScroll <= 50 || this.searchQuery().trim().length > 0) {
      this.isSearchVisible.set(true);
    } else if (currentScroll > this.lastScrollTop) {
      this.isSearchVisible.set(false);
    } else {
      this.isSearchVisible.set(true);
    }
    this.lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
  }

  private searchObservable = toObservable(this.searchQuery).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((query) => {
      if (!query || query.trim() === '') {
        this.searchResults.set([]);
        return [];
      }
      return this.userService.searchUsers(query.trim());
    }),
  );

  ngOnInit() {
    this.loadInitialPhotos();
    this.searchObservable.subscribe((users) => {
      this.searchResults.set(users);
    });
  }

  loadInitialPhotos() {
    const currentUserId = this.userService.currentUser()?.uid;
    if (!currentUserId) return;

    this.userService.getSearchGalleryPaged(currentUserId, this.batchSize).subscribe({
      next: ({ photos, lastVisible }) => {
        this.photos.set(photos);
        this.lastVisibleDoc = lastVisible;
        this.hasMorePhotos.set(photos.length === this.batchSize);
      },
    });
  }

  loadMorePhotos() {
    if (this.isLoadingMore() || !this.hasMorePhotos()) return;

    this.isLoadingMore.set(true);
    const currentUserId = this.userService.currentUser()?.uid ?? '';

    this.userService
      .getSearchGalleryPaged(currentUserId, this.batchSize, this.lastVisibleDoc ?? undefined)
      .subscribe({
        next: ({ photos, lastVisible }) => {
          this.photos.update((existing) => [...existing, ...photos]);
          this.lastVisibleDoc = lastVisible;
          this.isLoadingMore.set(false);

          if (photos.length < this.batchSize) {
            this.hasMorePhotos.set(false);
          }
        },
        error: (err) => {
          console.error(err);
          this.isLoadingMore.set(false);
        },
      });
  }

  openPhoto(photo: FeedPhoto) {
    this.selectedPhoto.set(photo);
  }

  closePhoto() {
    this.selectedPhoto.set(null);
  }

  openProfile(username: string) {
    this.router.navigate(['/', username]);
  }
}
