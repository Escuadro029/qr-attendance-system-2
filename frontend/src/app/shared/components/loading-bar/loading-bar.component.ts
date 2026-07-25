import { Component } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

// Slim top-of-page progress bar shown while any HTTP request is in flight
// (wired up globally via loadingInterceptor), so the user always gets
// feedback that the app is working instead of a frozen-looking screen.
@Component({
  selector: 'app-loading-bar',
  standalone: true,
  template: `
    @if (loading.isLoading()) {
      <div class="loading-bar" role="status" aria-live="polite" aria-label="Loading">
        <div class="loading-bar-fill"></div>
      </div>
    }
  `,
  styles: [`
    .loading-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(199, 162, 74, 0.2);
      overflow: hidden;
      z-index: 9999;
    }
    .loading-bar-fill {
      height: 100%;
      width: 40%;
      background: linear-gradient(90deg, var(--navy), var(--gold));
      animation: loading-bar-slide 1.1s ease-in-out infinite;
    }
    @keyframes loading-bar-slide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }
  `],
})
export class LoadingBarComponent {
  constructor(public loading: LoadingService) {}
}
