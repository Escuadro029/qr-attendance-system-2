import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { CertificateElement, CertificateKey, CertificateOrientation, CertificateTemplate } from '../../core/models/models';
import { DocumentModalComponent } from '../../shared/components/document-modal/document-modal.component';
import { slugifyFieldName } from '../../core/utils/slugify';

const SCALE = 0.72;
const MIN_SIZE = 10;
const PAGE_DIMS: Record<CertificateOrientation, { width: number; height: number }> = {
  portrait: { width: 612, height: 792 },
  landscape: { width: 792, height: 612 },
};

// Switching orientation swaps the page's aspect ratio — proportionally
// rescaling every element keeps the layout in bounds (otherwise elements
// authored for a 792-tall portrait page would spill onto a second page
// once the physical page height shrinks to 612 in landscape).
function rescaleElements(elements: CertificateElement[], from: CertificateOrientation, to: CertificateOrientation): CertificateElement[] {
  const sx = PAGE_DIMS[to].width / PAGE_DIMS[from].width;
  const sy = PAGE_DIMS[to].height / PAGE_DIMS[from].height;
  return elements.map((el) => ({
    ...el,
    x: Math.round(el.x * sx),
    y: Math.round(el.y * sy),
    width: Math.round(el.width * sx),
    height: Math.round(el.height * sy),
    fontSize: el.fontSize ? Math.max(4, Math.round(el.fontSize * sy)) : el.fontSize,
  }));
}

const COMMON_FIELDS: { tag: string; label: string }[] = [
  { tag: '{{full_name}}', label: 'Name' },
  { tag: '{{date_range}}', label: 'Date' },
  { tag: '{{venue_or_school}}', label: 'Venue' },
  { tag: '{{office_line}}', label: 'Office / Division' },
  { tag: '{{signatory_name}}', label: 'Signatory Name' },
  { tag: '{{signatory_title}}', label: 'Signatory Title' },
  { tag: '{{control_no}}', label: 'Control No.' },
];

const STUDENT_FIELDS = [
  { tag: '{{grade}}', label: 'Grade' },
  { tag: '{{section}}', label: 'Section' },
  { tag: '{{school_name}}', label: 'School Name' },
];

const TYPE_FIELDS: Record<CertificateKey, { tag: string; label: string }[]> = {
  completion: [...STUDENT_FIELDS, { tag: '{{categories_completed}}', label: 'Category Count' }],
  ranking: [
    ...STUDENT_FIELDS,
    { tag: '{{category_name}}', label: 'Category Name' },
    { tag: '{{rank_word}}', label: 'Rank' },
    { tag: '{{event_name}}', label: 'Event Name' },
  ],
  speaker: [
    { tag: '{{position}}', label: 'Position' },
    { tag: '{{organization}}', label: 'Organization' },
    { tag: '{{position_line}}', label: 'Position, Organization' },
    { tag: '{{topic}}', label: 'Topic' },
    { tag: '{{event_name}}', label: 'Event Name' },
  ],
  teacher: [
    { tag: '{{role}}', label: 'Role' },
    { tag: '{{department}}', label: 'Department' },
    { tag: '{{role_line}}', label: 'Role, Department' },
    { tag: '{{topic}}', label: 'Topic' },
    { tag: '{{event_name}}', label: 'Event Name' },
  ],
};

let nextId = 0;

