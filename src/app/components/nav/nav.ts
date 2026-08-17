import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon';
import { UserService } from '../../core/services/user.service';
import { IconName } from '../icon/icon.model';

interface NavItem {
  route: string | string[];
  icon: IconName;
  activeIcon: IconName;
  label: string;
  exact?: boolean;
}

const BUYER_NAV_ITEMS: NavItem[] = [
  { route: '/', icon: 'home', activeIcon: 'homeFilled', label: 'Home', exact: true },
  { route: '/search', icon: 'search', activeIcon: 'searchFilled', label: 'Search' },
  { route: '/chats', icon: 'share', activeIcon: 'shareFilled', label: 'Chats' },
  { route: '/account', icon: 'person', activeIcon: 'personFilled', label: 'Account' },
];

const CREATOR_NAV_ITEMS: NavItem[] = [
  { route: '/', icon: 'dashboard', activeIcon: 'dashboard', label: 'Dashboard', exact: true },
  { route: '/content', icon: 'camera', activeIcon: 'camera', label: 'Content' },
  { route: '/chats', icon: 'share', activeIcon: 'shareFilled', label: 'Chats' },
  { route: '/account', icon: 'person', activeIcon: 'personFilled', label: 'Account' },
];

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  userService = inject(UserService);

  readonly navItems = computed<NavItem[]>(() =>
    (this.userService.currentUser()?.role ?? 'buyer') === 'creator'
      ? CREATOR_NAV_ITEMS
      : BUYER_NAV_ITEMS,
  );
}
