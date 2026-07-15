import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Student } from '../../core/models/models';

@Component({
  selector: 'app-register-student',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <h1 class="headline">Register Student</h1>
      <p class="lede">Adds the student and instantly generates their press-pass QR code.</p>

      <div class="grid">
        <form class="card" (ngSubmit)="submit()">
          <label>Full Name</label>
          <input name="full_name" [(ngModel)]="form.full_name" required placeholder="Juan Dela Cruz" />

          <div class="row">
            <div>
              <label>Grade</label>
              <input name="grade" [(ngModel)]="form.grade" required placeholder="10" />
            </div>
            <div>
              <label>Section</label>
              <input name="section" [(ngModel)]="form.section" required placeholder="Rizal" />
            </div>
          </div>

          <label>LRN (optional)</label>
          <input name="lrn" [(ngModel)]="form.lrn" placeholder="12-digit Learner Reference Number" />

          <label>Student ID No. (optional)</label>
          <input name="student_id_no" [(ngModel)]="form.student_id_no" placeholder="e.g. 2026-00123" />

          <label>School Name</label>
          <input name="school_name" [(ngModel)]="form.school_name" placeholder="Your School Name" />

          @if (error()) { <p class="error">{{ error() }}</p> }

          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;" [disabled]="loading()">
            {{ loading() ? 'Registering…' : 'Register & Generate QR' }}
          </button>
        </form>

        <div class="card preview">
          @if (created()) {
            <h3 class="headline" style="font-size:1rem;">Press Pass Ready</h3>
            @if (qrUrl()) {
              <img [src]="qrUrl()" alt="QR code" class="qr-img" />
            }
            <p class="student-name">{{ created()!.full_name }}</p>
            <p class="student-sub">Grade {{ created()!.grade }} - {{ created()!.section }}</p>
            <button class="btn btn-gold" (click)="downloadIdCard()" [disabled]="downloading()">
              {{ downloading() ? 'Preparing…' : 'Download ID Card (PDF)' }}
            </button>
          } @else {
            <p class="placeholder">The QR code and printable ID card preview will appear here after registration.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; }
    .grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { margin-top: 12px; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .preview { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; min-height: 260px; justify-content: center; }
    .qr-img { width: 160px; height: 160px; border: 1px solid var(--border); border-radius: 8px; }
    .student-name { font-weight: 700; color: var(--navy); margin: 8px 0 0; }
    .student-sub { color: #777; font-size: 0.85rem; margin: 0 0 12px; }
    .placeholder { color: #999; font-size: 0.85rem; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class RegisterStudentComponent {
  form: Partial<Student> = { full_name: '', grade: '', section: '', lrn: '', student_id_no: '', school_name: '' };
  loading = signal(false);
  error = signal('');
  created = signal<Student | null>(null);
  qrObjectUrl = signal<string>('');
  downloading = signal(false);

  constructor(private api: ApiService) {}

  submit() {
    if (!this.form.full_name || !this.form.grade || !this.form.section) return;
    this.loading.set(true);
    this.error.set('');
    this.api.registerStudent(this.form).subscribe({
      next: (student) => {
        this.created.set(student);
        this.loadQrPreview(student.id);
        this.form = { full_name: '', grade: '', section: '', lrn: '', student_id_no: '', school_name: this.form.school_name };
      },
      error: (err) => this.error.set(err?.error?.error || 'Registration failed.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadQrPreview(studentId: string) {
    this.api.getQrCodeBlob(studentId).subscribe((blob) => {
      if (this.qrObjectUrl()) URL.revokeObjectURL(this.qrObjectUrl());
      this.qrObjectUrl.set(URL.createObjectURL(blob));
    });
  }

  qrUrl(): string {
    return this.qrObjectUrl();
  }

  downloadIdCard() {
    if (!this.created()) return;
    this.downloading.set(true);
    this.api.getIdCardBlob(this.created()!.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `id-card-${this.created()!.full_name.replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      complete: () => this.downloading.set(false),
    });
  }
}
