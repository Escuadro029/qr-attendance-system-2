import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { Category, Ranking, Student } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';

const RANK_LABELS: Record<number, string> = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };

@Component({
  selector: 'app-rankings',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent],
  template: `
    <div class="container">
      <h1 class="headline">Category Rankings</h1>
      <p class="lede">Assign 1st, 2nd, and 3rd place per journalism category, then print each winner's Certificate of Recognition.</p>

      <div class="card assign-card">
        <h3 class="headline" style="font-size:1rem; margin-bottom:14px;">Assign a Ranking</h3>
        <div class="assign-row">
          <div>
            <label>Category</label>
            <select [(ngModel)]="form.category_id" name="category_id">
              <option [ngValue]="null" disabled>Select category…</option>
              @for (cat of categories(); track cat.id) {
                <option [ngValue]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div>
            <label>Student</label>
            <select [(ngModel)]="form.student_id" name="student_id">
              <option [ngValue]="null" disabled>Select student…</option>
              @for (s of students(); track s.id) {
                <option [ngValue]="s.id">{{ s.full_name }} (Grade {{ s.grade }} - {{ s.section }})</option>
              }
            </select>
          </div>
          <div>
            <label>Rank</label>
            <select [(ngModel)]="form.rank" name="rank">
              <option [ngValue]="1">1st Place</option>
              <option [ngValue]="2">2nd Place</option>
              <option [ngValue]="3">3rd Place</option>
            </select>
          </div>
          <button class="btn btn-primary" (click)="assign()" [disabled]="!form.category_id || !form.student_id || saving()">
            {{ saving() ? 'Saving…' : 'Assign' }}
          </button>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <p class="hint">Assigning a rank that's already taken for that category reassigns it to the new student.</p>
      </div>

      <div class="card">
        <h3 class="headline" style="font-size:1rem; margin-bottom:14px;">Current Rankings</h3>
        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Rank</th>
                <th>Student</th>
                <th>Grade &amp; Section</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of rankings(); track r.id) {
                <tr>
                  <td>{{ r.category_name }}</td>
                  <td><span class="badge" [class.badge-qualified]="r.rank===1" [class.badge-progress]="r.rank!==1">{{ rankLabel(r.rank) }}</span></td>
                  <td>{{ r.student_name }}</td>
                  <td>Grade {{ r.grade }} - {{ r.section }}</td>
                  <td class="actions">
                    <button class="btn btn-gold btn-sm" (click)="viewCertificate(r)">Certificate</button>
                    <button class="btn btn-danger btn-sm" (click)="remove(r)">Remove</button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="5" class="placeholder">No rankings assigned yet.</td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    <app-document-modal
      [open]="modalOpen()"
      [title]="modalTitle()"
      [kind]="'pdf'"
      [objectUrl]="modalUrl()"
      [loading]="modalLoading()"
      [errorMessage]="modalError()"
      (close)="closeModal()"
      (download)="downloadCurrent()"
    ></app-document-modal>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .assign-card { margin-bottom: 20px; }
    .assign-row { display: grid; grid-template-columns: 1fr 1.4fr 0.8fr auto; gap: 12px; align-items: end; }
    .hint { font-size: 0.78rem; color: #999; margin-top: 10px; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
    @media (max-width: 800px) { .assign-row { grid-template-columns: 1fr; } }
  `],
})
export class RankingsComponent implements OnInit {
  categories = signal<Category[]>([]);
  students = signal<Student[]>([]);
  rankings = signal<Ranking[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');

  form: { category_id: number | null; student_id: string | null; rank: 1 | 2 | 3 } = {
    category_id: null,
    student_id: null,
    rank: 1,
  };

  modalOpen = signal(false);
  modalTitle = signal('');
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');
  private currentBlob: Blob | null = null;
  private currentRawUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.api.getCategories().subscribe((c) => this.categories.set(c));
    this.api.getStudents().subscribe((s) => this.students.set(s));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getRankings().subscribe({
      next: (r) => this.rankings.set(r),
      complete: () => this.loading.set(false),
    });
  }

  rankLabel(rank: number): string {
    return RANK_LABELS[rank] || `Rank ${rank}`;
  }

  assign() {
    if (!this.form.category_id || !this.form.student_id) return;
    this.saving.set(true);
    this.error.set('');
    this.api.setRanking({
      category_id: this.form.category_id,
      student_id: this.form.student_id,
      rank: this.form.rank,
    }).subscribe({
      next: () => {
        this.form.student_id = null;
        this.load();
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to save ranking.'),
      complete: () => this.saving.set(false),
    });
  }

  remove(r: Ranking) {
    if (!confirm(`Remove ${this.rankLabel(r.rank)} for ${r.category_name}?`)) return;
    this.api.deleteRanking(r.id).subscribe(() => this.load());
  }

  viewCertificate(r: Ranking) {
    this.modalOpen.set(true);
    this.modalTitle.set(`${r.student_name} — ${this.rankLabel(r.rank)}, ${r.category_name}`);
    this.modalLoading.set(true);
    this.modalError.set('');
    this.api.getRankingCertificateBlob(r.id).subscribe({
      next: (blob) => {
        this.currentBlob = blob;
        const url = URL.createObjectURL(blob);
        this.currentRawUrl = url;
        this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: () => this.modalError.set('Could not load certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  closeModal() {
    this.modalOpen.set(false);
    if (this.currentRawUrl) {
      URL.revokeObjectURL(this.currentRawUrl);
      this.currentRawUrl = null;
    }
    this.currentBlob = null;
  }

  downloadCurrent() {
    if (!this.currentBlob) return;
    const url = URL.createObjectURL(this.currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ranking-certificate.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
}