import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search').then((m) => m.Search),
  },
  {
    path: 'chats',
    loadComponent: () => import('./features/chats/chats').then((m) => m.Chats),
  },
  {
    path: 'thread/:threadId/videos',
    loadComponent: () =>
      import('./features/chats/components/thread-videos/thread-videos').then(
        (m) => m.ThreadVideos,
      ),
  },
  {
    path: 'thread/:threadId',
    loadComponent: () =>
      import('./features/chats/components/thread-view/thread-view').then((m) => m.ThreadView),
  },
  {
    path: 'thread',
    loadComponent: () =>
      import('./features/chats/components/thread-view/thread-view').then((m) => m.ThreadView),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'debug',
    loadComponent: () => import('./components/debug/debug').then((m) => m.Debug),
  },
  {
    path: ':username',
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
  },
  { path: '**', redirectTo: '/404' },
];