@Component({
  selector: 'app-certificate-template',
  standalone: true,
  imports: [FormsModule, RouterLink, DocumentModalComponent],
  template: `
    <div class="container">
      <h1 class="headline">Certificate Designer</h1>
      <p class="lede">Drag and resize anything on the certificate, like a slide. Click an element to edit its text and style.</p>
      <p class="lede">The Office/Division, Signatory, Date and Venue fields pull their values from <a routerLink="/certificate-settings">Certificate Settings</a> — update them there once per event.</p>

      <div class="type-tabs">
        <button class="btn" [class.btn-gold]="key() === 'completion'" [class.btn-outline]="key() !== 'completion'" (click)="selectKey('completion')">Completion Certificate</button>
        <button class="btn" [class.btn-gold]="key() === 'ranking'" [class.btn-outline]="key() !== 'ranking'" (click)="selectKey('ranking')">Ranking Certificate</button>
        <button class="btn" [class.btn-gold]="key() === 'speaker'" [class.btn-outline]="key() !== 'speaker'" (click)="selectKey('speaker')">Speaker/Lecturer Certificate</button>
        <button class="btn" [class.btn-gold]="key() === 'teacher'" [class.btn-outline]="key() !== 'teacher'" (click)="selectKey('teacher')">Teacher Certificate</button>
      </div>

      <div class="toolbar">
        <div class="orientation-toggle">
          <button class="chip-btn" [class.active]="orientation() === 'portrait'" (click)="setOrientation('portrait')">Portrait</button>
          <button class="chip-btn" [class.active]="orientation() === 'landscape'" (click)="setOrientation('landscape')">Landscape</button>
        </div>
        <button class="btn btn-outline btn-sm" (click)="addTextBox()">+ Add Text Box</button>
        <button class="btn btn-outline btn-sm" (click)="addLogo()">+ Add Logo</button>
        <button class="btn btn-outline btn-sm" (click)="bringForward()" [disabled]="!selectedEl()">Bring Forward</button>
        <button class="btn btn-outline btn-sm" (click)="sendBackward()" [disabled]="!selectedEl()">Send Backward</button>
        <button class="btn btn-outline btn-sm" (click)="deleteSelected()" [disabled]="!selectedEl()">Delete</button>
        <button class="btn btn-outline btn-sm" (click)="resetToDefault()">Reset to Default Layout</button>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" (click)="preview()" [disabled]="previewing() || loading()">
          {{ previewing() ? 'Preparing…' : 'Preview' }}
        </button>
        <button class="btn btn-primary btn-sm" (click)="save()" [disabled]="saving() || loading()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>

      <input #logoInput type="file" accept="image/png,image/jpeg" hidden (change)="onLogoFileSelected($event)" />

      @if (error()) { <p class="error">{{ error() }}</p> }
      @if (success()) { <p class="success">{{ success() }}</p> }

      @if (loading()) {
        <p class="placeholder">Loading…</p>
      } @else {
        <div class="designer">
          <div class="canvas-wrap">
            <div class="page-canvas" [style.width.px]="pageWidth() * SCALE" [style.height.px]="pageHeight() * SCALE" (mousedown)="selectedId.set(null)">
              @for (el of elements(); track el.id) {
                <div
                  class="el-box"
                  [class.selected]="selectedId() === el.id"
                  [style.left.px]="el.x * SCALE"
                  [style.top.px]="el.y * SCALE"
                  [style.width.px]="el.width * SCALE"
                  [style.height.px]="Math.max(el.height * SCALE, 6)"
                  (mousedown)="startDrag($event, el)"
                >
                  @switch (el.type) {
                    @case ('text') {
                      <div class="el-text"
                        [style.font-family]="fontFamilyCss(el.fontFamily)"
                        [style.font-size.px]="(el.fontSize || 11) * SCALE"
                        [style.font-weight]="el.bold ? 700 : 400"
                        [style.font-style]="el.italics ? 'italic' : 'normal'"
                        [style.text-align]="el.align || 'left'"
                        [style.color]="el.color || '#2D3748'"
                        [style.text-transform]="el.uppercase ? 'uppercase' : 'none'"
                      >{{ el.text }}</div>
                    }
                    @case ('shape') {
                      @if (el.shape === 'line') {
                        <div class="el-line" [style.background]="el.lineColor || '#000'" [style.height.px]="Math.max((el.lineWidth || 1), 1)"></div>
                      } @else {
                        <div class="el-shape"
                          [class.ellipse]="el.shape === 'ellipse'"
                          [style.border-width.px]="el.lineColor ? Math.max((el.lineWidth||1),1) : 0"
                          [style.border-color]="el.lineColor || 'transparent'"
                          [style.border-radius.px]="el.shape === 'ellipse' ? 999 : (el.cornerRadius || 0)"
                          [style.background]="el.fillColor || 'transparent'"
                        ></div>
                      }
                    }
                    @case ('image') {
                      @if (el.imageData) {
                        <img class="el-image" [src]="el.imageData" alt="" />
                      } @else if (el.source === 'qr') {
                        <div class="el-qr">QR CODE</div>
                      } @else {
                        <div class="el-qr">LOGO</div>
                      }
                    }
                  }
                  @if (selectedId() === el.id) {
                    <div class="resize-handle" (mousedown)="startResize($event, el)"></div>
                    <button type="button" class="delete-handle" title="Delete" (mousedown)="$event.stopPropagation()" (click)="deleteSelected()">×</button>
                  }
                </div>
              }
            </div>
          </div>

          <div class="card properties">
            @if (selectedEl(); as el) {
              <h3 class="headline" style="font-size:0.95rem; margin-bottom:10px;">
                {{ el.type === 'text' ? 'Text' : el.type === 'shape' ? 'Shape' : 'Image' }}
              </h3>

              <div class="pos-grid">
                <label>X <input type="number" [ngModel]="round(el.x)" (ngModelChange)="updateElement(el.id, { x: $event })" /></label>
                <label>Y <input type="number" [ngModel]="round(el.y)" (ngModelChange)="updateElement(el.id, { y: $event })" /></label>
                <label>Width <input type="number" [ngModel]="round(el.width)" (ngModelChange)="updateElement(el.id, { width: $event })" /></label>
                <label>Height <input type="number" [ngModel]="round(el.height)" (ngModelChange)="updateElement(el.id, { height: $event })" /></label>
              </div>

              @if (el.type === 'text') {
                <label class="block-label">Insert a field</label>
                <div class="field-chips">
                  @for (f of fields(); track f.tag) {
                    <button type="button" class="chip-btn" (click)="insertField(f.tag)">{{ f.label }}</button>
                  }
                </div>

                <label class="block-label">Text</label>
                <textarea #textArea rows="4" [ngModel]="el.text" (ngModelChange)="updateElement(el.id, { text: $event })"></textarea>
                <button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" (click)="wrapBold()">Bold selected text</button>

                <div class="style-row">
                  <label>Size <input type="number" min="4" [ngModel]="el.fontSize || 11" (ngModelChange)="updateElement(el.id, { fontSize: $event })" /></label>
                  <button type="button" class="chip-btn" [class.active]="el.bold" (click)="updateElement(el.id, { bold: !el.bold })">Bold</button>
                  <button type="button" class="chip-btn" [class.active]="el.italics" (click)="updateElement(el.id, { italics: !el.italics })">Italic</button>
                  <button type="button" class="chip-btn" [class.active]="el.uppercase" (click)="updateElement(el.id, { uppercase: !el.uppercase })">CAPS</button>
                </div>
                <div class="style-row">
                  @for (a of aligns; track a) {
                    <button type="button" class="chip-btn" [class.active]="(el.align || 'left') === a" (click)="updateElement(el.id, { align: a })">{{ a }}</button>
                  }
                </div>
                <div class="style-row">
                  <button type="button" class="chip-btn" [class.active]="!el.fontFamily || el.fontFamily === 'sans'" (click)="updateElement(el.id, { fontFamily: 'sans' })">Sans</button>
                  <button type="button" class="chip-btn" [class.active]="el.fontFamily === 'serif'" (click)="updateElement(el.id, { fontFamily: 'serif' })">Serif</button>
                  <button type="button" class="chip-btn" [class.active]="el.fontFamily === 'oldenglish'" (click)="updateElement(el.id, { fontFamily: 'oldenglish' })">Old English</button>
                  <label class="color-label">Color <input type="color" [ngModel]="el.color || '#2D3748'" (ngModelChange)="updateElement(el.id, { color: $event })" /></label>
                </div>
              }

              @if (el.type === 'shape') {
                <div class="style-row">
                  <label class="color-label">Line color <input type="color" [ngModel]="el.lineColor || '#000000'" (ngModelChange)="updateElement(el.id, { lineColor: $event })" /></label>
                  <label>Line width <input type="number" min="0" step="0.25" [ngModel]="el.lineWidth || 1" (ngModelChange)="updateElement(el.id, { lineWidth: $event })" /></label>
                </div>
                @if (el.shape !== 'line') {
                  <div class="style-row">
                    <label class="color-label">Fill color <input type="color" [ngModel]="el.fillColor || '#ffffff'" (ngModelChange)="updateElement(el.id, { fillColor: $event })" />
                      <button type="button" class="chip-btn" (click)="updateElement(el.id, { fillColor: undefined })">No fill</button>
                    </label>
                  </div>
                  @if (el.shape === 'rect') {
                    <label>Corner radius <input type="number" min="0" [ngModel]="el.cornerRadius || 0" (ngModelChange)="updateElement(el.id, { cornerRadius: $event })" /></label>
                  }
                }
              }

              @if (el.type === 'image') {
                @if (el.source === 'qr') {
                  <p class="hint">This is the student's QR code — generated automatically, but you can move and resize it.</p>
                } @else {
                  @if (el.imageData) {
                    <img class="logo-preview" [src]="el.imageData" alt="" />
                  }
                  <div class="style-row">
                    <button type="button" class="btn btn-outline btn-sm" (click)="triggerReplaceImage(el.id)">{{ el.imageData ? 'Replace Image' : 'Upload Image' }}</button>
                    @if (el.imageData) {
                      <button type="button" class="btn btn-outline btn-sm" (click)="removeImage(el.id)">Remove Image</button>
                    }
                  </div>
                  <p class="hint">PNG or JPEG, resized automatically to keep the file small.</p>
                }
              }
            } @else {
              <p class="placeholder">Click an element on the certificate to edit it.</p>
            }
          </div>
        </div>
      }
    </div>

    <app-document-modal
      [open]="modalOpen()"
      [title]="'Certificate Preview'"
      [kind]="'pdf'"
      [objectUrl]="modalUrl()"
      [loading]="modalLoading()"
      [errorMessage]="modalError()"
      (close)="closeModal()"
      (download)="downloadPreview()"
    ></app-document-modal>
  `,
  styles: [`
    .lede { color: #666; margin: 6px 0 20px; }
    .type-tabs { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .orientation-toggle { display: flex; gap: 4px; margin-right: 8px; padding-right: 8px; border-right: 1px solid var(--border); }
    .spacer { flex: 1; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
    .placeholder { color: #999; font-size: 0.85rem; text-align: center; padding: 20px 0; }
    .error { color: var(--danger); font-size: 0.85rem; margin-bottom: 10px; }
    .success { color: var(--success); font-size: 0.85rem; margin-bottom: 10px; }

    .designer { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
    .canvas-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: #f0f0f0; padding: 16px; }
    .page-canvas { position: relative; background: #fff; box-shadow: var(--shadow); margin: 0 auto; }

    .el-box { position: absolute; box-sizing: border-box; border: 1px dashed transparent; cursor: move; overflow: hidden; user-select: none; }
    .el-box:hover { border-color: rgba(43,108,176,0.6); }
    .el-box.selected { border: 1px solid var(--navy); box-shadow: 0 0 0 2px rgba(43,108,176,0.25); }
    .el-text { width: 100%; height: 100%; white-space: pre-wrap; overflow: hidden; line-height: 1.25; }
    .el-line { width: 100%; margin-top: auto; margin-bottom: auto; }
    .el-shape { width: 100%; height: 100%; box-sizing: border-box; border-style: solid; }
    .el-shape.ellipse { border-radius: 50% !important; }
    .el-qr { width: 100%; height: 100%; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: #999; background: repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 4px, #fff 4px, #fff 8px); }
    .el-image { width: 100%; height: 100%; object-fit: contain; }
    .logo-preview { display: block; max-width: 100%; max-height: 90px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: 4px; }
    .resize-handle { position: absolute; right: -4px; bottom: -4px; width: 10px; height: 10px; background: var(--navy); border-radius: 2px; cursor: nwse-resize; }
    .delete-handle {
      position: absolute; right: -8px; top: -8px; width: 18px; height: 18px; padding: 0;
      background: var(--danger); color: #fff; border: 2px solid #fff; border-radius: 50%;
      font-size: 12px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }

    .properties { position: sticky; top: 12px; }
    .pos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .pos-grid label, .style-row label { font-size: 0.72rem; color: #777; display: flex; flex-direction: column; gap: 2px; }
    .pos-grid input, .style-row input[type="number"] { width: 100%; padding: 5px 6px; font-size: 0.85rem; }
    .block-label { display: block; font-size: 0.75rem; font-weight: 600; color: #777; margin: 10px 0 6px; }
    textarea { width: 100%; font-family: inherit; font-size: 0.85rem; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; resize: vertical; }
    .field-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip-btn {
      border: 1px solid var(--border); background: #fff; border-radius: 999px;
      font-size: 0.7rem; padding: 4px 9px; cursor: pointer; color: var(--navy);
    }
    .chip-btn.active { background: var(--navy); color: #fff; border-color: var(--navy); }
    .style-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .color-label { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: #777; }
    .hint { font-size: 0.8rem; color: #999; }
    @media (max-width: 900px) { .designer { grid-template-columns: 1fr; } .properties { position: static; } }
  `],
})
export class CertificateTemplateComponent implements OnInit, OnDestroy {
  readonly SCALE = SCALE;
  readonly Math = Math;
  readonly aligns: Array<'left' | 'center' | 'right' | 'justify'> = ['left', 'center', 'right', 'justify'];

