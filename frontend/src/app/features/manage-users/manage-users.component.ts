import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { AppUser } from '../../core/models/models';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <h1 class="headline">Manage Users</h1>
      <p class="lede">Add teacher or admin accounts that can log in to this system.</p>

      <div class="grid">
        <form class="card" (ngSubmit)="submit()">
          <label>Full Name</label>
          <input name="full_name" [(ngModel)]="form.full_name" required placeholder="Maria Santos" />

          <label style="margin-top:12px;">Email</label>
          <input type="email" name="email" [(ngModel)]="form.email" required placeholder="maria.santos@school.edu.ph" />

          <label style="margin-top:12px;">Temporary Password</label>
          <input type="text" name="password" [(ngModel)]="form.password" required placeholder="At least 8 characters" />

          <label style="margin-top:12px;">Role</label>
          <select name="role" [(ngModel)]="form.role">
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>

          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (success()) { <p class="success">{{ success() }}</p> }

          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;" [disabled]="loading()">
            {{ loading() ? 'Adding…' : 'Add User' }}
          </button>
        </form>

        <div class="card">
          <h3 class="headline" style="font-size:1rem; margin-bottom:12px;">Existing Accounts</h3>
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr>
                  <td>{{ u.full_name }}</td>
                  <td>{{ u.email }}</td>
                  <td><span class="badge" [class.badge-qualified]="u.role === 'admin'" [class.badge-progress]="u.role === 'teacher'">{{ u.role }}</span></td>
                  <td>
                    @if (u.id !== currentUserId()) {
                      <button class="btn btn-danger btn-sm" (click)="remove(u)">Remove</button>
                    }
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="4" class="placeholder">No users yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .success { color: var(--success); font-size: 0.85rem; margin-top: 10px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class ManageUsersComponent implements OnInit {
  form = { full_name: '', email: '', password: '', role: 'teacher' as 'teacher' | 'admin' };
  loading = signal(false);
  error = signal('');
  success = signal('');
  users = signal<AppUser[]>([]);

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit() {
    this.load();
  }

  currentUserId(): string | undefined {
    return this.auth.currentUser()?.id;
  }

  load() {
    this.api.getUsers().subscribe((u) => this.users.set(u));
  }

  submit() {
    if (!this.form.full_name || !this.form.email || !this.form.password) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.api.createUser(this.form).subscribe({
      next: (user) => {
        this.success.set(`${user.full_name} added successfully.`);
        this.form = { full_name: '', email: '', password: '', role: 'teacher' };
        this.load();
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to add user.'),
      complete: () => this.loading.set(false),
    });
  }

  remove(u: AppUser) {
    if (!confirm(`Remove ${u.full_name}'s account? They will no longer be able to log in.`)) return;
    this.api.deleteUser(u.id).subscribe(() => this.load());
  }
}
