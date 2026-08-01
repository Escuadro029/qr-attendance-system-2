import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow, Student } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { EditStudentModalComponent } from '../../shared/components/edit-student-modal/edit-student-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { generatePosterDataUrl, PosterFormat } from '../../core/utils/poster';
import { generatePosterZipBlob } from '../../core/utils/posterZip';

const PAGE_SIZE = 10;

const QUALIFYING_THRESHOLD = 6;

type ModalKind = 'image' | 'pdf' | null;

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent, EditStudentModalComponent, PaginationComponent],
  template: `
    <div class="container">
      <h1 class="headline">Attendance Progress</h1>
      <p class="lede">Categories completed per student across all Fridays. Every student can receive a Certificate of Completion.</p>

      <div class="card">
        <div class="toolbar">
          <input
            placeholder="Search by name, section, or student ID…"
            [(ngModel)]="search"
            (ngModelChange)="page.set(1)"
            name="search"
          />
          <div class="bulk-actions">
            <span class="selected-count">{{ selectedIds().size }} selected</span>
            <button class="btn btn-outline btn-sm" (click)="printSelectedIds()" [disabled]="selectedIds().size === 0 || bulkPrinting()">
              {{ bulkPrinting() ? 'Preparing…' : 'Print Selected IDs' }}
            </button>
            <button class="btn btn-gold btn-sm" (click)="printAllIds()" [disabled]="bulkPrinting()">
              Print All IDs
            </button>
          </div>
        </div>

        <div class="toolbar poster-bulk-row">
          <span class="bulk-label">Posters:</span>
          <select [ngModel]="posterBulkFormat()" (ngModelChange)="posterBulkFormat.set($event)" name="poster_bulk_format">
            <option value="square">Square Post</option>
            <option value="story">Story</option>
          </select>
          <button class="btn btn-outline btn-sm" (click)="downloadSelectedPosters()" [disabled]="selectedIds().size === 0 || bulkPosterPrinting()">
            {{ bulkPosterPrinting() ? 'Preparing…' : 'Print Selected Posters' }}
          </button>
          <button class="btn btn-gold btn-sm" (click)="downloadAllPosters()" [disabled]="bulkPosterPrinting()">
            {{ bulkPosterPrinting() ? 'Preparing…' : 'Print All Posters' }}
          </button>
        </div>

        <div class="toolbar cert-bulk-row">
          <span class="bulk-label">Certificates:</span>
          <button class="btn btn-outline btn-sm" (click)="printSelectedCertificates()" [disabled]="selectedIds().size === 0 || bulkCertPrinting()">
            {{ bulkCertPrinting() ? 'Preparing…' : 'Print Selected (2 per sheet)' }}
          </button>
          <button class="btn btn-gold btn-sm" (click)="printAllCertificates()" [disabled]="rows().length === 0 || bulkCertPrinting()">
            {{ bulkCertPrinting() ? 'Preparing…' : 'Print All (2 per sheet)' }}
          </button>
        </div>

        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th style="width:30px;"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll($event)" /></th>
                <th>Student ID</th>
                <th>Student</th>
                <th>Grade &amp; Section</th>
                <th>Categories Completed</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              @for (row of paged(); track row.student_id) {
                <tr>
                  <td data-label="Select"><input type="checkbox" [checked]="selectedIds().has(row.student_id)" (change)="toggleSelect(row.student_id)" /></td>
                  <td data-label="Student ID">{{ row.student_id_no || '—' }}</td>
                  <td data-label="Student">{{ row.full_name }}</td>
                  <td data-label="Grade &amp; Section">Grade {{ row.grade }} - {{ row.section }}</td>
                  <td data-label="Categories Completed">
                    <div class="category-chips">
                      @for (name of row.completed_categories; track name) {
                        <span class="chip">{{ name }}</span>
                      }
                      @empty {
                        <span class="placeholder-inline">None yet</span>
                      }
                    </div>
                  </td>
                  <td data-label="Status">
                    @if (row.categories_completed >= QUALIFYING_THRESHOLD) {
                      <span class="badge badge-qualified">Qualified ✅</span>
                    } @else {
                      <span class="badge badge-progress">{{ row.categories_completed }}/{{ QUALIFYING_THRESHOLD }}</span>
                    }
                  </td>
                  <td class="actions" data-label="View">
                    <button class="btn btn-outline btn-sm" (click)="editStudent(row)">Edit</button>
                    <button class="btn btn-outline btn-sm" (click)="viewQr(row)">QR</button>
                    <button class="btn btn-outline btn-sm" (click)="viewIdCard(row)">ID</button>
                    <button class="btn btn-outline btn-sm" (click)="openPoster(row)">Poster</button>
                    <button class="btn btn-gold btn-sm" (click)="viewCertificate(row)">Certificate</button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="7" class="placeholder">No students found.</td></tr>
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
      [kind]="modalKind()"
      [objectUrl]="modalUrl()"
      [loading]="modalLoading()"
      [errorMessage]="modalError()"
      (close)="closeModal()"
      (download)="downloadCurrent()"
    ></app-document-modal>

    <app-edit-student-modal
      [open]="editOpen()"
      [student]="editTarget()"
      [saving]="editSaving()"
      [error]="editError()"
      (close)="closeEdit()"
      (save)="saveEdit($event)"
    ></app-edit-student-modal>

    @if (posterOpen()) {
      <div class="overlay" (click)="closePoster()">
        <div class="modal card poster-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3 class="headline" style="font-size:1rem;">Social Media Poster — {{ posterRow()?.full_name }}</h3>
            <button class="close-btn" (click)="closePoster()" aria-label="Close">✕</button>
          </div>

          <div class="poster-tabs">
            <button class="btn btn-sm" [class.btn-gold]="posterFormat() === 'square'" [class.btn-outline]="posterFormat() !== 'square'" (click)="setPosterFormat('square')">Square Post</button>
            <button class="btn btn-sm" [class.btn-gold]="posterFormat() === 'story'" [class.btn-outline]="posterFormat() !== 'story'" (click)="setPosterFormat('story')">Story</button>
          </div>

          <div class="poster-preview">
            @if (posterDataUrl()) {
              <img [src]="posterDataUrl()" alt="Poster preview" />
            }
          </div>

          <button class="btn btn-gold" style="width:100%;" (click)="downloadPoster()">Download PNG</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .toolbar input[type="text"], .toolbar input:not([type]) { max-width: 280px; }
    .bulk-actions { display: flex; align-items: center; gap: 10px; }
    .selected-count { font-size: 0.8rem; color: #777; }
    .poster-bulk-row { margin: -8px 0 8px; justify-content: flex-start; }
    .cert-bulk-row { margin: -8px 0 16px; justify-content: flex-start; }
    .bulk-label { font-size: 0.8rem; color: #777; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
    .category-chips { display: flex; flex-wrap: wrap; gap: 4px; max-width: 240px; }
    .chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      background: rgba(31, 41, 61, 0.06);
      color: var(--navy);
      white-space: nowrap;
    }
    .placeholder-inline { color: #999; font-size: 0.8rem; }

    .overlay {
      position: fixed; inset: 0; background: rgba(11,31,58,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px;
    }
    .modal { width: 100%; max-height: 90vh; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
    .poster-modal { max-width: 420px; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #888; flex-shrink: 0; }
    .poster-tabs { display: flex; gap: 8px; }
    .poster-preview { display: flex; align-items: center; justify-content: center; background: #f0f0f0; border-radius: 8px; padding: 10px; }
    .poster-preview img { max-width: 100%; max-height: 60vh; border-radius: 4px; box-shadow: var(--shadow); }
  `],
})
export class ProgressComponent implements OnInit {
  QUALIFYING_THRESHOLD = QUALIFYING_THRESHOLD;
  rows = signal<ProgressRow[]>([]);
  loading = signal(true);
  search = '';
  page = signal(1);
  selectedIds = signal<Set<string>>(new Set());
  bulkPrinting = signal(false);
  bulkPosterPrinting = signal(false);
  posterBulkFormat = signal<PosterFormat>('square');
  bulkCertPrinting = signal(false);

