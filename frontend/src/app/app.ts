import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MastheadComponent } from './shared/components/masthead/masthead.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MastheadComponent],
  template: `
    <app-masthead></app-masthead>
    <router-outlet></router-outlet>
  `,
})
export class App {}
