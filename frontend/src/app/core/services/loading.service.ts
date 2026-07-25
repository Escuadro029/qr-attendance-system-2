import { Injectable, computed, signal } from '@angular/core';

// Tracks how many HTTP requests are currently in flight so the UI can show
// a single global "working…" indicator instead of each component wiring up
// its own loading flag. Count-based (not boolean) so overlapping requests
// don't hide the indicator the moment the *first* one finishes.
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pending = signal(0);

  isLoading = computed(() => this.pending() > 0);

  show(): void {
    this.pending.update((n) => n + 1);
  }

  hide(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }
}
