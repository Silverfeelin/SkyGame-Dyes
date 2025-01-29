import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CookieHelper } from '../../helpers/cookie-helper';

@Component({
  standalone: true,
  imports: [ RouterOutlet, RouterLink, MatButtonModule, MatIconModule ],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {
  username: string;

  constructor(
    private readonly _router: Router
  ) {
    this.username = CookieHelper.get('AuthorizationName') || '';
  }

  async logoutAsync(): Promise<void> {
    await fetch('/api/auth', { method: 'DELETE' });
    this._router.navigate(['/auth']);
  }
}
