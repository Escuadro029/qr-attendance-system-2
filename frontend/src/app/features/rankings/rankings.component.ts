import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { Category, Ranking, RankPlace, Student } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const RANK_LABELS: Record<number, string> = {
  1: '1st Place', 2: '2nd Place', 3: '3rd Place', 4: '4th Place', 5: '5th Place',
  6: '6th Place', 7: '7th Place', 8: '8th Place', 9: '9th Place', 10: '10th Place',
};
const RANKS: RankPlace[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_SIZE = 10;

// Categories like "Radio Broadcasting" are produced by a crew rather than a
// single writer/photographer, so they're grouped/printed as a "Team"
// category instead of "Journalism". Mirrors backend/src/utils/rankingsListPdf.js.
function isTeamCategory(name: string): boolean {
  return /\b(team|broadcast|radio)\b/i.test(name || '');
}

@Component({
  selector: 'app-rankings',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent, PaginationComponent],
  template: `
    <div class="container">
      <h1 class="headline">Category Rankings</h1>
      <p class="lede">Assign 1st through 10th place per journalism category, then print each winner's Certificate of Recognition.</p>

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
          <div class="student-picker">
            <label>Student</label>
            <input
              type="text"
              placeholder="Search by name or student ID…"
              [ngModel]="studentQuery()"
              (ngModelChange)="onStudentQueryChange($event)"
              name="student_search"
              autocomplete="off"
              (focus)="studentDropdownOpen.set(true)"
              (blur)="onStudentInputBlur()"
            />
            @if (studentDropdownOpen()) {
              <div class="student-dropdown">
                @for (s of filteredStudents(); track s.id) {
                  <div class="student-option" (mousedown)="$event.preventDefault(); selectStudent(s)">
                    {{ s.full_name }} — Grade {{ s.grade }} - {{ s.section }}{{ s.student_id_no ? ' (' + s.student_id_no + ')' : '' }}
                  </div>
                } @empty {
                  <div class="student-option placeholder">No matching students.</div>
                }
              </div>
            }
          </div>
          <div>
            <label>Rank</label>
            <select [(ngModel)]="form.rank" name="rank">
              @for (r of ranks; track r) {
                <option [ngValue]="r">{{ rankLabel(r) }}</option>
              }
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
        <div class="card-head-row">
          <h3 class="headline" style="font-size:1rem; margin-bottom:14px;">Current Rankings</h3>
          <div class="print-actions">
            <button
              class="btn btn-primary btn-sm"
              (click)="printCategoryList()"
              [disabled]="selectedCategoryId() === 'all' || listPrinting()"
              title="Print a plain 1st–10th place results list for the selected category"
            >
              {{ listPrinting() ? 'Preparing…' : 'Print Rankings List' }}
            </button>
            <button class="btn btn-gold btn-sm" (click)="printAllTwoUp()" [disabled]="filteredRankings().length === 0 || bulkPrinting()">
              {{ bulkPrinting() ? 'Preparing…' : (isFiltering() ? 'Print Filtered (2 per sheet)' : 'Print All (2 per sheet)') }}
            </button>
          </div>
        </div>

        <div class="filter-row">
          <div>
            <label>Filter by Category</label>
            <select [ngModel]="selectedCategoryId()" (ngModelChange)="onCategoryFilterChange($event)" name="category_filter">
              <option [ngValue]="'all'">All Categories</option>
              <optgroup label="Journalism">
                @for (cat of journalismCategories(); track cat.id) {
                  <option [ngValue]="cat.id">{{ cat.name }}</option>
                }
              </optgroup>
              <optgroup label="Team">
                @for (cat of teamCategories(); track cat.id) {
                  <option [ngValue]="cat.id">{{ cat.name }}</option>
                }
              </optgroup>
            </select>
          </div>
          <div>
            <label>Search Student</label>
            <input
              type="text"
              placeholder="Search by student name…"
              [ngModel]="search()"
              (ngModelChange)="onSearchChange($event)"
              name="ranking_search"
              autocomplete="off"
            />
          </div>
        </div>

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
              @for (r of paged(); track r.id) {
                <tr>
                  <td data-label="Category">{{ r.category_name }}</td>
                  <td data-label="Rank"><span class="badge" [class.badge-qualified]="r.rank===1" [class.badge-progress]="r.rank!==1">{{ rankLabel(r.rank) }}</span></td>
                  <td data-label="Student">{{ r.student_name }}</td>
                  <td data-label="Grade &amp; Section">Grade {{ r.grade }} - {{ r.section }}</td>
                  <td class="actions" data-label="Actions">
                    <button class="btn btn-gold btn-sm" (click)="viewCertificate(r)">Certificate</button>
                    <button class="btn btn-danger btn-sm" (click)="remove(r)">Remove</button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="5" class="placeholder">
                  {{ rankings().length === 0 ? 'No rankings assigned yet.' : 'No rankings match your filter.' }}
                </td></tr>
              }
            </tbody>
          </table>
          <app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="page.set($event)"></app-pagination>
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
    .card-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .print-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .assign-row { display: grid; grid-template-columns: 1fr 1.4fr 0.8fr auto; gap: 12px; align-items: end; }
    .student-picker { position: relative; }
    .student-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 20;
      max-height: 220px; overflow-y: auto; margin-top: 4px;
      background: var(--paper-card); border: 1px solid var(--border); border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .student-option { padding: 8px 12px; font-size: 0.88rem; cursor: pointer; }
    .student-option:hover { background: var(--paper); }
    .student-option.placeholder { color: #999; cursor: default; }
    .student-option.placeholder:hover { background: transparent; }
    .hint { font-size: 0.78rem; color: #999; margin-top: 10px; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
    @media (max-width: 800px) { .assign-row { grid-template-columns: 1fr; } .filter-row { grid-template-columns: 1fr; } }
  `],
})
export class RankingsComponent implements OnInit {
  readonly ranks = RANKS;

