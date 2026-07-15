import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';

const QUALIFYING_THRESHOLD = 6;

type ModalKind = 'image' | 'pdf' | null;

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent],
  template: `
    <div class="container">
      <h1 class="headline">Attendance Progress</h1>
      <p class="lede">Categories completed per student across all Fridays. {{ QUALIFYING_THRESHOLD }} or more qualifies for a certificate.</p>

      <div class="card">
        <input
          placeholder="Search by name or section…"
          [(ngModel)]="search"
          name="search"
          style="margin-bottom: 16px;"
        />

        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <table>
            <thead>
              <tr>
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
                    <button class="btn btn-outline btn-sm" (click)="viewQr(row)">QR</button>
                    <button class="btn btn-outline btn-sm" (click)="viewIdCard(row)">ID</button>
                    @if (row.categories_completed >= QUALIFYING_THRESHOLD) {
                      <button class="btn btn-gold btn-sm" (click)="viewCertificate(row)">Certificate</button>
                    }
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="5" class="placeholder">No students found.</td></tr>
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
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
  `],
})
export class ProgressComponent implements OnInit {
  QUALIFYING_THRESHOLD = QUALIFYING_THRESHOLD;
  rows = signal<ProgressRow[]>([]);
  loading = signal(true);
  search = '';

  // Modal state
  modalOpen = signal(false);
  modalTitle = signal('');
  modalKind = signal<ModalKind>(null);
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');

  private currentBlob: Blob | null = null;
  private currentFilename = '';
  private currentRawObjectUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
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
