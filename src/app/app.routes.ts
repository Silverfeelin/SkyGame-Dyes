import { CanActivateFn, Router, Routes } from '@angular/router';
import { TrackerComponent } from './components/tracker/tracker.component';
import { PrivacyComponent } from './components/privacy/privacy.component';
import { AuthenticationComponent } from './components/authentication/authentication.component';
import { inject } from '@angular/core';
import { ContentLayoutComponent } from './layouts/content-layout/content-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { CookieHelper } from './helpers/cookie-helper';

const canActivateAuth: CanActivateFn = (a, b) => {
  const router = inject(Router);
  const isAuthorized = CookieHelper.exists('AuthorizationName');
  if (!isAuthorized) {
    void router.navigate(['/auth']);
  }
  return true;
}

export const routes: Routes = [
  {
    path: '',
    component: ContentLayoutComponent,
    children: [
      { path: '', component: AuthenticationComponent },
      { path: 'auth', component: AuthenticationComponent },
      { path: 'privacy', component: PrivacyComponent },
    ]
  },
  // This section requires the AuthorizationName cookie to be set to 1.
  {
    path: '',
    canActivate: [canActivateAuth],
    component: AuthLayoutComponent,
    children: [
      { path: 'tracker', component: TrackerComponent }
    ]
  }
];

