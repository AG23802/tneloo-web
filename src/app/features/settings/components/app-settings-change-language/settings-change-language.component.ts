// settings-change-language.component.ts
import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsView } from '../../../../core/models/settings-view.type';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/services/language.service';

@Component({
  selector: 'app-settings-change-language',
  standalone: true,
  imports: [CommonModule, IconComponent, TranslatePipe],
  templateUrl: './settings-change-language.component.html',
  styleUrls: ['../../settings.css', './settings-change-language.component.css'],
})
export class SettingsChangeLanguage {
  langService = inject(LanguageService);
  saveChanges = output<SettingsView>();

  selectLanguage(langCode: string) {
    this.langService.setLanguage(langCode);
  }

  navigateTo(view: SettingsView) {
    this.saveChanges.emit(view);
  }
}
