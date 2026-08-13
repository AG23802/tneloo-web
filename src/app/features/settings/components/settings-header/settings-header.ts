import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-settings-header',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './settings-header.html',
  styleUrl: './settings-header.css',
})
export class SettingsHeader {
  title = input.required<string>();
  icon = input<string>('back');
  back = output<void>();
}
