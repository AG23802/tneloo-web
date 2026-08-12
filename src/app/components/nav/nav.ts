import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  userService = inject(UserService);
}
