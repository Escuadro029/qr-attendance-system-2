import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <h1 class="headline">Dashboard</h1>
      <p class="lede">Friday Press Conference — attendance at a glance.</p>

      <div class="stat-grid">
        <div class="card stat">
          <span class="stat-num">{{ totalStudents() }}</span>
          <span class="stat-label">Registered Students</span>
        </div>
        <div class="card stat">
          <span class="stat-num">{{ totalCategories() }}</span>
          <span class="stat-label">Journalism Categories</span>
        </div>
        <div class="card stat">
          <span class="stat-num">{{ qualifiedCount() }}</span>
          <span class="stat-label">Certificate-Qualified</span>
        </div>
      </div>

      <div class="quick-links">
        <a routerLink="/scanner" class="card link-card">
          <span class="link-title">📷 Open Scanner</span>
          <span class="link-desc">Record attendance for a category</span>
        </a>
        <a routerLink="/register" class="card link-card">
          <span class="link-title">🪪 Register Student</span>
          <span class="link-desc">Add a student &amp; generate their press pass</span>
        </a>
        <a routerLink="/progress" class="card link-card">
          <span class="link-title">📊 View Progress</span>
          <span class="link-desc">Categories completed per student</span>
        </a>
        <a routerLink="/certificates" class="card link-card">
          <span class="link-title">🏅 Certificates</span>
          <span class="link-desc">Generate awards for qualified students</span>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
    .stat { display: flex; flex-direction: column; align-items: center; padding: 26px 10px; }
    .stat-num { font-family: var(--font-headline); font-size: 2.2rem; color: var(--navy); font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #777; margin-top: 4px; text-align: center; }
    .quick-links { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .link-card { text-decoration: none; display: flex; flex-direction: column; gap: 4px; transition: transform .1s; }
    .link-card:hover { transform: translateY(-2px); border-color: var(--gold); }
    .link-title { font-weight: 700; color: var(--navy); }
    .link-desc { font-size: 0.82rem; color: #777; }
    @media (max-width: 640px) {
      .stat-grid, .quick-links { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  totalStudents = signal(0);
  totalCategories = signal(0);
  qualifiedCount = signal(0);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getStudents().subscribe((s) => this.totalStudents.set(s.length));
    this.api.getCategories().subscribe((c) => this.totalCategories.set(c.length));
    this.api.getQualified().subscribe((r) => this.qualifiedCount.set(r.qualified.length));
  }
}
