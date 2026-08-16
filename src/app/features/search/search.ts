import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { SearchService } from './services/search.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { User } from '../../core/models/user.model';
import { FeedMedia } from '../../core/models/feed-media';
import { MediaViewerModal } from '../../components/media-viewer-modal/media-viewer-modal';
import { TranslatePipe } from '@ngx-translate/core';
import { PreserveScrollDirective } from '../../core/preserve-scroll.directive';
import { IconComponent } from '../../components/icon/icon';

@Component({
  selector: 'app-search',
  templateUrl: './search.html',
  styleUrl: './search.css',
  imports: [FormsModule, RouterLink, MediaViewerModal, TranslatePipe, IconComponent],
  hostDirectives: [PreserveScrollDirective],
})
export class Search {
  private userService = inject(UserService);
  private searchService = inject(SearchService);
  private router = inject(Router);
  private elementRef = inject(ElementRef<HTMLElement>);

  searchQuery = signal<string>('');
  searchResults = signal<User[]>([]);

  media = this.searchService.media;
  isLoadingMore = this.searchService.loadingMore;
  hasMoreMedia = this.searchService.hasMore;

  // Signal to hold the active item for the full-screen modal view
  selectedMedia = signal<FeedMedia | null>(null);

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

  loadMoreMedia(): void {
    this.searchService.loadMore();
  }

  openMedia(item: FeedMedia) {
    this.selectedMedia.set(item);
  }

  closeMedia() {
    this.selectedMedia.set(null);
  }

  openProfile(username: string) {
    this.router.navigate(['/', username]);
  }
}
