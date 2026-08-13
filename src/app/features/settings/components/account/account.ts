import { Component, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsView } from '../../../../core/models/settings-view.type';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-account',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './account.html',
  styleUrl: '../../settings.css',
})
export class Account {
  saveChanges = output<SettingsView>();

  navigateTo(view: SettingsView) {
    this.saveChanges.emit(view);
  }
}
