import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../../../../components/avatar/avatar.component';
import { MediaSlider } from './components/media-slider/media-slider';
import { CardActions } from './components/card-actions/card-actions';
import { CreatorFeedEntry } from '../../services/home.service';

@Component({
  selector: 'app-card',
  imports: [Avatar, MediaSlider, CardActions],
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  user = input.required<CreatorFeedEntry>();

  private router = inject(Router);

  openProfile() {
    this.router.navigate(['/', this.user().username]);
  }
}
