import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/teacher-dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'register',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/register-student/register-student.component').then((m) => m.RegisterStudentComponent),
  },
  {
    path: 'scanner',
    canActivate: [authGuard],
    loadComponent: () => import('./features/scanner/scanner.component').then((m) => m.ScannerComponent),
  },
  {
    path: 'progress',
    canActivate: [authGuard],
    loadComponent: () => import('./features/progress/progress.component').then((m) => m.ProgressComponent),
  },
  {
    path: 'certificates',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/certificates/certificates.component').then((m) => m.CertificatesComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/manage-users/manage-users.component').then((m) => m.ManageUsersComponent),
  },
  { path: '**', redirectTo: 'login' },
];
