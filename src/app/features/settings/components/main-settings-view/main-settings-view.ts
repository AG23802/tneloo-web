import { Component, computed, inject, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { SettingsHeader } from '../settings-header/settings-header';
import { AuthService } from '../../../auth/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { SettingsView } from '../../../../core/models/settings-view.type';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-main-settings-view',
  imports: [IconComponent, SettingsHeader, TranslatePipe],
  templateUrl: './main-settings-view.html',
  styleUrls: ['../../settings.css', './main-settings-view.css'],
})
export class MainSettingsView {
  authService = inject(AuthService);
  private userService = inject(UserService);

  readonly isCreator = computed(() => this.userService.currentUser()?.role === 'creator');

  navigateTo = output<SettingsView>();
  close = output<void>();
}