  // View modal state
  modalOpen = signal(false);
  modalTitle = signal('');
  modalKind = signal<ModalKind>(null);
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');

  // Edit modal state
  editOpen = signal(false);
  editTarget = signal<Student | null>(null);
  editSaving = signal(false);
  editError = signal('');

  // Social media poster state
  posterOpen = signal(false);
  posterRow = signal<ProgressRow | null>(null);
  posterFormat = signal<PosterFormat>('square');
  posterDataUrl = signal<string | null>(null);

  private currentBlob: Blob | null = null;
  private currentFilename = '';
  private currentRawObjectUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getProgress().subscribe({
      next: (rows) => this.rows.set(rows),
      complete: () => {
        this.loading.set(false);
        this.clampPage();
      },
    });
  }

  private clampPage() {
    if (this.page() > this.totalPages()) this.page.set(this.totalPages());
  }

  // Plain method (not a computed signal) so it re-evaluates on every change
  // detection pass, including when `search` changes via ngModel.
  filtered(): ProgressRow[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(
      (r) =>
        r.full_name.toLowerCase().includes(term) ||
        r.section.toLowerCase().includes(term) ||
        (r.student_id_no ?? '').toLowerCase().includes(term)
    );
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE));
  }

  paged(): ProgressRow[] {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  }

  // ---- Selection / bulk printing ----

  toggleSelect(id: string) {
    const set = new Set(this.selectedIds());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedIds.set(set);
  }

  allSelected(): boolean {
    const visible = this.filtered();
    return visible.length > 0 && visible.every((r) => this.selectedIds().has(r.student_id));
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const set = new Set(this.selectedIds());
    for (const row of this.filtered()) {
      checked ? set.add(row.student_id) : set.delete(row.student_id);
    }
    this.selectedIds.set(set);
  }

  printSelectedIds() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.downloadBulkIds(ids);
  }

  printAllIds() {
    this.downloadBulkIds('all');
  }

  private downloadBulkIds(ids: string[] | 'all') {
    this.bulkPrinting.set(true);
    this.api.getBulkIdCardsBlob(ids).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'press-pass-id-cards.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => alert('Could not generate the bulk ID sheet. Please try again.'),
      complete: () => this.bulkPrinting.set(false),
    });
  }

  downloadSelectedPosters() {
    const ids = this.selectedIds();
    const rows = this.rows().filter((r) => ids.has(r.student_id));
    if (rows.length === 0) return;
    this.downloadPosterZip(rows);
  }

  downloadAllPosters() {
    this.downloadPosterZip(this.rows());
  }

  private downloadPosterZip(rows: ProgressRow[]) {
    if (rows.length === 0) return;
    const format = this.posterBulkFormat();
    this.bulkPosterPrinting.set(true);
    generatePosterZipBlob(
      rows.map((r) => ({
        fileNameBase: `poster-${r.full_name.replace(/\s+/g, '_')}`,
        data: {
          fullName: r.full_name,
          grade: r.grade,
          section: r.section,
          categoriesCompleted: r.completed_categories,
          threshold: this.QUALIFYING_THRESHOLD,
        },
      })),
      format
    )
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `posters-${format}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Could not generate the poster pack. Please try again.'))
      .finally(() => this.bulkPosterPrinting.set(false));
  }

  printSelectedCertificates() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.downloadBulkCertificates(ids);
  }

  printAllCertificates() {
    this.downloadBulkCertificates('all');
  }

  // Every student is eligible for a certificate regardless of categories
  // completed, so raw selectedIds() can be sent as-is.
  private downloadBulkCertificates(ids: string[] | 'all') {
    this.bulkCertPrinting.set(true);
    this.api.getCertificatesBulkBlob(ids).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certificates-2up.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => alert(err?.error?.error || 'Could not generate the certificate pack. Please try again.'),
      complete: () => this.bulkCertPrinting.set(false),
    });
  }

  // ---- Edit ----

  editStudent(row: ProgressRow) {
    this.editError.set('');
    this.api.getStudent(row.student_id).subscribe({
      next: (student) => {
        this.editTarget.set(student);
        this.editOpen.set(true);
      },
      error: () => alert('Could not load student details.'),
    });
  }

  saveEdit(payload: Partial<Student>) {
    const target = this.editTarget();
    if (!target) return;
    this.editSaving.set(true);
    this.editError.set('');
    this.api.updateStudent(target.id, payload).subscribe({
      next: () => {
        this.editOpen.set(false);
        this.load();
      },
      error: (err) => this.editError.set(err?.error?.error || 'Failed to save changes.'),
      complete: () => this.editSaving.set(false),
    });
  }

  closeEdit() {
    this.editOpen.set(false);
  }

  // ---- View (QR / ID / Certificate) ----

  viewQr(row: ProgressRow) {
    this.openModal(`${row.full_name} — Press Pass QR`, 'image', `qr-${row.full_name}.png`);
    this.api.getQrCodeBlob(row.student_id).subscribe({
      next: (blob) => this.setBlobResult(blob, 'image'),
      error: () => this.modalError.set('Could not load QR code.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  viewIdCard(row: ProgressRow) {
    this.openModal(`${row.full_name} — Press Pass ID`, 'pdf', `id-card-${row.full_name}.pdf`);
    this.api.getIdCardBlob(row.student_id).subscribe({
      next: (blob) => this.setBlobResult(blob, 'pdf'),
      error: () => this.modalError.set('Could not load ID card.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  viewCertificate(row: ProgressRow) {
    this.openModal(`${row.full_name} — Certificate of Recognition`, 'pdf', `certificate-${row.full_name}.pdf`);
    this.api.getCertificateBlob(row.student_id).subscribe({
      next: (blob) => this.setBlobResult(blob, 'pdf'),
      error: (err) => this.modalError.set(err?.error?.error || 'Could not load certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  private openModal(title: string, kind: 'image' | 'pdf', filename: string) {
    this.revokeCurrent();
    this.modalTitle.set(title);
    this.modalKind.set(kind);
    this.modalUrl.set(null);
    this.modalError.set('');
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.currentFilename = filename.replace(/\s+/g, '_');
  }

  private setBlobResult(blob: Blob, kind: 'image' | 'pdf') {
    this.currentBlob = blob;
    const url = URL.createObjectURL(blob);
    this.currentRawObjectUrl = url;
    this.modalUrl.set(kind === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : url);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.revokeCurrent();
  }

  downloadCurrent() {
    if (!this.currentBlob) return;
    const url = URL.createObjectURL(this.currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private revokeCurrent() {
    if (this.currentRawObjectUrl) {
      URL.revokeObjectURL(this.currentRawObjectUrl);
      this.currentRawObjectUrl = null;
    }
    this.currentBlob = null;
  }

  // ---- Social media poster ----

  openPoster(row: ProgressRow) {
    this.posterRow.set(row);
    this.posterFormat.set('square');
    this.renderPoster();
    this.posterOpen.set(true);
  }

  setPosterFormat(format: PosterFormat) {
    this.posterFormat.set(format);
    this.renderPoster();
  }

  private renderPoster() {
    const row = this.posterRow();
    if (!row) return;
    this.posterDataUrl.set(
      generatePosterDataUrl(
        {
          fullName: row.full_name,
          grade: row.grade,
          section: row.section,
          categoriesCompleted: row.completed_categories,
          threshold: this.QUALIFYING_THRESHOLD,
        },
        this.posterFormat()
      )
    );
  }

  downloadPoster() {
    const url = this.posterDataUrl();
    const row = this.posterRow();
    if (!url || !row) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `poster-${row.full_name.replace(/\s+/g, '_')}-${this.posterFormat()}.png`;
    a.click();
  }

  closePoster() {
    this.posterOpen.set(false);
    this.posterDataUrl.set(null);
  }
}