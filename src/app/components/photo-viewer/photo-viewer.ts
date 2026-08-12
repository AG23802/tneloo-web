import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../avatar/avatar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-photo-viewer',
  imports: [Avatar, CommonModule],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.css',
})
export class PhotoViewer {
  photo = history.state;

  private router = inject(Router);

  openProfile() {
    this.router.navigate(['/', this.photo.username]);
  }

  goBack() {
    window.history.back();
  }
}
