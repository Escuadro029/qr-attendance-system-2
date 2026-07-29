// Mirrors the backend's slugify in certificateGenerator.js — turns a custom
// settings field's human-readable name (e.g. "Event Name") into the
// {{placeholder}} tag it resolves to (e.g. "event_name").
export function slugifyFieldName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}
