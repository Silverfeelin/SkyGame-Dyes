import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { discordAuthenticate, discordHandleRedirect } from './discord-auth';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { CookieHelper } from '../../helpers/cookie-helper';

@Component({
  selector: 'app-authentication',
  imports: [ RouterLink, MatButtonModule ],
  templateUrl: './authentication.component.html',
  styleUrl: './authentication.component.scss'
})
export class AuthenticationComponent implements OnInit {
  loading = false;

  constructor(
    private readonly _changeDetectorRef: ChangeDetectorRef,
    private readonly _router: Router
  ) {

  }

  ngOnInit(): void {
    // Check if already authenticated.
    const isAuthorized = CookieHelper.exists('AuthorizationName');
    if (isAuthorized) {
      this._router.navigate(['/tracker']);
    }

    // Check if redirected.
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      this.onCodeAsync(code);
    }
  }

  async authenticate(): Promise<void> {
    await discordAuthenticate();
  }

  async onCodeAsync(code: string): Promise<void> {
    this.loading = true;
    this._changeDetectorRef.detectChanges();

    try {
      await discordHandleRedirect(code);
      this._router.navigate(['/tracker']);
    } catch (e) {
      console.error(e);
      alert('Failed to authenticate. More details are logged to the console.');
    } finally {
      this.loading = false;
      this._changeDetectorRef.detectChanges();
    }
  }
}
