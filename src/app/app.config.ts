import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideTranslateService } from '@ngx-translate/core';

// Safely check localStorage (handles server-side rendering / SSR environments if applicable)
const savedLang = typeof window !== 'undefined' ? localStorage.getItem('preferred_language') : null;

console.log('Saved language:', savedLang);
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideHttpClient(), // <--- 1. Required for TranslateHttpLoader
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'de',
      lang: savedLang || 'de',
    }),
  ],
};
