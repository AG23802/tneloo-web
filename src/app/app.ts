import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Nav } from './components/nav/nav';
import { UserService } from './core/services/user.service';
import { Auth } from './features/auth/components/auth/auth';
import { Spinner } from './components/spinner/spinner';
import { LoadingManagerService } from './core/services/loading.service';
import { NotificationService } from './core/services/notification.service';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from './core/services/theme.service';

@Component({
  imports: [RouterModule, Nav, Auth, Spinner],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected title = 'web';
  userService = inject(UserService);
  loadingManager = inject(LoadingManagerService);
  notificationService = inject(NotificationService);
  translateService = inject(TranslateService);
  // Injected for its side effect: applies the saved theme preference to <html>.
  private themeService = inject(ThemeService);

  private translate = inject(TranslateService);

  constructor() {
    this.translate.addLangs(['de', 'en', 'fr', 'it', 'al']);
  }

  ngOnInit() {
    const currentLanguage = this.translateService.currentLang;
    console.log('Current language:', currentLanguage());
  }
}
