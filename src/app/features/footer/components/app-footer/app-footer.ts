import { Component } from '@angular/core';
import { AppFooterChangeLanguage } from '../app-footer-change-language/app-footer-change-language';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  imports: [AppFooterChangeLanguage, TranslatePipe],
  templateUrl: './app-footer.html',
  styleUrl: './app-footer.css',
})
export class AppFooter {}
