import { Service, signal } from '@angular/core';

@Service()
export class NotificationService {
  readonly message = signal<string | null>(null);
  readonly type = signal<'error' | 'success'>('error');

  show(
    message: string,
    type: 'error' | 'success' = 'error',
    durationMs = 5000,
  ) {
    this.message.set(message);
    this.type.set(type);

    if (durationMs > 0) {
      setTimeout(() => {
        if (this.message() === message) {
          this.clear();
        }
      }, durationMs);
    }
  }

  clear() {
    this.message.set(null);
  }
}
