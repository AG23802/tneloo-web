import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HomeService } from './services/home.service';
import { Card } from './components/card/card';
import { TranslatePipe } from '@ngx-translate/core';
import { PreserveScrollDirective } from '../../core/preserve-scroll.directive';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  imports: [Card, TranslatePipe],
  hostDirectives: [PreserveScrollDirective],
})
export class Home {
  private homeService = inject(HomeService);
  private router = inject(Router);

  users = this.homeService.users;
  isLoading = this.homeService.initialLoading;
  isLoadingMore = this.homeService.loadingMore;
  hasMorePhotos = this.homeService.hasMore;

  constructor() {
    this.homeService.loadIfNeeded();
  }

  loadMorePhotos(): void {
    this.homeService.loadMore();
  }
}
