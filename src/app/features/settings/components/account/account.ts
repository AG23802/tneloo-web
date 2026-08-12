import { Component, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsView } from '../../../../core/models/settings-view.type';

@Component({
  selector: 'app-account',
  imports: [IconComponent],
  templateUrl: './account.html',
  styleUrl: '../../settings.css',
})
export class Account {
  saveChanges = output<SettingsView>();

  navigateTo(view: SettingsView) {
    this.saveChanges.emit(view);
  }
}
