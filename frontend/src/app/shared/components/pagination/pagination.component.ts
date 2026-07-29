import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalPages > 1) {
      <div class="pagination">
        <button class="btn btn-outline btn-sm" (click)="go(page - 1)" [disabled]="page <= 1">Prev</button>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button class="btn btn-outline btn-sm" (click)="go(page + 1)" [disabled]="page >= totalPages">Next</button>
      </div>
    }
  `,
  styles: [`
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding-top: 16px; }
    .page-info { font-size: 0.8rem; color: #777; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  `],
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Output() pageChange = new EventEmitter<number>();

  go(page: number) {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.pageChange.emit(page);
  }
}
