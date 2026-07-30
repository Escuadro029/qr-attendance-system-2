import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [DocumentModalComponent, PaginationComponent],
  template: `
    <div class="container">
      <div class="head-row">
        <div>
          <h1 class="headline">Certificates</h1>
          <p class="lede">Students who completed {{ threshold() }} or more journalism categories qualify for a Certificate of Recognition.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-outline" (click)="viewSample()">Preview Sample Certificate</button>
          <button class="btn btn-gold" (click)="printAllTwoUp()" [disabled]="qualified().length === 0 || bulkPrinting()">
            {{ bulkPrinting() ? 'Preparing…' : 'Print All (2 per sheet)' }}
          </button>
        </div>
      </div>

      <div class="card">
        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade &amp; Section</th>
                <th>Categories Completed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of paged(); track row.student_id) {
                <tr>
                  <td data-label="Student">{{ row.full_name }}</td>
                  <td data-label="Grade &amp; Section">Grade {{ row.grade }} - {{ row.section }}</td>
                  <td data-label="Categories Completed">{{ row.categories_completed }}</td>
                  <td data-label="Certificate">
                    <button class="btn btn-gold btn-sm" (click)="download(row)" [disabled]="downloadingId() === row.student_id">
                      {{ downloadingId() === row.student_id ? 'Preparing…' : 'Download PDF' }}
                    </button>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="4" class="placeholder">No students have qualified yet.</td></tr>
              }
            </tbody>
          </table>
          <app-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="page.set($event)"></app-pagination>
        }
      </div>
    </div>

    <app-document-modal
      [open]="modalOpen()"
      [title]="'Sample Certificate of Recognition'"
      [kind]="'pdf'"
      [objectUrl]="modalUrl()"
      [loading]="modalLoading()"
      [errorMessage]="modalError()"
      (close)="closeModal()"
      (download)="downloadSample()"
    ></app-document-modal>
  `,
  styles: [`
    .head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .head-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .lede { color: #666; margin: 6px 0 0; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  `],
})
export class CertificatesComponent implements OnInit {
  qualified = signal<ProgressRow[]>([]);
  threshold = signal(6);
  loading = signal(true);
  downloadingId = signal<string | null>(null);
  bulkPrinting = signal(false);
  page = signal(1);

  modalOpen = signal(false);
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');
  private sampleBlob: Blob | null = null;
  private sampleRawUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.api.getQualified().subscribe({
      next: (res) => {
        this.qualified.set(res.qualified);
        this.threshold.set(res.threshold);
      },
      complete: () => this.loading.set(false),
    });
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.qualified().length / PAGE_SIZE));
  }

  paged(): ProgressRow[] {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.qualified().slice(start, start + PAGE_SIZE);
  }

  download(row: ProgressRow) {
    this.downloadingId.set(row.student_id);
    this.api.getCertificateBlob(row.student_id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate-${row.full_name.replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      complete: () => this.downloadingId.set(null),
    });
  }

  printAllTwoUp() {
    this.bulkPrinting.set(true);
    this.api.getCertificatesBulkBlob('all').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certificates-2up.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      complete: () => this.bulkPrinting.set(false),
    });
  }

  viewSample() {
    this.modalOpen.set(true);
    this.modalLoading.set(true);
    this.modalError.set('');
    this.api.getSampleCertificateBlob().subscribe({
      next: (blob) => {
        this.sampleBlob = blob;
        const url = URL.createObjectURL(blob);
        this.sampleRawUrl = url;
        this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: () => this.modalError.set('Could not load sample certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  closeModal() {
    this.modalOpen.set(false);
    if (this.sampleRawUrl) {
      URL.revokeObjectURL(this.sampleRawUrl);
      this.sampleRawUrl = null;
    }
    this.sampleBlob = null;
  }

  downloadSample() {
    if (!this.sampleBlob) return;
    const url = URL.createObjectURL(this.sampleBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'certificate-sample.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
}