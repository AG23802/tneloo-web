import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TabScrollMemory } from './tab-scroll-memory.service';

// Remembers this host element's scrollTop across route reuse (see
// TabRouteReuseStrategy). Reading scrollTop at detach time is too late -
// Angular has already removed the view from the DOM by then, so a
// disconnected element always reports 0. Track it continuously instead,
// and reapply it once this route becomes active again.
@Directive({
  selector: '[appPreserveScroll]',
})
export class PreserveScrollDirective {
  private elementRef = inject(ElementRef<HTMLElement>);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private scrollMemory = inject(TabScrollMemory);
  private key = this.route.snapshot.routeConfig?.path ?? '';

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        const activePath = this.router.routerState.snapshot.root.firstChild?.routeConfig?.path;
        if (activePath !== this.key) return;

        const target = this.scrollMemory.get(this.key);
        requestAnimationFrame(() => {
          this.elementRef.nativeElement.scrollTop = target;
        });
      });
  }

  @HostListener('scroll')
  onScroll(): void {
    this.scrollMemory.save(this.key, this.elementRef.nativeElement.scrollTop);
  }
}
