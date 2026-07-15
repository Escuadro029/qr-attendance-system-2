import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="crest">PC</div>
        <h1 class="headline">The Press Conference</h1>
        <p class="subtitle">QR Attendance &amp; Certification System — Teacher Sign In</p>

        <form (ngSubmit)="submit()">
          <label>Email</label>
          <input type="email" name="email" [(ngModel)]="email" required placeholder="teacher@school.edu.ph" />

          <label style="margin-top: 14px;">Password</label>
          <input type="password" name="password" [(ngModel)]="password" required placeholder="••••••••" />

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button type="submit" class="btn btn-primary" style="width:100%; margin-top: 18px;" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
    }
    .login-card { width: 360px; text-align: center; }
    .crest {
      width: 56px; height: 56px; margin: 0 auto 14px;
      border: 2px solid var(--gold);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-headline);
      font-weight: 700;
      color: var(--navy);
      font-size: 1.4rem;
    }
    .subtitle { color: #666; font-size: 0.85rem; margin: 6px 0 22px; }
    form { text-align: left; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Login failed. Check your credentials.');
      },
      complete: () => this.loading.set(false),
    });
  }
}
