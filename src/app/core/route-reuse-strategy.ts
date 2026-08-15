import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';
import { UserService } from './services/user.service';

// Paths that keep their component instance alive when navigating away, so
// switching tabs doesn't re-run their constructor/effects (re-subscribing
// to realtime listeners, refetching lists, etc). No scroll handling here -
// see PreserveScrollDirective for that, used only on Home/Search.
const REUSABLE_TAB_PATHS = new Set(['', 'search', 'chats', ':username']);

export class TabRouteReuseStrategy implements RouteReuseStrategy {
  private userService = inject(UserService);
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  // Includes resolved param values (e.g. the actual username), not just the
  // route template - otherwise /alice and /bob would collide under the same
  // ':username' key and navigating between two profiles would show stale data.
  private keyOf(route: ActivatedRouteSnapshot): string | undefined {
    const path = route.routeConfig?.path;
    if (path === undefined) return undefined;
    const params = Object.entries(route.params)
      .map(([key, value]) => `${key}=${value}`)
      .join(';');
    return params ? `${path}?${params}` : path;
  }

  private isReusable(route: ActivatedRouteSnapshot): boolean {
    const path = route.routeConfig?.path;
    if (path === undefined || !REUSABLE_TAB_PATHS.has(path)) return false;
    // Profile is only worth keeping alive for the logged-in user's own page -
    // other people's profiles are visited once and shouldn't stay cached.
    if (path === ':username') {
      return route.params['username'] === this.userService.currentUser()?.username;
    }
    return true;
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.isReusable(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.keyOf(route);
    if (key === undefined) return;
    if (handle) {
      this.storedRoutes.set(key, handle);
    } else {
      this.storedRoutes.delete(key);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (!this.isReusable(route)) return false;
    const key = this.keyOf(route);
    return key !== undefined && this.storedRoutes.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.keyOf(route);
    if (key === undefined) return null;
    return this.storedRoutes.get(key) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }
}
