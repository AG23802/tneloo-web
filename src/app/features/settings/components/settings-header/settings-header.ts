import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../components/icon/icon';

@Component({
  selector: 'app-settings-header',
  imports: [IconComponent],
  templateUrl: './settings-header.html',
  styleUrl: './settings-header.css',
})
export class SettingsHeader {
  title = input.required<string>();
  icon = input<string>('back');
  back = output<void>();
}
