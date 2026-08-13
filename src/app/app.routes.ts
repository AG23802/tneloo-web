import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search').then((m) => m.Search),
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./features/chats/chats.component').then((m) => m.Chats),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: ':username',
    loadComponent: () =>
      import('./features/profile/profile').then((m) => m.Profile),
  },
  { path: '**', redirectTo: '/404' },
];
