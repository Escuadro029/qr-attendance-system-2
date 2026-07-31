import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CertificateCustomField, CertificateSettings } from '../../core/models/models';
import { slugifyFieldName } from '../../core/utils/slugify';

@Component({
  selector: 'app-certificate-settings',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="container">
      <h1 class="headline">Certificate Settings</h1>
      <p class="lede">
        These values fill in the matching <code>{{ '{{placeholder}}' }}</code> tags on every certificate
        (the Certificate Designer's "Office / Division", "Signatory Name", "Signatory Title", "Date" and "Venue"
        fields). Update them here once per event instead of editing every certificate individually.
      </p>

      <form class="card" (ngSubmit)="save()">
        @if (loading()) {
          <p class="placeholder">Loading…</p>
        } @else {
          <label>Office / Division Name</label>
          <input name="office_line" [(ngModel)]="form.office_line" placeholder="e.g. Schools Division Office" />

          <label style="margin-top:12px;">Signatory Name</label>
          <input name="signatory_name" [(ngModel)]="form.signatory_name" placeholder="e.g. Juan D. Santos" />

          <label style="margin-top:12px;">Signatory Title</label>
          <input name="signatory_title" [(ngModel)]="form.signatory_title" placeholder="e.g. School Principal / Head Teacher" />

          <label style="margin-top:12px;">Date (for this event)</label>
          <input name="date_range" [(ngModel)]="form.date_range" placeholder="e.g. August 1, 8, and 15, 2026" />

          <label style="margin-top:12px;">Venue</label>
          <input name="venue" [(ngModel)]="form.venue" placeholder="e.g. the school auditorium" />

          <label style="margin-top:12px;">Principal's E-Signature</label>
          @if (form.signatory_signature) {
            <img class="signature-preview" [src]="form.signatory_signature" alt="Signature preview" />
          }
          <div class="style-row">
            <button type="button" class="btn btn-outline btn-sm" (click)="signatureInput.click()" [disabled]="uploadingSignature()">
              {{ uploadingSignature() ? 'Uploading…' : (form.signatory_signature ? 'Replace Signature' : 'Upload Signature') }}
            </button>
            @if (form.signatory_signature) {
              <button type="button" class="btn btn-outline btn-sm" (click)="removeSignature()" [disabled]="uploadingSignature()">Remove</button>
            }
          </div>
          <input #signatureInput type="file" accept="image/png,image/jpeg" hidden (change)="onSignatureFileSelected($event)" />
          <p class="hint" style="margin-top:6px;">
            Uploaded once here (to Cloudinary) and automatically included on every certificate type (completion,
            ranking, speaker/lecturer, and teacher) above the signature line — no need to add it separately in
            the Certificate Designer.
          </p>

          <div class="custom-fields-head">
            <label style="margin:0;">Custom Fields</label>
            <button type="button" class="btn btn-outline btn-sm" (click)="addCustomField()">+ Add Item</button>
          </div>
          <p class="hint" style="margin-top:0;">Add your own named values (e.g. "Event Name") to use as a placeholder in the Certificate Designer.</p>

          @for (field of form.custom_fields; track $index) {
            <div class="custom-field-row">
              <input [ngModel]="field.name" (ngModelChange)="updateCustomField($index, 'name', $event)" name="cf_name_{{ $index }}" placeholder="Name (e.g. Event Name)" />
              <input [ngModel]="field.value" (ngModelChange)="updateCustomField($index, 'value', $event)" name="cf_value_{{ $index }}" placeholder="Value" />
              <button type="button" class="remove-btn" title="Remove" (click)="removeCustomField($index)">×</button>
              @if (field.name) {
                <span class="tag-preview">{{ '{{' + slug(field.name) + '}}' }}</span>
              }
            </div>
          }

          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (success()) { <p class="success">{{ success() }}</p> }
          @if (form.updated_at) { <p class="hint">Last updated {{ form.updated_at | date: 'medium' }}</p> }

          <button type="submit" class="btn btn-primary" style="margin-top:16px;" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        }
      </form>
    </div>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 24px; max-width: 640px; }
    .lede code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; }
    .card { max-width: 520px; }
    label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 4px; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .error { color: var(--danger); font-size: 0.85rem; margin-top: 10px; }
    .success { color: var(--success); font-size: 0.85rem; margin-top: 10px; }
    .hint { color: #999; font-size: 0.78rem; margin-top: 10px; }
    .custom-fields-head { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; }
    .btn-sm { padding: 5px 10px; font-size: 0.78rem; }
    .custom-field-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .custom-field-row input { flex: 1; min-width: 120px; }
    .remove-btn {
      width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--border); background: #fff;
      color: var(--danger); cursor: pointer; font-size: 0.9rem; line-height: 1; flex-shrink: 0;
    }
    .tag-preview { font-family: monospace; font-size: 0.72rem; color: var(--navy); background: rgba(31,41,61,0.06); padding: 2px 6px; border-radius: 999px; white-space: nowrap; }
    .style-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .signature-preview { display: block; max-width: 220px; max-height: 80px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: 4px; background: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 6px, #fff 6px, #fff 12px); }
  `],
})
export class CertificateSettingsComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  uploadingSignature = signal(false);
  error = signal('');
  success = signal('');
  form: CertificateSettings = { custom_fields: [] };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  slug(name: string): string {
    return slugifyFieldName(name);
  }

  load() {
    this.loading.set(true);
    this.api.getCertificateSettings().subscribe({
      next: (settings) => (this.form = { ...settings, custom_fields: settings.custom_fields || [] }),
      error: () => this.error.set('Could not load certificate settings.'),
      complete: () => this.loading.set(false),
    });
  }

  addCustomField() {
    this.form.custom_fields = [...(this.form.custom_fields || []), { name: '', value: '' }];
  }

  updateCustomField(index: number, key: keyof CertificateCustomField, value: string) {
    const fields = [...(this.form.custom_fields || [])];
    fields[index] = { ...fields[index], [key]: value };
    this.form.custom_fields = fields;
  }

  removeCustomField(index: number) {
    this.form.custom_fields = (this.form.custom_fields || []).filter((_, i) => i !== index);
  }

  async onSignatureFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.error.set('Signature must be a PNG or JPEG image.');
      return;
    }

    this.uploadingSignature.set(true);
    this.error.set('');
    try {
      const resizedDataUri = await this.resizeSignatureFile(file);
      const { url } = await firstValueFrom(this.api.uploadImage(resizedDataUri, 'certificate-signatures'));
      this.form.signatory_signature = url;
    } catch {
      this.error.set('Could not upload that image. Please try again.');
    } finally {
      this.uploadingSignature.set(false);
    }
  }

  removeSignature() {
    this.form.signatory_signature = undefined;
  }

  // Downscales the upload client-side so a saved signature stays small — a
  // signature scan is a horizontal image, so only the wider dimension is
  // capped (unlike the Designer's logo upload, this isn't cropped to a
  // circle: a signature must keep its natural rectangular shape).
  private resizeSignatureFile(file: File, maxWidth = 400): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxWidth / image.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          // PNG preserves transparency, which most signature scans rely on.
          resolve(canvas.toDataURL('image/png'));
        };
        image.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    const payload: CertificateSettings = {
      ...this.form,
      custom_fields: (this.form.custom_fields || []).filter((f) => f.name.trim()),
    };
    this.api.saveCertificateSettings(payload).subscribe({
      next: (settings) => {
        this.form = { ...settings, custom_fields: settings.custom_fields || [] };
        this.success.set('Settings saved.');
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to save settings.'),
      complete: () => this.saving.set(false),
    });
  }
}
