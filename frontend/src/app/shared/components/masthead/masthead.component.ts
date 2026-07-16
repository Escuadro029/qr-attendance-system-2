import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-masthead',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="masthead">
      <div class="masthead-top">
        <div class="brand">
          <span class="brand-mark">PC</span>
          <div class="brand-text">
            <span class="headline brand-name">The Press Conference</span>
            <span class="brand-sub">QR Attendance &amp; Certification System</span>
          </div>
        </div>
        @if (auth.currentUser()) {
          <div class="user-box">
            <span class="user-name">{{ auth.currentUser()?.full_name }}</span>
            <button class="btn btn-outline btn-sm" (click)="auth.logout()">Log out</button>
          </div>
        }
      </div>

      @if (auth.currentUser()) {
        <nav class="masthead-nav">
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/scanner" routerLinkActive="active">Scanner</a>
          <a routerLink="/register" routerLinkActive="active">Register Student</a>
          <a routerLink="/progress" routerLinkActive="active">Progress</a>
          <a routerLink="/certificates" routerLinkActive="active">Certificates</a>
          <a routerLink="/rankings" routerLinkActive="active">Rankings</a>
          @if (auth.currentUser()?.role === 'admin') {
            <a routerLink="/users" routerLinkActive="active">Manage Users</a>
          }
        </nav>
      }
    </header>
  `,
  styles: [`
    .masthead {
      background: var(--navy);
      border-bottom: 4px solid var(--gold);
    }
    .masthead-top {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 40px; height: 40px;
      border: 2px solid var(--gold);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: var(--gold);
      font-weight: 700;
      font-family: var(--font-headline);
      font-size: 1.1rem;
    }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { color: white; font-size: 1.15rem; }
    .brand-sub { color: var(--gold-light); font-size: 0.7rem; letter-spacing: 0.03em; text-transform: uppercase; }
    .user-box { display: flex; align-items: center; gap: 12px; }
    .user-name { color: white; font-size: 0.85rem; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; color: var(--gold-light); border-color: var(--gold-light); }
    .masthead-nav {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      gap: 4px;
      padding: 0 20px;
      overflow-x: auto;
    }
    .masthead-nav a {
      color: var(--gold-light);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 10px 14px;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
    }
    .masthead-nav a.active, .masthead-nav a:hover {
      color: white;
      border-bottom-color: var(--gold);
    }
  `],
})
export class MastheadComponent {
  constructor(public auth: AuthService) {}
}
