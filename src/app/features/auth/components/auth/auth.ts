import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email as emailValidator,
} from '@angular/forms/signals';
import { AuthService } from '../../auth.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppFooter } from '../../../footer/components/app-footer/app-footer';

@Component({
  selector: 'app-auth',
  imports: [FormField, TranslatePipe, AppFooter],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  authService = inject(AuthService);
  translate = inject(TranslateService);

  // Define the form model as a writable signal
  authModel = signal({
    email: 'museum.wuerdig-0s@icloud.com',
    password: '123456',
  });

  // Create the Signal Form with validation rules
  authForm = form(this.authModel, (path) => {
    required(path.email);
    emailValidator(path.email);
    required(path.password);
  });

  async onLogin() {
    if (!this.authForm().valid()) return;
    const { email, password } = this.authModel();
    await this.authService.login(email, password);
  }

  async onRegister() {
    if (!this.authForm().valid()) return;
    const { email, password } = this.authModel();
    await this.authService.register(email, password);
  }
}
