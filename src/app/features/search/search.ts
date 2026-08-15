import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { SearchService } from './services/search.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { User } from '../../core/models/user.model';
import { FeedPhoto } from '../../core/models/feed-photo';
import { PhotoViewerModal } from '../../components/photo-viewer-modal/photo-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';
import { PreserveScrollDirective } from '../../core/preserve-scroll.directive';

@Component({
  selector: 'app-search',
  templateUrl: './search.html',
  styleUrl: './search.css',
  imports: [FormsModule, RouterLink, PhotoViewerModal, TranslatePipe],
  hostDirectives: [PreserveScrollDirective],
})
export class Search {
  private userService = inject(UserService);
  private searchService = inject(SearchService);
  private router = inject(Router);
  private elementRef = inject(ElementRef<HTMLElement>);

  searchQuery = signal<string>('');
  searchResults = signal<User[]>([]);

  photos = this.searchService.photos;
  isLoadingMore = this.searchService.loadingMore;
  hasMorePhotos = this.searchService.hasMore;

  // Signal to hold the active photo for the full-screen modal view
  selectedPhoto = signal<FeedPhoto | null>(null);

  isSearchVisible = signal<boolean>(true);
  private lastScrollTop = 0;

  @HostListener('scroll', [])
  onWindowScroll() {
    const currentScroll = this.elementRef.nativeElement.scrollTop;
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

  constructor() {
    this.searchService.loadIfNeeded();
    this.searchObservable.subscribe((users) => {
      this.searchResults.set(users);
    });
  }

  loadMorePhotos(): void {
    this.searchService.loadMore();
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
