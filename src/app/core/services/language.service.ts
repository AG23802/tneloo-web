// language.service.ts
import { Injectable, inject, signal, Service } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Service()
export class LanguageService {
  translate = inject(TranslateService);

  languages = [
    { code: 'de', label: 'Deutsch', flag: '/assets/flags/162-germany.svg' },
    { code: 'en', label: 'English', flag: '/assets/flags/260-united-kingdom.svg' },
    { code: 'fr', label: 'Français', flag: '/assets/flags/195-france.svg' },
    { code: 'it', label: 'Italiano', flag: '/assets/flags/013-italy.svg' },
    { code: 'al', label: 'Shqip', flag: '/assets/flags/099-albania.svg' },
  ];

  getCurrentLanguage() {
    return this.languages.find((l) => l.code === this.translate.currentLang()) || this.languages[0];
  }

  setLanguage(langCode: string) {
    this.translate.use(langCode);
    localStorage.setItem('preferred_language', langCode);
  }
}
