import { Service, effect, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'preferred_theme';

@Service()
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.readStored());

  constructor() {
    // 'system' means no explicit override - the dark tokens in tokens.css
    // then apply purely via @media (prefers-color-scheme: dark).
    effect(() => {
      const pref = this.preference();
      if (typeof document === 'undefined') return;
      if (pref === 'system') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', pref);
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  }

  private readStored(): ThemePreference {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }
}