  @ViewChild('textArea') textAreaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('logoInput') logoInputRef?: ElementRef<HTMLInputElement>;
  private pendingLogoElementId: string | null = null;

  key = signal<CertificateKey>('completion');
  loading = signal(true);
  saving = signal(false);
  previewing = signal(false);
  error = signal('');
  success = signal('');
  elements = signal<CertificateElement[]>([]);
  orientation = signal<CertificateOrientation>('portrait');
  selectedId = signal<string | null>(null);
  customFields = signal<{ tag: string; label: string }[]>([]);

  modalOpen = signal(false);
  modalUrl = signal<string | SafeResourceUrl | null>(null);
  modalLoading = signal(false);
  modalError = signal('');
  private previewRawUrl: string | null = null;
  private previewBlob: Blob | null = null;

  private dragState: { id: string; startX: number; startY: number; origX: number; origY: number } | null = null;
  private resizeState: { id: string; startX: number; startY: number; origW: number; origH: number } | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.load();
    document.addEventListener('keydown', this.onKeyDown);
    this.api.getCertificateSettings().subscribe({
      next: (settings) => {
        this.customFields.set(
          (settings.custom_fields || [])
            .filter((f) => f.name.trim())
            .map((f) => ({ tag: `{{${slugifyFieldName(f.name)}}}`, label: f.name }))
        );
      },
    });
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    document.removeEventListener('keydown', this.onKeyDown);
    this.revokePreview();
  }

  // Delete/Backspace deletes the selected element — but not while the
  // teacher is actually typing in the text/number fields in the properties
  // panel, where Backspace must edit the field instead.
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (!this.selectedEl()) return;
    event.preventDefault();
    this.deleteSelected();
  };

  round(n: number): number {
    return Math.round(n);
  }

  fontFamilyCss(fontFamily: CertificateElement['fontFamily']): string {
    if (fontFamily === 'serif') return 'var(--font-headline)';
    if (fontFamily === 'oldenglish') return 'var(--font-oldenglish)';
    return 'var(--font-ui)';
  }

  pageWidth(): number {
    return PAGE_DIMS[this.orientation()].width;
  }

  pageHeight(): number {
    return PAGE_DIMS[this.orientation()].height;
  }

  setOrientation(next: CertificateOrientation) {
    if (next === this.orientation()) return;
    this.elements.set(rescaleElements(this.elements(), this.orientation(), next));
    this.orientation.set(next);
    this.selectedId.set(null);
  }

  fields() {
    return [...TYPE_FIELDS[this.key()], ...COMMON_FIELDS, ...this.customFields()];
  }

  selectedEl(): CertificateElement | null {
    const id = this.selectedId();
    return id ? this.elements().find((e) => e.id === id) || null : null;
  }

  selectKey(key: CertificateKey) {
    if (key === this.key()) return;
    this.key.set(key);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.selectedId.set(null);
    this.api.getCertificateTemplate(this.key()).subscribe({
      next: (tpl: CertificateTemplate) => {
        this.elements.set(tpl.elements);
        this.orientation.set(tpl.orientation || 'portrait');
      },
      error: () => this.error.set('Could not load the certificate template.'),
      complete: () => this.loading.set(false),
    });
  }

  updateElement(id: string, patch: Partial<CertificateElement>) {
    this.elements.set(this.elements().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  addTextBox() {
    const id = `text_${Date.now()}_${nextId++}`;
    const el: CertificateElement = {
      id, type: 'text', x: 200, y: 400, width: 200, height: 20,
      text: 'New text', fontSize: 12, align: 'left', fontFamily: 'sans', color: '#2D3748',
    };
    this.elements.set([...this.elements(), el]);
    this.selectedId.set(id);
  }

  addLogo() {
    const id = `logo_${Date.now()}_${nextId++}`;
    const el: CertificateElement = { id, type: 'image', source: 'custom', x: 40, y: 40, width: 70, height: 70 };
    this.elements.set([...this.elements(), el]);
    this.selectedId.set(id);
    this.triggerReplaceImage(id);
  }

  triggerReplaceImage(id: string) {
    this.pendingLogoElementId = id;
    this.logoInputRef?.nativeElement.click();
  }

  async onLogoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-selecting the same file again later
    const id = this.pendingLogoElementId;
    this.pendingLogoElementId = null;
    if (!file || !id) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.error.set('Logo must be a PNG or JPEG image.');
      return;
    }

    try {
      const imageData = await this.resizeImageFile(file);
      this.updateElement(id, { source: 'custom', imageData });
    } catch {
      this.error.set('Could not read that image file.');
    }
  }

  removeImage(id: string) {
    this.updateElement(id, { imageData: undefined });
  }

  // Downscales/recompresses the upload client-side so a saved template stays
  // small — logos are typically simple graphics, not photos, so a modest
  // max dimension keeps them crisp while bounding the stored data URI size.
  private resizeImageFile(file: File, maxDim = 300, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          // PNG preserves transparency, which most logos rely on.
          const isPng = file.type === 'image/png';
          resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality));
        };
        image.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  bringForward() {
    const id = this.selectedId();
    if (!id) return;
    const arr = [...this.elements()];
    const i = arr.findIndex((e) => e.id === id);
    if (i < 0 || i === arr.length - 1) return;
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    this.elements.set(arr);
  }

  sendBackward() {
    const id = this.selectedId();
    if (!id) return;
    const arr = [...this.elements()];
    const i = arr.findIndex((e) => e.id === id);
    if (i <= 0) return;
    [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    this.elements.set(arr);
  }

  deleteSelected() {
    const id = this.selectedId();
    if (!id) return;
    this.elements.set(this.elements().filter((e) => e.id !== id));
    this.selectedId.set(null);
  }

  resetToDefault() {
    if (!confirm('Reset to the default layout? This discards your current unsaved changes.')) return;
    this.api.getCertificateTemplateDefaults(this.key()).subscribe({
      next: (tpl: CertificateTemplate) => {
        this.elements.set(tpl.elements);
        this.orientation.set(tpl.orientation || 'portrait');
        this.selectedId.set(null);
      },
      error: () => this.error.set('Could not load the default layout.'),
    });
  }

  insertField(tag: string) {
    const el = this.selectedEl();
    if (!el || el.type !== 'text') return;
    const textarea = this.textAreaRef?.nativeElement;
    const current = el.text || '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + tag + current.slice(end);
    this.updateElement(el.id, { text: next });
    const caret = start + tag.length;
    setTimeout(() => textarea?.setSelectionRange(caret, caret));
  }

  wrapBold() {
    const el = this.selectedEl();
    const textarea = this.textAreaRef?.nativeElement;
    if (!el || el.type !== 'text' || !textarea) return;
    const current = el.text || '';
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) return;
    const next = `${current.slice(0, start)}**${current.slice(start, end)}**${current.slice(end)}`;
    this.updateElement(el.id, { text: next });
  }

  // ---- Drag ----

  startDrag(event: MouseEvent, el: CertificateElement) {
    event.stopPropagation();
    this.selectedId.set(el.id);
    this.dragState = { id: el.id, startX: event.clientX, startY: event.clientY, origX: el.x, origY: el.y };
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }

  private onDragMove = (event: MouseEvent) => {
    if (!this.dragState) return;
    const dx = (event.clientX - this.dragState.startX) / SCALE;
    const dy = (event.clientY - this.dragState.startY) / SCALE;
    this.updateElement(this.dragState.id, {
      x: Math.round(this.dragState.origX + dx),
      y: Math.round(this.dragState.origY + dy),
    });
  };

  private onDragEnd = () => {
    this.dragState = null;
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  // ---- Resize ----

  startResize(event: MouseEvent, el: CertificateElement) {
    event.stopPropagation();
    this.selectedId.set(el.id);
    this.resizeState = { id: el.id, startX: event.clientX, startY: event.clientY, origW: el.width, origH: el.height };
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (event: MouseEvent) => {
    if (!this.resizeState) return;
    const dx = (event.clientX - this.resizeState.startX) / SCALE;
    const dy = (event.clientY - this.resizeState.startY) / SCALE;
    this.updateElement(this.resizeState.id, {
      width: Math.max(MIN_SIZE, Math.round(this.resizeState.origW + dx)),
      height: Math.max(0, Math.round(this.resizeState.origH + dy)),
    });
  };

  private onResizeEnd = () => {
    this.resizeState = null;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  // ---- Save / Preview ----

  save() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.api.saveCertificateTemplate(this.key(), { elements: this.elements(), orientation: this.orientation() }).subscribe({
      next: (tpl: CertificateTemplate) => {
        this.elements.set(tpl.elements);
        this.orientation.set(tpl.orientation || 'portrait');
        this.success.set('Template saved.');
      },
      error: (err) => this.error.set(err?.error?.error || 'Failed to save template.'),
      complete: () => this.saving.set(false),
    });
  }

  preview() {
    this.previewing.set(true);
    this.modalError.set('');
    this.modalUrl.set(null);
    this.modalLoading.set(true);
    this.modalOpen.set(true);
    this.revokePreview();
    this.api.previewCertificateTemplateBlob(this.key(), { elements: this.elements(), orientation: this.orientation() }).subscribe({
      next: (blob) => {
        this.previewBlob = blob;
        const url = URL.createObjectURL(blob);
        this.previewRawUrl = url;
        this.modalUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      },
      error: () => this.modalError.set('Could not render a preview with the current layout.'),
      complete: () => {
        this.modalLoading.set(false);
        this.previewing.set(false);
      },
    });
  }

  downloadPreview() {
    if (!this.previewBlob) return;
    const url = URL.createObjectURL(this.previewBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${this.key()}-preview.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.revokePreview();
  }

  private revokePreview() {
    if (this.previewRawUrl) {
      URL.revokeObjectURL(this.previewRawUrl);
      this.previewRawUrl = null;
    }
    this.previewBlob = null;
  }
}
