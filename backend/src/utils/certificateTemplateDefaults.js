// Fallback layout used whenever a tenant hasn't saved a customization yet
// for a given certificate_templates.template_key. Ported 1:1 from the
// coordinates that used to be hardcoded directly in certificateGenerator.js,
// so the default look is unchanged now that layout is data-driven.
//
// Every element is a positioned box ({x, y, width, height}, PDF points,
// top-left origin) so the frontend's drag/resize editor can treat
// text/shape/image elements uniformly. Array order is paint order.
// `orientation` ('portrait' | 'landscape') is a page-level setting, separate
// from the elements — LETTER is 612x792 in portrait, 792x612 in landscape.

const NAVY = '#0B1F3A';
const INK = '#1A1A1A';
const RED = '#C23B3B';
const GRAY = '#666666';

// Shared frame elements common to both certificate types — everything
// except the title and body paragraph, which differ per type below.
const FRAME_ELEMENTS = [
  { id: 'seal_circle', type: 'shape', shape: 'ellipse', x: 280, y: 29, width: 52, height: 52, lineColor: NAVY, lineWidth: 1.2 },
  { id: 'seal_label', type: 'text', x: 280, y: 47, width: 52, height: 20, text: 'OFFICIAL\nSEAL', fontSize: 6, bold: true, color: NAVY, align: 'center', fontFamily: 'sans' },

  { id: 'republic_line', type: 'text', x: 0, y: 90, width: 612, height: 14, text: 'Republic of the Philippines', fontSize: 10, color: INK, align: 'center', fontFamily: 'serif' },
  { id: 'dept_line', type: 'text', x: 0, y: 103, width: 612, height: 20, text: 'Department of Education', fontSize: 15, bold: true, italics: true, color: INK, align: 'center', fontFamily: 'serif' },
  { id: 'office_line', type: 'text', x: 0, y: 124, width: 612, height: 14, text: '{{office_line}}', fontSize: 9, bold: true, uppercase: true, color: INK, align: 'center', fontFamily: 'sans' },

  { id: 'header_divider', type: 'shape', shape: 'line', x: 60, y: 140, width: 492, height: 0, lineColor: '#999999', lineWidth: 1 },

  { id: 'awarded_to', type: 'text', x: 0, y: 200, width: 612, height: 16, text: 'is awarded to', fontSize: 11, color: INK, align: 'center', fontFamily: 'sans' },
  { id: 'awardee_name', type: 'text', x: 0, y: 218, width: 612, height: 30, text: '{{full_name}}', fontSize: 22, bold: true, color: NAVY, align: 'center', fontFamily: 'serif' },
  { id: 'name_underline', type: 'shape', shape: 'line', x: 216, y: 246, width: 180, height: 0, lineColor: INK, lineWidth: 0.75 },
  { id: 'school_line', type: 'text', x: 80, y: 254, width: 452, height: 16, text: 'Grade {{grade}} - {{section}}, {{school_name}}', fontSize: 10.5, italics: true, color: INK, align: 'center', fontFamily: 'sans' },

  { id: 'given_line', type: 'text', x: 90, y: 362, width: 432, height: 16, text: 'Given this day at {{venue_or_school}}.', fontSize: 10.5, color: INK, align: 'center', fontFamily: 'sans' },

  { id: 'signature_line', type: 'shape', shape: 'line', x: 166, y: 642, width: 280, height: 0, lineColor: INK, lineWidth: 0.75 },
  { id: 'signatory_name', type: 'text', x: 0, y: 646, width: 612, height: 16, text: '{{signatory_name}}', fontSize: 10.5, bold: true, uppercase: true, color: INK, align: 'center', fontFamily: 'sans' },
  { id: 'signatory_title', type: 'text', x: 0, y: 660, width: 612, height: 14, text: '{{signatory_title}}', fontSize: 9, italics: true, color: GRAY, align: 'center', fontFamily: 'sans' },

  { id: 'footer_divider', type: 'shape', shape: 'line', x: 30, y: 744, width: 552, height: 0, lineColor: '#cccccc', lineWidth: 0.5 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `logo_${i + 1}`, type: 'shape', shape: 'rect', x: 34 + i * 34, y: 750, width: 26, height: 26, cornerRadius: 3, lineColor: '#bbbbbb', lineWidth: 0.75,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `logo_${i + 1}_label`, type: 'text', x: 34 + i * 34, y: 761, width: 26, height: 10, text: 'LOGO', fontSize: 5, color: '#999999', align: 'center', fontFamily: 'sans',
  })),
  { id: 'control_box', type: 'shape', shape: 'rect', x: 402, y: 752, width: 180, height: 22, fillColor: RED },
  { id: 'control_label', type: 'text', x: 407, y: 756, width: 170, height: 10, text: 'CERTIFICATE CONTROL NO.', fontSize: 7, bold: true, color: '#FFFFFF', align: 'center', fontFamily: 'sans' },
  { id: 'control_value', type: 'text', x: 407, y: 778, width: 170, height: 12, text: '{{control_no}}', fontSize: 8, color: INK, align: 'center', fontFamily: 'sans' },
];

const TITLE_ELEMENT = { id: 'title', type: 'text', x: 0, y: 158, width: 612, height: 40, text: 'Certificate of Recognition', fontSize: 30, bold: true, italics: true, color: '#111111', align: 'center', fontFamily: 'serif' };

// Guest speakers have no grade/section, so the subtitle line under their
// name shows their position/organization instead — {{position_line}} is a
// composed mergeData field (see certificateGenerator.js) so this stays a
// flat placeholder like everything else.
const GUEST_SPEAKER_FRAME_ELEMENTS = FRAME_ELEMENTS.map((el) =>
  el.id === 'school_line' ? { ...el, text: '{{position_line}}' } : el
);

const DEFAULT_TEMPLATES = {
  completion: {
    template_key: 'completion',
    orientation: 'portrait',
    elements: [
      TITLE_ELEMENT,
      ...FRAME_ELEMENTS,
      {
        id: 'body', type: 'text', x: 90, y: 286, width: 432, height: 70,
        text: 'For having successfully completed **{{categories_completed}} journalism categories** during the **School Press Conference** held {{date_range}}{{venue_clause}}, demonstrating dedication, versatility, and excellence in campus journalism.',
        fontSize: 11.5, color: INK, align: 'justify', fontFamily: 'sans',
      },
    ],
  },
  ranking: {
    template_key: 'ranking',
    orientation: 'portrait',
    elements: [
      TITLE_ELEMENT,
      ...FRAME_ELEMENTS,
      {
        id: 'body', type: 'text', x: 90, y: 286, width: 432, height: 70,
        text: 'For having achieved as **{{rank_word}}** in the **{{category_name}}** during the **{{event_name}}** held {{date_range}}{{venue_clause}}.',
        fontSize: 11.5, color: INK, align: 'justify', fontFamily: 'sans',
      },
    ],
  },
  guest_speaker: {
    template_key: 'guest_speaker',
    orientation: 'portrait',
    elements: [
      TITLE_ELEMENT,
      ...GUEST_SPEAKER_FRAME_ELEMENTS,
      {
        id: 'body', type: 'text', x: 90, y: 286, width: 432, height: 70,
        text: 'In recognition of serving as a resource speaker on the topic of **{{topic}}** during the **{{event_name}}** held {{date_range}}{{venue_clause}}, and for generously sharing valuable insights and expertise with our students.',
        fontSize: 11.5, color: INK, align: 'justify', fontFamily: 'sans',
      },
    ],
  },
};

module.exports = { DEFAULT_TEMPLATES };
