import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email as emailValidator,
} from '@angular/forms/signals';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-auth',
  imports: [FormField],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  authService = inject(AuthService);

  // Define the form model as a writable signal
  authModel = signal({
    email: '',
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
