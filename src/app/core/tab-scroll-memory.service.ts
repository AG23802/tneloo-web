import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TabScrollMemory {
  private positions = new Map<string, number>();

  save(key: string, scrollTop: number): void {
    this.positions.set(key, scrollTop);
  }

  get(key: string): number {
    return this.positions.get(key) ?? 0;
  }
}
