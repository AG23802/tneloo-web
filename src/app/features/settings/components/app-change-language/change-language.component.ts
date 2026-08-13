import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsView } from '../../../../core/models/settings-view.type';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-change-language',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './change-language.component.html',
  styleUrl: './change-language.component.css',
})
export class ChangeLanguage {
  translate = inject(TranslateService);
  saveChanges = output<SettingsView>();

  languages = [
    { code: 'de', label: 'Deutsch', flag: '/assets/flags/162-germany.svg' },
    { code: 'en', label: 'English', flag: '/assets/flags/260-united-kingdom.svg' },
    { code: 'fr', label: 'Français', flag: '/assets/flags/195-france.svg' },
    { code: 'it', label: 'Italiano', flag: '/assets/flags/013-italy.svg' },
    { code: 'al', label: 'Shqip', flag: '/assets/flags/099-albania.svg' },
  ];

  selectLanguage(langCode: string) {
    this.translate.use(langCode);
    localStorage.setItem('preferred_language', langCode); // Save choice
  }

  navigateTo(view: SettingsView) {
    this.saveChanges.emit(view);
  }
}
