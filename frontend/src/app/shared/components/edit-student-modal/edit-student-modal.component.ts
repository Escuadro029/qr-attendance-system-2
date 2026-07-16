import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Student } from '../../../core/models/models';

@Component({
  selector: 'app-edit-student-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open) {
      <div class="overlay" (click)="close.emit()">
        <div class="modal card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3 class="headline" style="font-size:1rem;">Edit Student</h3>
            <button class="close-btn" (click)="close.emit()" aria-label="Close">✕</button>
          </div>

          <form (ngSubmit)="submit()">
            <label>Full Name</label>
            <input name="full_name" [(ngModel)]="form.full_name" required />

            <div class="row">
              <div>
                <label>Grade</label>
                <input name="grade" [(ngModel)]="form.grade" required />
              </div>
              <div>
                <label>Section</label>
                <input name="section" [(ngModel)]="form.section" required />
              </div>
            </div>

            <label>LRN</label>
            <input name="lrn" [(ngModel)]="form.lrn" />

            <label>Student ID No.</label>
            <input name="student_id_no" [(ngModel)]="form.student_id_no" />

            @if (error) { <p class="error">{{ error }}</p> }

            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;" [disabled]="saving">
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; background: rgba(11,31,58,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px;
    }
    .modal { width: 100%; max-width: 380px; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #888; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { margin-top: 12px; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
  `],
})
export class EditStudentModalComponent implements OnChanges {
  @Input() open = false;
  @Input() student: Student | null = null;
  @Input() saving = false;
  @Input() error = '';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<Student>>();

  form: Partial<Student> = { full_name: '', grade: '', section: '', lrn: '', student_id_no: '' };

  ngOnChanges() {
    if (this.student) {
      this.form = {
        full_name: this.student.full_name,
        grade: this.student.grade,
        section: this.student.section,
        lrn: this.student.lrn || '',
        student_id_no: this.student.student_id_no || '',
      };
    }
  }

  submit() {
    if (!this.form.full_name || !this.form.grade || !this.form.section) return;
    this.save.emit(this.form);
  }
}