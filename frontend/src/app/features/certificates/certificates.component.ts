import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [DocumentModalComponent],
  template: `
    <div class="container">
      <div class="head-row">
        <div>
          <h1 class="headline">Certificates</h1>
          <p class="lede">Students who completed {{ threshold() }} or more journalism categories qualify for a Certificate of Recognition.</p>
        </div>
        <button class="btn btn-outline" (click)="viewSample()">Preview Sample Certificate</button>
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
              @for (row of qualified(); track row.student_id) {
                <tr>
                  <td>{{ row.full_name }}</td>
                  <td>Grade {{ row.grade }} - {{ row.section }}</td>
                  <td>{{ row.categories_completed }}</td>
                  <td>
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