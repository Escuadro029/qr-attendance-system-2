-- ============================================================
-- QR Code Attendance Management System
-- School Press Conference / Journalism School Edition
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teachers / Admins who can log in and operate the scanner
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'teacher', -- teacher | admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The 9 journalism press conference categories
CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Students registered for the press conference
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     VARCHAR(150) NOT NULL,
  grade         VARCHAR(20)  NOT NULL,       -- e.g. "10"
  section       VARCHAR(50)  NOT NULL,       -- e.g. "Rizal"
  lrn           VARCHAR(20),                 -- DepEd Learner Reference Number (optional)
  student_id_no VARCHAR(50),                 -- optional school ID number
  school_name   VARCHAR(200) NOT NULL DEFAULT 'Your School Name',
  photo_url     TEXT,
  qr_token      UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE, -- what the QR encodes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (student, category, date) scan
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  recorded_by   UUID REFERENCES users(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, category_id, attendance_date)
);

-- Per-category ranking (1st / 2nd / 3rd place), used to generate
-- "Certificate of Recognition" awards distinct from the completion
-- certificate. Only one student can hold a given rank per category.
CREATE TABLE IF NOT EXISTS category_rankings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rank          INT  NOT NULL CHECK (rank IN (1, 2, 3)),
  control_no    VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, rank)
);


CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_category ON attendance(category_id);
CREATE INDEX IF NOT EXISTS idx_students_qr_token ON students(qr_token);
CREATE INDEX IF NOT EXISTS idx_rankings_category ON category_rankings(category_id);
