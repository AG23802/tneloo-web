import { Service, effect, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'preferred_theme';
const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#000000';

@Service()
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.readStored());

  constructor() {
    // 'system' means no explicit override - the dark tokens in tokens.css
    // then apply purely via @media (prefers-color-scheme: dark). The
    // <meta name="theme-color"> tag has no such CSS-only mechanism though
    // (it colors the iOS notch/home-indicator safe areas and browser chrome),
    // so it's kept in sync manually, including live system-theme changes
    // while 'system' is selected.
    effect((onCleanup) => {
      const pref = this.preference();
      if (typeof document === 'undefined') return;

      if (pref === 'system') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', pref);
      }

      this.syncThemeColorMeta();

      if (pref === 'system' && typeof window !== 'undefined') {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => this.syncThemeColorMeta();
        media.addEventListener('change', onChange);
        onCleanup(() => media.removeEventListener('change', onChange));
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

  private resolvesToDark(): boolean {
    const pref = this.preference();
    if (pref === 'dark') return true;
    if (pref === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private syncThemeColorMeta(): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', this.resolvesToDark() ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}
