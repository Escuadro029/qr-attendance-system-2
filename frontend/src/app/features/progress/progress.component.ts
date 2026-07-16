import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow, Student } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { EditStudentModalComponent } from '../../shared/components/edit-student-modal/edit-student-modal.component';

const QUALIFYING_THRESHOLD = 6;

type ModalKind = 'image' | 'pdf' | null;

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent, EditStudentModalComponent],
  template: `
    <div class="container">
      <h1 class="headline">Attendance Progress</h1>
      <p class="lede">Categories completed per student across all Fridays. {{ QUALIFYING_THRESHOLD }} or more qualifies for a certificate.</p>

      <div class="card">
        <div class="toolbar">
          <input
            placeholder="Search by name or section…"
            [(ngModel)]="search"
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

        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th style="width:30px;"><input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll($event)" /></th>
                <th>Student</th>
                <th>Grade &amp; Section</th>
                <th>Categories Completed</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filtered(); track row.student_id) {
                <tr>
                  <td><input type="checkbox" [checked]="selectedIds().has(row.student_id)" (change)="toggleSelect(row.student_id)" /></td>
                  <td>{{ row.full_name }}</td>
                  <td>Grade {{ row.grade }} - {{ row.section }}</td>
                  <td>{{ row.categories_completed }}</td>
                  <td>
                    @if (row.categories_completed >= QUALIFYING_THRESHOLD) {
                      <span class="badge badge-qualified">Qualified ✅</span>
                    } @else {
                      <span class="badge badge-progress">{{ row.categories_completed }}/{{ QUALIFYING_THRESHOLD }}</span>
                    }
                  </td>
                  <td class="actions">
                    <button class="btn btn-outline btn-sm" (click)="editStudent(row)">Edit</button>
                    <button class="btn btn-outline btn-sm" (click)="viewQr(row)">QR</button>
                    <button class="btn btn-outline btn-sm" (click)="viewIdCard(row)">ID</button>
                    @if (row.categories_completed >= QUALIFYING_THRESHOLD) {
                      <button class="btn btn-gold btn-sm" (click)="viewCertificate(row)">Certificate</button>
                    }
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="6" class="placeholder">No students found.</td></tr>
              }
            </tbody>
          </table>
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
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .toolbar input[type="text"], .toolbar input:not([type]) { max-width: 280px; }
    .bulk-actions { display: flex; align-items: center; gap: 10px; }
    .selected-count { font-size: 0.8rem; color: #777; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
  `],
})
export class ProgressComponent implements OnInit {
  QUALIFYING_THRESHOLD = QUALIFYING_THRESHOLD;
  rows = signal<ProgressRow[]>([]);
  loading = signal(true);
  search = '';
  selectedIds = signal<Set<string>>(new Set());
  bulkPrinting = signal(false);

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
      complete: () => this.loading.set(false),
    });
  }

  // Plain method (not a computed signal) so it re-evaluates on every change
  // detection pass, including when `search` changes via ngModel.
  filtered(): ProgressRow[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter(
      (r) => r.full_name.toLowerCase().includes(term) || r.section.toLowerCase().includes(term)
    );
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
}