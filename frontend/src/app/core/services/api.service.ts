import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Student, Category, ProgressRow, ScanResult, AttendanceRecord, AppUser } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Users (admin only)
  getUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${this.base}/users`);
  }

  createUser(payload: { full_name: string; email: string; password: string; role: 'teacher' | 'admin' }): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.base}/users`, payload);
  }

  deleteUser(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/users/${id}`);
  }

  // Students
  registerStudent(payload: Partial<Student>): Observable<Student> {
    return this.http.post<Student>(`${this.base}/students`, payload);
  }

  getStudents(search?: string): Observable<Student[]> {
    const url = search ? `${this.base}/students?search=${encodeURIComponent(search)}` : `${this.base}/students`;
    return this.http.get<Student[]>(url);
  }

  getStudent(id: string): Observable<Student> {
    return this.http.get<Student>(`${this.base}/students/${id}`);
  }

  // These are protected endpoints (need the Authorization header), so they're
  // fetched as blobs via HttpClient (the auth interceptor attaches the JWT)
  // rather than used as plain <img src> / <a href> URLs.
  getQrCodeBlob(studentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/students/${studentId}/qrcode.png`, { responseType: 'blob' });
  }

  getIdCardBlob(studentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/students/${studentId}/id-card.pdf`, { responseType: 'blob' });
  }

  // Categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  // Attendance
  scanAttendance(qr_token: string, category_id: number): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.base}/attendance/scan`, { qr_token, category_id });
  }

  getProgress(): Observable<ProgressRow[]> {
    return this.http.get<ProgressRow[]>(`${this.base}/attendance/progress`);
  }

  getStudentHistory(studentId: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(`${this.base}/attendance/student/${studentId}`);
  }

  // Certificates
  getQualified(): Observable<{ threshold: number; qualified: ProgressRow[] }> {
    return this.http.get<{ threshold: number; qualified: ProgressRow[] }>(`${this.base}/certificates/qualified`);
  }

  getCertificateBlob(studentId: string, division?: string, dates?: string): Observable<Blob> {
    const params = new URLSearchParams();
    if (division) params.set('division', division);
    if (dates) params.set('dates', dates);
    const qs = params.toString();
    return this.http.get(`${this.base}/certificates/${studentId}.pdf${qs ? '?' + qs : ''}`, { responseType: 'blob' });
  }
}
