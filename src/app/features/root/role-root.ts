import { Component, inject } from '@angular/core';
import { UserService } from '../../core/services/user.service';
import { Home } from '../home/home';
import { Dashboard } from '../dashboard/dashboard';

// Resolves the '' route to the right landing screen per role - no route
// guard infrastructure exists in this app yet, so this is a thin
// component-level branch rather than a router guard/redirect.
@Component({
  selector: 'app-role-root',
  template: `
    @if ((userService.currentUser()?.role ?? 'buyer') === 'creator') {
      <app-dashboard />
    } @else {
      <app-home />
    }
  `,
  // This element must not generate its own box - .view-container (the
  // router-outlet's flex parent) expects the routed component itself to
  // be the flex item it stretches to fill available height. Without this,
  // <app-role-root> sits in between with no height of its own, and
  // Home/Dashboard's `:host { height: 100% }` has nothing to resolve
  // against - collapses to 0.
  styles: [':host { display: contents; }'],
  imports: [Home, Dashboard],
})
export class RoleRoot {
  userService = inject(UserService);
}
