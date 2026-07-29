import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { GuestSpeaker, Student } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';

type Mode = 'student' | 'guest';

@Component({
  selector: 'app-register-student',
  standalone: true,
  imports: [FormsModule, DocumentModalComponent],
  template: `
    <div class="container">
      <div class="type-tabs">
        <button class="btn" [class.btn-gold]="mode() === 'student'" [class.btn-outline]="mode() !== 'student'" (click)="mode.set('student')">Register Student</button>
        <button class="btn" [class.btn-gold]="mode() === 'guest'" [class.btn-outline]="mode() !== 'guest'" (click)="mode.set('guest')">Register Guest Speaker</button>
      </div>

      @if (mode() === 'student') {
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
      } @else {
        <h1 class="headline">Register Guest Speaker</h1>
        <p class="lede">Adds a guest speaker so you can issue them a Certificate of Recognition.</p>

        <div class="grid">
          <form class="card" (ngSubmit)="submitGuest()">
            <label>Full Name</label>
            <input name="guest_full_name" [(ngModel)]="guestForm.full_name" required placeholder="Atty. Carmela Ruiz" />

            <label>Position (optional)</label>
            <input name="guest_position" [(ngModel)]="guestForm.position" placeholder="e.g. Broadcast Journalist" />

            <label>Organization (optional)</label>
            <input name="guest_organization" [(ngModel)]="guestForm.organization" placeholder="e.g. GMA News" />

            <label>Topic (optional)</label>
            <input name="guest_topic" [(ngModel)]="guestForm.topic" placeholder="e.g. Ethics in Digital Journalism" />

            @if (guestError()) { <p class="error">{{ guestError() }}</p> }

            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;" [disabled]="guestLoading()">
              {{ guestLoading() ? 'Registering…' : 'Register Guest Speaker' }}
            </button>
          </form>

          <div class="card">
            <h3 class="headline" style="font-size:1rem; margin-bottom:12px;">Registered Guest Speakers</h3>
            @if (guestSpeakersLoading()) {
              <p class="placeholder">Loading…</p>
            } @else {
              <table>
                <thead>
                  <tr><th>Name</th><th>Position</th><th></th></tr>
                </thead>
                <tbody>
                  @for (speaker of guestSpeakers(); track speaker.id) {
                    <tr>
                      <td data-label="Name">{{ speaker.full_name }}</td>
                      <td data-label="Position">{{ speaker.position || '—' }}{{ speaker.organization ? ', ' + speaker.organization : '' }}</td>
                      <td class="actions" data-label="Actions">
                        <button class="btn btn-gold btn-sm" (click)="viewCertificate(speaker)">Certificate</button>
                        <button class="btn btn-danger btn-sm" (click)="removeGuestSpeaker(speaker)">Delete</button>
                      </td>
                    </tr>
                  }
                  @empty {
                    <tr><td colspan="3" class="placeholder">No guest speakers registered yet.</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
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
    .type-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .lede { color: #666; margin: 6px 0 24px; }
    .grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { margin-top: 12px; display: block; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .preview { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; min-height: 260px; justify-content: center; }
    .qr-img { width: 160px; height: 160px; border: 1px solid var(--border); border-radius: 8px; }
    .student-name { font-weight: 700; color: var(--navy); margin: 8px 0 0; }
    .student-sub { color: #777; font-size: 0.85rem; margin: 0 0 12px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 10px; font-size: 0.78rem; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  `],
})
export class RegisterStudentComponent implements OnInit {
  mode = signal<Mode>('student');

  // Student registration
  form: Partial<Student> = { full_name: '', grade: '', section: '', lrn: '', student_id_no: '', school_name: '' };
  loading = signal(false);
  error = signal('');
  created = signal<Student | null>(null);
  qrObjectUrl = signal<string>('');
  downloading = signal(false);

  // Guest speaker registration
  guestForm: Partial<GuestSpeaker> = { full_name: '', position: '', organization: '', topic: '' };
  guestLoading = signal(false);
  guestError = signal('');
  guestSpeakers = signal<GuestSpeaker[]>([]);
  guestSpeakersLoading = signal(true);

  // Certificate view modal (guest speaker)
  modalOpen = signal(false);
  modalTitle = signal('');
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');
  private currentBlob: Blob | null = null;
  private currentFilename = '';
  private currentRawObjectUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.loadGuestSpeakers();
  }

  // ---- Student ----

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

  // ---- Guest speakers ----

  loadGuestSpeakers() {
    this.guestSpeakersLoading.set(true);
    this.api.getGuestSpeakers().subscribe({
      next: (speakers) => this.guestSpeakers.set(speakers),
      complete: () => this.guestSpeakersLoading.set(false),
    });
  }

  submitGuest() {
    if (!this.guestForm.full_name) return;
    this.guestLoading.set(true);
    this.guestError.set('');
    this.api.registerGuestSpeaker(this.guestForm).subscribe({
      next: () => {
        this.guestForm = { full_name: '', position: '', organization: '', topic: '' };
        this.loadGuestSpeakers();
      },
      error: (err) => this.guestError.set(err?.error?.error || 'Registration failed.'),
      complete: () => this.guestLoading.set(false),
    });
  }

  removeGuestSpeaker(speaker: GuestSpeaker) {
    if (!confirm(`Remove ${speaker.full_name} from guest speakers?`)) return;
    this.api.deleteGuestSpeaker(speaker.id).subscribe(() => this.loadGuestSpeakers());
  }

  viewCertificate(speaker: GuestSpeaker) {
    this.revokeCurrent();
    this.modalTitle.set(`${speaker.full_name} — Certificate of Recognition`);
    this.modalUrl.set(null);
    this.modalError.set('');
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.currentFilename = `certificate-${speaker.full_name.replace(/\s+/g, '_')}.pdf`;
    this.api.getGuestSpeakerCertificateBlob(speaker.id).subscribe({
      next: (blob) => {
        this.currentBlob = blob;
        const url = URL.createObjectURL(blob);
        this.currentRawObjectUrl = url;
        this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: (err) => this.modalError.set(err?.error?.error || 'Could not load certificate.'),
      complete: () => this.modalLoading.set(false),
    });
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
