import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { ApiService } from '../../core/services/api.service';
import { Category } from '../../core/models/models';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [FormsModule, ZXingScannerModule],
  template: `
    <div class="container narrow">
      <h1 class="headline">Scanner</h1>
      <p class="lede">Pick today's category, then scan the student's press pass QR code.</p>

      <div class="card">
        <label>Category</label>
        <select [(ngModel)]="selectedCategoryId" name="category">
          <option [ngValue]="null" disabled>Select category…</option>
          @for (cat of categories(); track cat.id) {
            <option [ngValue]="cat.id">{{ cat.name }}</option>
          }
        </select>

        <div class="scan-box">
          @if (selectedCategoryId) {
            <zxing-scanner
              [formats]="allowedFormats"
              (scanSuccess)="onScan($event)"
              [torch]="false"
              style="width:100%; border-radius: 8px; overflow:hidden;"
            ></zxing-scanner>
          } @else {
            <p class="placeholder">Choose a category above to activate the camera.</p>
          }
        </div>

        @if (lastResult()) {
          <div class="result success">
            ✅ {{ lastResult()!.student.full_name }} — {{ lastResult()!.category }} recorded.
          </div>
        }
        @if (lastError()) {
          <div class="result error">⚠️ {{ lastError() }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .narrow { max-width: 560px; }
    .lede { color: #666; margin: 6px 0 24px; }
    .scan-box { margin-top: 16px; min-height: 220px; display: flex; align-items: center; justify-content: center; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; }
    .result { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 0.9rem; }
    .result.success { background: rgba(31,138,76,0.1); color: var(--success); }
    .result.error { background: rgba(194,59,59,0.1); color: var(--danger); }
  `],
})
export class ScannerComponent implements OnInit {
  categories = signal<Category[]>([]);
  selectedCategoryId: number | null = null;
  lastResult = signal<any | null>(null);
  lastError = signal<string>('');
  allowedFormats = [BarcodeFormat.QR_CODE];

  private cooldown = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().subscribe((c) => this.categories.set(c));
  }

  onScan(qrToken: string) {
    if (this.cooldown || !this.selectedCategoryId) return;
    this.cooldown = true;
    this.lastError.set('');
    this.lastResult.set(null);

    this.api.scanAttendance(qrToken, this.selectedCategoryId).subscribe({
      next: (res) => {
        this.lastResult.set(res);
        setTimeout(() => (this.cooldown = false), 2500);
      },
      error: (err) => {
        this.lastError.set(err?.error?.error || 'Scan failed.');
        setTimeout(() => (this.cooldown = false), 2500);
      },
    });
  }
}
