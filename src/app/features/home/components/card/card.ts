import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../../../../components/avatar/avatar.component';
import { PhotoSlider } from './components/photo-slider/photo-slider';
import { CardActions } from './components/card-actions/card-actions';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-card',
  imports: [Avatar, PhotoSlider, CardActions],
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  user = input.required<User>();

  private router = inject(Router);

  openProfile() {
    this.router.navigate(['/', this.user().username]);
  }
}
