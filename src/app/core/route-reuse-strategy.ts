import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

// Paths that keep their component instance alive when navigating away,
// so switching tabs preserves scroll position and in-memory state.
const REUSABLE_TAB_PATHS = new Set(['', 'search']);

export class TabRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  private pathOf(route: ActivatedRouteSnapshot): string | undefined {
    return route.routeConfig?.path;
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = this.pathOf(route);
    return path !== undefined && REUSABLE_TAB_PATHS.has(path);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const path = this.pathOf(route);
    if (path === undefined) return;
    if (handle) {
      this.storedRoutes.set(path, handle);
    } else {
      this.storedRoutes.delete(path);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = this.pathOf(route);
    return path !== undefined && this.storedRoutes.has(path);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const path = this.pathOf(route);
    if (path === undefined) return null;
    return this.storedRoutes.get(path) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }
}
