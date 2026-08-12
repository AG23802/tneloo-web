import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from './icon.model';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);

  @Input({ required: true }) name!: IconName;
  @Input() size = 20;

  get svgContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name] || '');
  }
}
