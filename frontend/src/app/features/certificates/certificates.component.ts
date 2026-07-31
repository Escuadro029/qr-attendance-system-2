import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { ProgressRow, Speaker, Teacher } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

type Mode = 'student' | 'speaker' | 'teacher';
const PAGE_SIZE = 10;

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [DocumentModalComponent, PaginationComponent],
  template: `
    <div class="container">
      <div class="type-tabs">
        <button class="btn" [class.btn-gold]="mode() === 'student'" [class.btn-outline]="mode() !== 'student'" (click)="mode.set('student')">Student</button>
        <button class="btn" [class.btn-gold]="mode() === 'speaker'" [class.btn-outline]="mode() !== 'speaker'" (click)="mode.set('speaker')">Speaker/Lecturer</button>
        <button class="btn" [class.btn-gold]="mode() === 'teacher'" [class.btn-outline]="mode() !== 'teacher'" (click)="mode.set('teacher')">Teacher</button>
      </div>

      @if (mode() === 'student') {
        <div class="head-row">
          <div>
            <h1 class="headline">Student Certificates</h1>
            <p class="lede">Students who completed {{ threshold() }} or more journalism categories qualify for a Certificate of Recognition.</p>
          </div>
          <div class="head-actions">
            <button class="btn btn-outline" (click)="viewSample()">Preview Sample Certificate</button>
            <button class="btn btn-gold" (click)="printStudentsTwoUp()" [disabled]="qualified().length === 0 || studentBulkPrinting()">
              {{ studentBulkPrinting() ? 'Preparing…' : 'Print All (2 per sheet)' }}
            </button>
          </div>
        </div>

        <div class="card">
          @if (loading()) {
            <p class="placeholder">Loading…</p>
          } @else {
            <table>
              <thead>
                <tr><th>Student</th><th>Grade &amp; Section</th><th>Categories Completed</th><th></th></tr>
              </thead>
              <tbody>
                @for (row of pagedStudents(); track row.student_id) {
                  <tr>
                    <td data-label="Student">{{ row.full_name }}</td>
                    <td data-label="Grade &amp; Section">Grade {{ row.grade }} - {{ row.section }}</td>
                    <td data-label="Categories Completed">{{ row.categories_completed }}</td>
                    <td data-label="Certificate">
                      <button class="btn btn-gold btn-sm" (click)="downloadStudent(row)" [disabled]="downloadingId() === row.student_id">
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
            <app-pagination [page]="studentPage()" [totalPages]="studentTotalPages()" (pageChange)="studentPage.set($event)"></app-pagination>
          }
        </div>
      } @else if (mode() === 'speaker') {
        <div class="head-row">
          <div>
            <h1 class="headline">Speaker/Lecturer Certificates</h1>
            <p class="lede">Print a Certificate of Recognition for any registered speaker/lecturer.</p>
          </div>
          <div class="head-actions">
            <button class="btn btn-gold" (click)="printSpeakersTwoUp()" [disabled]="speakers().length === 0 || speakerBulkPrinting()">
              {{ speakerBulkPrinting() ? 'Preparing…' : 'Print All (2 per sheet)' }}
            </button>
          </div>
        </div>

        <div class="card">
          @if (speakersLoading()) {
            <p class="placeholder">Loading…</p>
          } @else {
            <table>
              <thead>
                <tr><th>Name</th><th>Position</th><th></th></tr>
              </thead>
              <tbody>
                @for (speaker of pagedSpeakers(); track speaker.id) {
                  <tr>
                    <td data-label="Name">{{ speaker.full_name }}</td>
                    <td data-label="Position">{{ speaker.position || '—' }}{{ speaker.organization ? ', ' + speaker.organization : '' }}</td>
                    <td class="actions" data-label="Certificate">
                      <button class="btn btn-gold btn-sm" (click)="viewSpeakerCertificate(speaker)">Certificate</button>
                    </td>
                  </tr>
                }
                @empty {
                  <tr><td colspan="3" class="placeholder">No speakers/lecturers registered yet.</td></tr>
                }
              </tbody>
            </table>
            <app-pagination [page]="speakerPage()" [totalPages]="speakerTotalPages()" (pageChange)="speakerPage.set($event)"></app-pagination>
          }
        </div>
      } @else {
        <div class="head-row">
          <div>
            <h1 class="headline">Teacher Certificates</h1>
            <p class="lede">Print a Certificate of Appreciation for any registered teacher.</p>
          </div>
          <div class="head-actions">
            <button class="btn btn-gold" (click)="printTeachersTwoUp()" [disabled]="teachers().length === 0 || teacherBulkPrinting()">
              {{ teacherBulkPrinting() ? 'Preparing…' : 'Print All (2 per sheet)' }}
            </button>
          </div>
        </div>

        <div class="card">
          @if (teachersLoading()) {
            <p class="placeholder">Loading…</p>
          } @else {
            <table>
              <thead>
                <tr><th>Name</th><th>Role</th><th></th></tr>
              </thead>
              <tbody>
                @for (teacher of pagedTeachers(); track teacher.id) {
                  <tr>
                    <td data-label="Name">{{ teacher.full_name }}</td>
                    <td data-label="Role">{{ teacher.role || '—' }}{{ teacher.department ? ', ' + teacher.department : '' }}</td>
                    <td class="actions" data-label="Certificate">
                      <button class="btn btn-gold btn-sm" (click)="viewTeacherCertificate(teacher)">Certificate</button>
                    </td>
                  </tr>
                }
                @empty {
                  <tr><td colspan="3" class="placeholder">No teachers registered yet.</td></tr>
                }
              </tbody>
            </table>
            <app-pagination [page]="teacherPage()" [totalPages]="teacherTotalPages()" (pageChange)="teacherPage.set($event)"></app-pagination>
          }
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
    .type-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .head-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .lede { color: #666; margin: 6px 0 0; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  `],
})
export class CertificatesComponent implements OnInit {
  mode = signal<Mode>('student');

