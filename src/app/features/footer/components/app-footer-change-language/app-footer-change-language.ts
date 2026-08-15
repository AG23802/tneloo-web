// app-footer-change-language.ts
import { Component, inject, signal } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';

@Component({
  selector: 'app-app-footer-change-language',
  imports: [],
  templateUrl: './app-footer-change-language.html',
  styleUrl: './app-footer-change-language.css',
})
export class AppFooterChangeLanguage {
  languageService = inject(LanguageService);

  isLanguageMenuOpen = signal(false);

  toggleLanguageMenu() {
    this.isLanguageMenuOpen.update((open) => !open);
  }

  selectLanguage(langCode: string) {
    this.languageService.setLanguage(langCode);
    this.isLanguageMenuOpen.set(false);
  }
}
