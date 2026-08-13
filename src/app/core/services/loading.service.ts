import { signal, computed, Service } from '@angular/core';

@Service()
export class LoadingManagerService {
  private activeTasks = signal<number>(0); // 👈 Explicitly starts at 0

  readonly isLoading = computed(() => this.activeTasks() > 0);

  show() {
    this.activeTasks.update((count) => count + 1);
  }

  hide() {
    this.activeTasks.update((count) => Math.max(0, count - 1));
  }
}
