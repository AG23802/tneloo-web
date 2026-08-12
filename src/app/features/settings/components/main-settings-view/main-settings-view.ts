import { Component, inject, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsHeader } from '../settings-header/settings-header';
import { AuthService } from '../../../auth/auth.service';
import { SettingsView } from '../../../../core/models/settings-view.type';

@Component({
  selector: 'app-main-settings-view',
  imports: [IconComponent, SettingsHeader],
  templateUrl: './main-settings-view.html',
  styleUrl: './main-settings-view.css',
})
export class MainSettingsView {
  authService = inject(AuthService);

  navigateTo = output<SettingsView>();
  close = output<void>();
}
