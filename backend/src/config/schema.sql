-- ============================================================
-- QR Code Attendance Management System
-- School Press Conference / Journalism School Edition
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- An organization using the platform (a school, a dental clinic, etc).
-- `industry` picks which product experience the tenant's users see
-- (e.g. 'education' -> QR attendance, 'booking' -> appointment booking).
-- Validated against an app-level allow-list, not a DB CHECK, so adding a
-- new industry later doesn't require a migration.
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  industry    VARCHAR(50) NOT NULL DEFAULT 'education',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teachers / Admins who can log in and operate the scanner
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'teacher', -- teacher | admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The journalism press conference categories (per tenant)
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(100) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, name)
);

-- Students registered for the press conference
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
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
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  recorded_by   UUID REFERENCES users(id),
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, category_id, attendance_date)
);

-- Per-category ranking (1st through 10th place), used to generate
-- "Certificate of Recognition" awards distinct from the completion
-- certificate. Only one student can hold a given rank per category.
CREATE TABLE IF NOT EXISTS category_rankings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rank          INT  NOT NULL CHECK (rank BETWEEN 1 AND 10),
  control_no    VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, rank)
);

-- Named awards (e.g. "Champion", "Best News Anchor") for categories that
-- don't fit the plain 1st-10th ranking model — see
-- backend/src/config/awardSchemes.js for which categories use this and
-- which of their awards allow more than one student ("group" awards, e.g. a
-- broadcast team's "Champion") vs exactly one ("solo" awards, e.g. a single
-- role like "Best News Anchor"). Unlike category_rankings, award_label is
-- NOT unique per category — multiple rows (multiple students) can share the
-- same award_label; the API layer enforces the solo/group distinction since
-- it depends on the award, not the schema.
CREATE TABLE IF NOT EXISTS category_awards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  award_label   VARCHAR(60) NOT NULL,
  control_no    VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, award_label, student_id)
);

-- Editable, freely-positioned layout for the two certificate types
-- ("completion" and "ranking"). `elements` is an ordered array of
-- {id, type: 'text'|'shape'|'image', x, y, width, height, ...style} boxes —
-- array order is paint order. A missing row for a given tenant/key falls
-- back to hardcoded defaults in certificateTemplateDefaults.js, so existing
-- tenants keep working unchanged until an admin explicitly saves a
-- customization.
CREATE TABLE IF NOT EXISTS certificate_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  template_key    VARCHAR(20) NOT NULL, -- 'completion' | 'ranking' | 'speaker' | 'teacher'
  elements        JSONB NOT NULL DEFAULT '[]',
  orientation     VARCHAR(20) NOT NULL DEFAULT 'portrait', -- 'portrait' | 'landscape'
  paper_size      VARCHAR(20) NOT NULL DEFAULT 'short', -- 'a4' | 'short' (Letter) | 'long' (8.5x13in PH bond paper)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);

-- A single settings row per tenant holding the certificate "constants" that
-- rarely change (office/division name, signatory, current event date range
-- and venue) — used as merge-data for {{office_line}}, {{signatory_name}},
-- {{signatory_title}}, {{date_range}}, {{venue_or_school}} wherever a
-- template references them.
CREATE TABLE IF NOT EXISTS certificate_settings (
  tenant_id       UUID PRIMARY KEY REFERENCES tenants(id),
  office_line     VARCHAR(200),
  signatory_name  VARCHAR(150),
  signatory_title VARCHAR(150),
  date_range      VARCHAR(200),
  venue           VARCHAR(200),
  event_name      VARCHAR(200), -- e.g. "School Press Conference" -> {{event_name}} on ranking/speaker/teacher certificates
  custom_fields   JSONB NOT NULL DEFAULT '[]', -- [{name, value}, ...] -> {{slugified_name}}
  signatory_signature TEXT, -- base64 data URI or Cloudinary URL of the principal's e-signature image, auto-included on every certificate
  school_logo     TEXT, -- Cloudinary URL of the school logo, auto-included in place of the "Official Seal" circle
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speakers/lecturers invited to the press conference, registered the same
-- way students are and issued their own Certificate of Recognition.
CREATE TABLE IF NOT EXISTS speakers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  full_name    VARCHAR(150) NOT NULL,
  position     VARCHAR(150),
  organization VARCHAR(200),
  topic        VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teachers who participated in running the press conference (facilitator,
-- judge, coordinator, reactor, etc.), registered so they can be issued their
-- own exclusive Certificate of Appreciation.
CREATE TABLE IF NOT EXISTS teachers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  full_name    VARCHAR(150) NOT NULL,
  role         VARCHAR(150), -- e.g. "Facilitator", "Judge", "Coordinator"
  department   VARCHAR(200),
  topic        VARCHAR(200), -- session/topic they handled, if applicable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defense-in-depth: since tenant_id is denormalized onto attendance and
-- category_rankings (rather than only derived via join) for simpler/faster
-- scoped queries, this guards against a bug ever inserting a tenant_id that
-- doesn't match the referenced student's/category's actual tenant.
CREATE OR REPLACE FUNCTION enforce_tenant_consistency() RETURNS trigger AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    IF NEW.tenant_id <> (SELECT tenant_id FROM students WHERE id = NEW.student_id) THEN
      RAISE EXCEPTION 'tenant_id mismatch: row tenant % does not match student tenant', NEW.tenant_id;
    END IF;
  END IF;
  IF NEW.category_id IS NOT NULL THEN
    IF NEW.tenant_id <> (SELECT tenant_id FROM categories WHERE id = NEW.category_id) THEN
      RAISE EXCEPTION 'tenant_id mismatch: row tenant % does not match category tenant', NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_tenant_consistency ON attendance;
CREATE TRIGGER trg_attendance_tenant_consistency
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();

DROP TRIGGER IF EXISTS trg_rankings_tenant_consistency ON category_rankings;
CREATE TRIGGER trg_rankings_tenant_consistency
  BEFORE INSERT OR UPDATE ON category_rankings
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();

DROP TRIGGER IF EXISTS trg_category_awards_tenant_consistency ON category_awards;
CREATE TRIGGER trg_category_awards_tenant_consistency
  BEFORE INSERT OR UPDATE ON category_awards
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_category ON attendance(category_id);
CREATE INDEX IF NOT EXISTS idx_students_qr_token ON students(qr_token);
CREATE INDEX IF NOT EXISTS idx_rankings_category ON category_rankings(category_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rankings_tenant ON category_rankings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_category_awards_category ON category_awards(category_id);
CREATE INDEX IF NOT EXISTS idx_category_awards_tenant ON category_awards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_category_awards_student ON category_awards(student_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_tenant ON certificate_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_speakers_tenant ON speakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teachers_tenant ON teachers(tenant_id);