  categories = signal<Category[]>([]);
  students = signal<Student[]>([]);
  rankings = signal<Ranking[]>([]);
  loading = signal(true);
  saving = signal(false);
  bulkPrinting = signal(false);
  listPrinting = signal(false);
  error = signal('');
  page = signal(1);

  selectedCategoryId = signal<number | 'all'>('all');
  search = signal('');

  form: { category_id: number | null; student_id: string | null; rank: RankPlace } = {
    category_id: null,
    student_id: null,
    rank: 1,
  };

  studentQuery = signal('');
  studentDropdownOpen = signal(false);

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
      complete: () => {
        this.loading.set(false);
        if (this.page() > this.totalPages()) this.page.set(this.totalPages());
      },
    });
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRankings().length / PAGE_SIZE));
  }

  paged(): Ranking[] {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredRankings().slice(start, start + PAGE_SIZE);
  }

  rankLabel(rank: number): string {
    return RANK_LABELS[rank] || `Rank ${rank}`;
  }

  journalismCategories(): Category[] {
    return this.categories().filter((c) => !isTeamCategory(c.name));
  }

  teamCategories(): Category[] {
    return this.categories().filter((c) => isTeamCategory(c.name));
  }

  isFiltering(): boolean {
    return this.selectedCategoryId() !== 'all' || !!this.search().trim();
  }

  // Plain method (not a computed signal) so it re-evaluates on every change
  // detection pass, matching the studentQuery/filteredStudents pattern above.
  filteredRankings(): Ranking[] {
    const categoryId = this.selectedCategoryId();
    const term = this.search().trim().toLowerCase();
    return this.rankings().filter((r) => {
      const matchesCategory = categoryId === 'all' || r.category_id === categoryId;
      const matchesSearch = !term || r.student_name.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }

  onCategoryFilterChange(value: number | 'all') {
    this.selectedCategoryId.set(value);
    this.page.set(1);
  }

  onSearchChange(value: string) {
    this.search.set(value);
    this.page.set(1);
  }

  // Plain method (not a computed signal) so it re-evaluates on every change
  // detection pass, including when `studentQuery` changes via ngModel.
  filteredStudents(): Student[] {
    const term = this.studentQuery().trim().toLowerCase();
    if (!term) return this.students();
    return this.students().filter(
      (s) => s.full_name.toLowerCase().includes(term) || (s.student_id_no ?? '').toLowerCase().includes(term)
    );
  }

  onStudentQueryChange(value: string) {
    this.studentQuery.set(value);
    this.studentDropdownOpen.set(true);
    this.form.student_id = null;
  }

  selectStudent(s: Student) {
    this.form.student_id = s.id;
    this.studentQuery.set(s.full_name);
    this.studentDropdownOpen.set(false);
  }

  // Delayed so a click on a dropdown option (which also blurs the input)
  // still registers before the dropdown disappears.
  onStudentInputBlur() {
    setTimeout(() => this.studentDropdownOpen.set(false), 150);
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
        this.studentQuery.set('');
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

  printAllTwoUp() {
    this.bulkPrinting.set(true);
    const ids: string[] | 'all' = this.isFiltering() ? this.filteredRankings().map((r) => r.id) : 'all';
    this.api.getRankingsBulkBlob(ids).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ranking-certificates-2up.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      complete: () => this.bulkPrinting.set(false),
    });
  }

  printCategoryList() {
    const categoryId = this.selectedCategoryId();
    if (categoryId === 'all') return;
    this.listPrinting.set(true);
    this.api.getRankingsListBlob(categoryId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rankings-list.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Could not generate the rankings list for this category.'),
      complete: () => this.listPrinting.set(false),
    });
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