  // Students
  qualified = signal<ProgressRow[]>([]);
  threshold = signal(6);
  loading = signal(true);
  downloadingId = signal<string | null>(null);
  studentBulkPrinting = signal(false);
  studentPage = signal(1);

  // Speakers/lecturers
  speakers = signal<Speaker[]>([]);
  speakersLoading = signal(true);
  speakerBulkPrinting = signal(false);
  speakerPage = signal(1);

  // Teachers
  teachers = signal<Teacher[]>([]);
  teachersLoading = signal(true);
  teacherBulkPrinting = signal(false);
  teacherPage = signal(1);

  // Shared certificate-view modal (sample / speaker / teacher)
  modalOpen = signal(false);
  modalTitle = signal('');
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');
  private currentBlob: Blob | null = null;
  private currentFilename = '';
  private currentRawUrl: string | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.api.getQualified().subscribe({
      next: (res) => {
        this.qualified.set(res.qualified);
        this.threshold.set(res.threshold);
      },
      complete: () => this.loading.set(false),
    });
    this.loadSpeakers();
    this.loadTeachers();
  }

  loadSpeakers() {
    this.speakersLoading.set(true);
    this.api.getSpeakers().subscribe({
      next: (s) => this.speakers.set(s),
      complete: () => this.speakersLoading.set(false),
    });
  }

  loadTeachers() {
    this.teachersLoading.set(true);
    this.api.getTeachers().subscribe({
      next: (t) => this.teachers.set(t),
      complete: () => this.teachersLoading.set(false),
    });
  }

  // ---- Students ----

  studentTotalPages(): number {
    return Math.max(1, Math.ceil(this.qualified().length / PAGE_SIZE));
  }

  pagedStudents(): ProgressRow[] {
    const start = (this.studentPage() - 1) * PAGE_SIZE;
    return this.qualified().slice(start, start + PAGE_SIZE);
  }

  downloadStudent(row: ProgressRow) {
    this.downloadingId.set(row.student_id);
    this.api.getCertificateBlob(row.student_id).subscribe({
      next: (blob) => this.triggerDownload(blob, `certificate-${row.full_name.replace(/\s+/g, '_')}.pdf`),
      complete: () => this.downloadingId.set(null),
    });
  }

  printStudentsTwoUp() {
    this.studentBulkPrinting.set(true);
    this.api.getCertificatesBulkBlob('all').subscribe({
      next: (blob) => this.triggerDownload(blob, 'certificates-2up.pdf'),
      complete: () => this.studentBulkPrinting.set(false),
    });
  }

  // ---- Speakers/lecturers ----

  speakerTotalPages(): number {
    return Math.max(1, Math.ceil(this.speakers().length / PAGE_SIZE));
  }

  pagedSpeakers(): Speaker[] {
    const start = (this.speakerPage() - 1) * PAGE_SIZE;
    return this.speakers().slice(start, start + PAGE_SIZE);
  }

  printSpeakersTwoUp() {
    this.speakerBulkPrinting.set(true);
    this.api.getSpeakersBulkBlob('all').subscribe({
      next: (blob) => this.triggerDownload(blob, 'speaker-certificates-2up.pdf'),
      complete: () => this.speakerBulkPrinting.set(false),
    });
  }

  viewSpeakerCertificate(speaker: Speaker) {
    this.revokeCurrent();
    this.modalTitle.set(`${speaker.full_name} — Certificate of Recognition`);
    this.modalUrl.set(null);
    this.modalError.set('');
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.currentFilename = `certificate-${speaker.full_name.replace(/\s+/g, '_')}.pdf`;
    this.api.getSpeakerCertificateBlob(speaker.id).subscribe({
      next: (blob) => this.setModalBlob(blob),
      error: (err) => this.modalError.set(err?.error?.error || 'Could not load certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  // ---- Teachers ----

  teacherTotalPages(): number {
    return Math.max(1, Math.ceil(this.teachers().length / PAGE_SIZE));
  }

  pagedTeachers(): Teacher[] {
    const start = (this.teacherPage() - 1) * PAGE_SIZE;
    return this.teachers().slice(start, start + PAGE_SIZE);
  }

  printTeachersTwoUp() {
    this.teacherBulkPrinting.set(true);
    this.api.getTeachersBulkBlob('all').subscribe({
      next: (blob) => this.triggerDownload(blob, 'teacher-certificates-2up.pdf'),
      complete: () => this.teacherBulkPrinting.set(false),
    });
  }

  viewTeacherCertificate(teacher: Teacher) {
    this.revokeCurrent();
    this.modalTitle.set(`${teacher.full_name} — Certificate of Appreciation`);
    this.modalUrl.set(null);
    this.modalError.set('');
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.currentFilename = `certificate-${teacher.full_name.replace(/\s+/g, '_')}.pdf`;
    this.api.getTeacherCertificateBlob(teacher.id).subscribe({
      next: (blob) => this.setModalBlob(blob),
      error: (err) => this.modalError.set(err?.error?.error || 'Could not load certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  // ---- Shared modal / download helpers ----

  viewSample() {
    this.revokeCurrent();
    this.modalTitle.set('Sample Certificate of Recognition');
    this.modalUrl.set(null);
    this.modalError.set('');
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.currentFilename = 'certificate-sample.pdf';
    this.api.getSampleCertificateBlob().subscribe({
      next: (blob) => this.setModalBlob(blob),
      error: () => this.modalError.set('Could not load sample certificate.'),
      complete: () => this.modalLoading.set(false),
    });
  }

  private setModalBlob(blob: Blob) {
    this.currentBlob = blob;
    const url = URL.createObjectURL(blob);
    this.currentRawUrl = url;
    this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  closeModal() {
    this.modalOpen.set(false);
    this.revokeCurrent();
  }

  downloadCurrent() {
    if (!this.currentBlob) return;
    this.triggerDownload(this.currentBlob, this.currentFilename);
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private revokeCurrent() {
    if (this.currentRawUrl) {
      URL.revokeObjectURL(this.currentRawUrl);
      this.currentRawUrl = null;
    }
    this.currentBlob = null;
  }
}
