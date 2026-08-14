import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon';
import { UserService } from '../../core/services/user.service';
import { IconName } from '../icon/icon.model';
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  userService = inject(UserService);

  navItems: {
    route: (username?: string) => string | string[];
    icon: IconName;
    activeIcon: IconName;
    label: string;
    exact?: boolean;
    needsUsername?: boolean;
  }[] = [
    {
      route: () => '/',
      icon: 'home',
      activeIcon: 'homeFilled',
      label: 'Home',
      exact: true,
    },
    {
      route: () => '/search',
      icon: 'search',
      activeIcon: 'searchFilled',
      label: 'Search',
    },
    {
      route: () => '/chats',
      icon: 'share',
      activeIcon: 'shareFilled',
      label: 'Chats',
    },
    {
      route: (username) => (username ? ['/', username] : '/'),
      icon: 'person',
      activeIcon: 'personFilled',
      label: 'Profile',
      needsUsername: true,
    },
  ];
}
