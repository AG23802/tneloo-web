import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Nav } from './components/nav/nav';
import { UserService } from './core/services/user.service';
import { Auth } from './features/auth/components/auth/auth';
import { NotificationService } from './core/services/notification.service';

@Component({
  imports: [RouterModule, Nav, Auth],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'web';
  userService = inject(UserService);
  notificationService = inject(NotificationService);
}
