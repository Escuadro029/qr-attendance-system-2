import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MastheadComponent } from './shared/components/masthead/masthead.component';
import { LoadingBarComponent } from './shared/components/loading-bar/loading-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MastheadComponent, LoadingBarComponent],
  template: `
    <app-loading-bar></app-loading-bar>
    <app-masthead></app-masthead>
    <router-outlet></router-outlet>
  `,
})
export class App {}
