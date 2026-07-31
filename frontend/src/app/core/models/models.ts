export type RankPlace = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Ranking {
  id: string;
  category_id: number;
  category_name: string;
  student_id: string;
  student_name: string;
  grade: string;
  section: string;
  rank: RankPlace;
  control_no: string;
  created_at: string;
}

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
  tenant_id: string;
  industry: string;
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

export interface Speaker {
  id: string;
  full_name: string;
  position?: string;
  organization?: string;
  topic?: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  role?: string;
  department?: string;
  topic?: string;
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
  student_id_no?: string;
  full_name: string;
  grade: string;
  section: string;
  categories_completed: number;
  completed_categories: string[];
}

export type CertificateElementType = 'text' | 'shape' | 'image';
export type CertificateShapeKind = 'line' | 'rect' | 'ellipse';

export interface CertificateElement {
  id: string;
  type: CertificateElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  // text
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italics?: boolean;
  uppercase?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  fontFamily?: 'serif' | 'sans' | 'oldenglish' | 'trajanpro' | 'tahoma';
  // shape
  shape?: CertificateShapeKind;
  lineColor?: string;
  lineWidth?: number;
  fillColor?: string;
  cornerRadius?: number;
  // image
  source?: 'qr' | 'custom' | 'signature';
  imageData?: string; // base64 data URI, for source: 'custom' (an uploaded logo)
}

export type CertificateOrientation = 'portrait' | 'landscape';
export type CertificatePaperSize = 'a4' | 'short' | 'long';
export type CertificateKey = 'completion' | 'ranking' | 'speaker' | 'teacher';

export interface CertificateTemplate {
  template_key: CertificateKey;
  elements: CertificateElement[];
  orientation: CertificateOrientation;
  paper_size: CertificatePaperSize;
  updated_at?: string;
}

export interface CertificateCustomField {
  name: string;
  value: string;
}

export interface CertificateSettings {
  office_line?: string;
  signatory_name?: string;
  signatory_title?: string;
  date_range?: string;
  venue?: string;
  custom_fields?: CertificateCustomField[];
  signatory_signature?: string;
  updated_at?: string;
}

export interface ScanResult {
  message: string;
  student: { id: string; full_name: string; section: string };
  category: string;
  attendance: AttendanceRecord;
}