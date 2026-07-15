import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow } from '../../core/models/models';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [],
  template: `
    <div class="container">
      <h1 class="headline">Certificates</h1>
      <p class="lede">Students who completed {{ threshold() }} or more journalism categories qualify for a Certificate of Recognition.</p>

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
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  `],
})
export class CertificatesComponent implements OnInit {
  qualified = signal<ProgressRow[]>([]);
  threshold = signal(6);
  loading = signal(true);
  downloadingId = signal<string | null>(null);

  constructor(private api: ApiService) {}

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
}
