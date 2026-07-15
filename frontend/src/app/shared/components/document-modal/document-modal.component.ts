import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-document-modal',
  standalone: true,
  imports: [],
  template: `
    @if (open) {
      <div class="overlay" (click)="close.emit()">
        <div class="modal card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3 class="headline" style="font-size:1rem;">{{ title }}</h3>
            <button class="close-btn" (click)="close.emit()" aria-label="Close">✕</button>
          </div>

          <div class="modal-body">
            @if (loading) {
              <p class="placeholder">Loading…</p>
            } @else if (kind === 'image' && objectUrl) {
              <img [src]="objectUrl" alt="QR code" class="qr-preview" />
            } @else if (kind === 'pdf' && objectUrl) {
              <iframe [src]="objectUrl" class="pdf-preview"></iframe>
            } @else if (errorMessage) {
              <p class="error">{{ errorMessage }}</p>
            }
          </div>

          @if (objectUrl && !loading) {
            <button class="btn btn-gold" style="width:100%;" (click)="download.emit()">Download</button>
          }
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
    .modal { width: 100%; max-width: 480px; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; }
    .close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #888; }
    .modal-body { display: flex; align-items: center; justify-content: center; min-height: 200px; }
    .qr-preview { width: 220px; height: 220px; border: 1px solid var(--border); border-radius: 8px; }
    .pdf-preview { width: 100%; height: 55vh; border: 1px solid var(--border); border-radius: 8px; }
    .placeholder { color: #999; font-size: 0.85rem; }
    .error { color: var(--danger); font-size: 0.85rem; text-align: center; }
  `],
})
export class DocumentModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() kind: 'image' | 'pdf' | null = null;
  @Input() objectUrl: string | SafeResourceUrl | null = null;
  @Input() loading = false;
  @Input() errorMessage = '';
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<void>();
}
