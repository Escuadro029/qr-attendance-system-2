export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: 'teacher' | 'admin';
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
  full_name: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Student {
  id: string;
  full_name: string;
  grade: string;
  section: string;
  lrn?: string;
  student_id_no?: string;
  school_name: string;
  photo_url?: string;
  qr_token: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  category_id: number;
  category_name?: string;
  attendance_date: string;
  recorded_at: string;
}

export interface ProgressRow {
  student_id: string;
  full_name: string;
  grade: string;
  section: string;
  categories_completed: number;
}

export interface ScanResult {
  message: string;
  student: { id: string; full_name: string; section: string };
  category: string;
  attendance: AttendanceRecord;
}
