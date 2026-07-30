const pdfMake = require('pdfmake');
const { generateQrDataUrl } = require('./qrGenerator');
const { fonts } = require('./pdfFonts');
const { DEFAULT_TEMPLATES } = require('./certificateTemplateDefaults');

pdfMake.setFonts(fonts);
const ALLOWED_FONT_PATHS = new Set(Object.values(fonts).flatMap((variants) => Object.values(variants)));
// Only the exact bundled font file paths may be read from disk; no other
// local files, and no remote URLs, are ever referenced from a docDefinition.
pdfMake.setLocalAccessPolicy((path) => ALLOWED_FONT_PATHS.has(path));
pdfMake.setUrlAccessPolicy(() => false);

const NAVY = '#2B6CB0';
const INK = '#2D3748';

const RANK_WORDS = {
  1: 'FIRST', 2: 'SECOND', 3: 'THIRD', 4: 'FOURTH', 5: 'FIFTH',
  6: 'SIXTH', 7: 'SEVENTH', 8: 'EIGHTH', 9: 'NINTH', 10: 'TENTH',
};

// Point dimensions (72pt/inch) for the three paper choices offered in the
// certificate designer, given in PORTRAIT orientation — landscape swaps
// width/height. "Short" and "Long" follow the Philippine school-supply
// convention (Short = Letter, Long = 8.5in x 13in), not the US Legal size.
const PAPER_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  short: { width: 612, height: 792 },
  long: { width: 612, height: 936 },
};

function pageDims(paperSize, orientation) {
  const base = PAPER_SIZES[paperSize] || PAPER_SIZES.short;
  return orientation === 'landscape' ? { width: base.height, height: base.width } : base;
}

function generateControlNo(prefix = 'PRESSCONF') {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  const rand2 = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${rand}-${rand2}-${year}`;
}

// Plain pdfmake text/stack nodes ignore a standalone `width` property (it's
// only honored on `image` nodes) — `alignment: 'center'` would otherwise
// center across the full remaining page width instead of a narrower box.
// Wrapping in a single fixed-width `columns` entry gives a real constrained
// box to center/justify within, matching a `.text(str, x, y, {width})` call.
function boxed({ x, y, width, node }) {
  return { columns: [{ width, ...node }], absolutePosition: { x, y } };
}

function substitutePlaceholders(text, mergeData) {
  return (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (mergeData[key] ?? ''));
}

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

// Custom settings fields (e.g. "Event Name" -> {{event_name}}) are merged in
// last so they can never shadow a system field like {{full_name}}.
function applyCustomFields(mergeData, customFields) {
  for (const { name, value } of customFields || []) {
    const key = slugify(name);
    if (!(key in mergeData)) mergeData[key] = value;
  }
  return mergeData;
}

function fontNameFor(fontFamily) {
  if (fontFamily === 'serif') return 'Tinos';
  if (fontFamily === 'oldenglish') return 'OldEnglish';
  if (fontFamily === 'trajanpro') return 'TrajanPro';
  if (fontFamily === 'tahoma') return 'Tahoma';
  return 'Roboto';
}

// Splits "plain **bold** plain" into pdfmake inline text runs — bold
// segments are accent-colored (navy) regardless of the element's own color,
// matching the original design where key phrases (a category name, a rank)
// are emphasized within an otherwise plain sentence.
function textRuns(text, el) {
  const font = fontNameFor(el.fontFamily);
  const color = el.color || INK;
  return text
    .split(/\*\*(.+?)\*\*/g)
    .filter((part) => part.length > 0)
    .map((part, i) => ({
      text: part,
      font,
      bold: i % 2 === 1 ? true : !!el.bold,
      italics: !!el.italics,
      color: i % 2 === 1 ? NAVY : color,
    }));
}

function renderTextElement(el, mergeData) {
  let text = substitutePlaceholders(el.text, mergeData);
  if (el.uppercase) text = text.toUpperCase();
  return boxed({
    x: el.x,
    y: el.y,
    width: el.width,
    node: { text: textRuns(text, el), fontSize: el.fontSize || 11, alignment: el.align || 'left' },
  });
}

// All shapes share one bounding box ({x,y,width,height}) so the frontend's
// drag/resize editor can treat every element uniformly; each shape kind
// converts that box into the coordinates pdfmake's canvas vectors expect.
function renderShapeElement(el) {
  const vector = { lineColor: el.lineColor, lineWidth: el.lineWidth, color: el.fillColor };
  if (el.shape === 'line') {
    Object.assign(vector, { type: 'line', x1: el.x, y1: el.y, x2: el.x + el.width, y2: el.y + el.height });
  } else if (el.shape === 'rect') {
    Object.assign(vector, { type: 'rect', x: el.x, y: el.y, w: el.width, h: el.height, r: el.cornerRadius || undefined });
  } else if (el.shape === 'ellipse') {
    Object.assign(vector, { type: 'ellipse', x: el.x + el.width / 2, y: el.y + el.height / 2, r1: el.width / 2, r2: el.height / 2 });
  } else {
    return null;
  }
  return { canvas: [vector], absolutePosition: { x: 0, y: 0 } };
}

function renderImageElement(el, qrDataUrl) {
  // Uploaded logos are stored as a data URI directly on the element (in the
  // same certificate_templates.elements JSONB, no separate file storage) —
  // simplest option given Render's web service filesystem isn't persistent.
  const dataUrl = el.source === 'qr' ? qrDataUrl : el.source === 'custom' ? el.imageData : null;
  if (!dataUrl) return null;
  return { image: dataUrl, width: el.width, height: el.height, absolutePosition: { x: el.x, y: el.y } };
}

// Proportionally scales and offsets a positioned-elements array — used to
// shrink a full-page certificate design down to fit one half of a shared
// sheet (see buildCertificateDocDefinitionMultiSheet). Mirrors the
// frontend's rescaleElements() in certificate-template.component.ts.
function scaleElements(elements, scale, offsetX, offsetY) {
  return (elements || []).map((el) => ({
    ...el,
    x: el.x * scale + offsetX,
    y: el.y * scale + offsetY,
    width: el.width * scale,
    height: el.height * scale,
    fontSize: el.fontSize ? Math.max(4, el.fontSize * scale) : el.fontSize,
    lineWidth: el.lineWidth != null ? Math.max(0.25, el.lineWidth * scale) : el.lineWidth,
    cornerRadius: el.cornerRadius ? el.cornerRadius * scale : el.cornerRadius,
  }));
}

/**
 * Renders one certificate's elements array (already at whatever scale/offset
 * the caller wants) into a pdfmake content array. Split out from
 * buildCertificateDocDefinition so buildCertificateDocDefinitionMultiSheet
 * can reuse it twice per sheet without duplicating the element-rendering
 * logic.
 */
async function buildCertificateContentNodes(elements, mergeData, qrToken, controlNo) {
  const list = elements || [];
  // Only generate the QR image when something in the layout actually needs
  // it — most certificates no longer include one.
  const needsQr = list.some((el) => el.type === 'image' && el.source === 'qr');
  const qrDataUrl = needsQr ? await generateQrDataUrl(qrToken || controlNo) : null;

  return list
    .map((el) => {
      if (el.type === 'text') return renderTextElement(el, mergeData);
      if (el.type === 'shape') return renderShapeElement(el);
      if (el.type === 'image') return renderImageElement(el, qrDataUrl);
      return null;
    })
    .filter(Boolean);
}

/**
 * Builds a pdfmake docDefinition from a freely-positioned elements array —
 * each element is independently drawn at its own absolute box, so the
 * layout is entirely data-driven (edited via the certificate template
 * designer) rather than hardcoded here.
 */
async function buildCertificateDocDefinition({ elements, mergeData, qrToken, controlNo, orientation, paperSize }) {
  const content = await buildCertificateContentNodes(elements, mergeData, qrToken, controlNo);
  const { width, height } = pageDims(paperSize, orientation);

  return {
    pageSize: { width, height },
    pageMargins: 0,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    content,
  };
}

/**
 * Lays out many already-built certificate entries two-per-sheet (stacked
 * top/bottom, each scaled to half size, with a dashed cut-line between) on
 * the SAME physical paper size/orientation the template is configured for —
 * not a doubled sheet — so printing certificates for a whole class uses half
 * as much bond paper. `entries` is a flat list of
 * `{ elements, mergeData, qrToken, controlNo }`; consecutive pairs share a
 * sheet, and a trailing odd entry gets a sheet to itself (blank bottom half).
 */
async function buildCertificateDocDefinitionMultiSheet(entries, { paperSize, orientation }) {
  const { width, height } = pageDims(paperSize, orientation);
  const slotHeight = height / 2;
  const scale = 0.5;
  const offsetX = width * 0.25;

  const content = [];
  for (let i = 0; i < entries.length; i += 2) {
    const [a, b] = [entries[i], entries[i + 1]];
    const sheetContent = [];
    if (content.length > 0) sheetContent.push({ text: '', pageBreak: 'before' });

    if (a) {
      sheetContent.push(...await buildCertificateContentNodes(scaleElements(a.elements, scale, offsetX, 0), a.mergeData, a.qrToken, a.controlNo));
    }
    if (b) {
      sheetContent.push(...await buildCertificateContentNodes(scaleElements(b.elements, scale, offsetX, slotHeight), b.mergeData, b.qrToken, b.controlNo));
    }

    sheetContent.push({
      canvas: [{ type: 'line', x1: 20, y1: slotHeight, x2: width - 20, y2: slotHeight, lineColor: '#cccccc', dash: { length: 4, space: 3 }, lineWidth: 0.75 }],
      absolutePosition: { x: 0, y: 0 },
    });

    content.push(...sheetContent);
  }

  return {
    pageSize: { width, height },
    pageMargins: 0,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    content,
  };
}

async function streamPdf(docDefinition, res) {
  const pdfDoc = pdfMake.createPdf(docDefinition);
  const stream = await pdfDoc.getStream();
  stream.pipe(res);
  stream.end();
}

function buildCompletionMergeData({
  student, categoriesCompleted, schoolName, divisionName, dateRange,
  officeLine, venue, signatoryName, signatoryTitle, controlNo, customFields,
}) {
  const finalControlNo = controlNo || generateControlNo('PRESSCONF-COMP');
  const mergeData = applyCustomFields({
    full_name: student.full_name,
    grade: student.grade,
    section: student.section,
    school_name: schoolName || 'Your School Name',
    categories_completed: categoriesCompleted,
    date_range: dateRange || 'on the scheduled Fridays',
    venue: venue || '',
    venue_clause: venue ? ` at ${venue}` : '',
    venue_or_school: venue || schoolName || 'the school campus',
    office_line: officeLine || divisionName || 'Schools Division Office',
    signatory_name: signatoryName || 'Juan D. Santos',
    signatory_title: signatoryTitle || 'School Principal / Head Teacher',
    control_no: finalControlNo,
  }, customFields);
  return { mergeData, controlNo: finalControlNo };
}

/**
 * Certificate of Recognition — completion award for students who finished
 * 6+ journalism categories across the Friday press conference sessions.
 */
async function renderCertificatePdf(opts, res) {
  const { student, template } = opts;
  const { mergeData, controlNo } = buildCompletionMergeData(opts);
  const tpl = template || DEFAULT_TEMPLATES.completion;
  const docDefinition = await buildCertificateDocDefinition({
    elements: tpl.elements,
    orientation: tpl.orientation,
    paperSize: tpl.paper_size,
    mergeData,
    qrToken: student.qr_token,
    controlNo,
  });

  await streamPdf(docDefinition, res);
}

function buildRankingMergeData({
  student, categoryName, rank, eventName, dateRange, venue,
  schoolName, officeLine, signatoryName, signatoryTitle, controlNo, customFields,
}) {
  const finalControlNo = controlNo || generateControlNo('PRESSCONF-RANK');
  const mergeData = applyCustomFields({
    full_name: student.full_name,
    grade: student.grade,
    section: student.section,
    school_name: schoolName || 'Your School Name',
    category_name: categoryName,
    rank_word: RANK_WORDS[rank] || 'OUTSTANDING',
    event_name: eventName || 'School Press Conference',
    date_range: dateRange || 'on the scheduled date',
    venue: venue || '',
    venue_clause: venue ? ` at ${venue}` : '',
    venue_or_school: venue || schoolName || 'the school campus',
    office_line: officeLine || 'Schools Division Office',
    signatory_name: signatoryName || 'Juan D. Santos',
    signatory_title: signatoryTitle || 'School Principal / Head Teacher',
    control_no: finalControlNo,
  }, customFields);
  return { mergeData, controlNo: finalControlNo };
}

/**
 * Certificate of Recognition — per-category ranking award (1st through 10th).
 */
async function renderRankingCertificatePdf(opts, res) {
  const { student, template } = opts;
  const { mergeData, controlNo } = buildRankingMergeData(opts);
  const tpl = template || DEFAULT_TEMPLATES.ranking;
  const docDefinition = await buildCertificateDocDefinition({
    elements: tpl.elements,
    orientation: tpl.orientation,
    paperSize: tpl.paper_size,
    mergeData,
    qrToken: student.qr_token,
    controlNo,
  });

  await streamPdf(docDefinition, res);
}

function buildSpeakerMergeData({
  speaker, eventName, dateRange, venue, officeLine, signatoryName, signatoryTitle, controlNo, customFields,
}) {
  const finalControlNo = controlNo || generateControlNo('PRESSCONF-SPEAKER');
  const mergeData = applyCustomFields({
    full_name: speaker.full_name,
    position: speaker.position || '',
    organization: speaker.organization || '',
    position_line: [speaker.position, speaker.organization].filter(Boolean).join(', '),
    topic: speaker.topic || 'campus journalism',
    event_name: eventName || 'School Press Conference',
    date_range: dateRange || 'on the scheduled date',
    venue: venue || '',
    venue_clause: venue ? ` at ${venue}` : '',
    venue_or_school: venue || 'the school campus',
    office_line: officeLine || 'Schools Division Office',
    signatory_name: signatoryName || 'Juan D. Santos',
    signatory_title: signatoryTitle || 'School Principal / Head Teacher',
    control_no: finalControlNo,
  }, customFields);
  return { mergeData, controlNo: finalControlNo };
}

/**
 * Certificate of Recognition — speakers/lecturers invited to the press
 * conference (no grade/section/QR; the subtitle line shows their
 * position/organization instead via the composed {{position_line}} field).
 */
async function renderSpeakerCertificatePdf(opts, res) {
  const { template } = opts;
  const { mergeData, controlNo } = buildSpeakerMergeData(opts);
  const tpl = template || DEFAULT_TEMPLATES.speaker;
  const docDefinition = await buildCertificateDocDefinition({
    elements: tpl.elements,
    orientation: tpl.orientation,
    paperSize: tpl.paper_size,
    mergeData,
    controlNo,
  });

  await streamPdf(docDefinition, res);
}

function buildTeacherMergeData({
  teacher, eventName, dateRange, venue, officeLine, signatoryName, signatoryTitle, controlNo, customFields,
}) {
  const finalControlNo = controlNo || generateControlNo('PRESSCONF-TEACHER');
  const mergeData = applyCustomFields({
    full_name: teacher.full_name,
    role: teacher.role || '',
    department: teacher.department || '',
    role_line: [teacher.role, teacher.department].filter(Boolean).join(', '),
    topic: teacher.topic || '',
    event_name: eventName || 'School Press Conference',
    date_range: dateRange || 'on the scheduled date',
    venue: venue || '',
    venue_clause: venue ? ` at ${venue}` : '',
    venue_or_school: venue || 'the school campus',
    office_line: officeLine || 'Schools Division Office',
    signatory_name: signatoryName || 'Juan D. Santos',
    signatory_title: signatoryTitle || 'School Principal / Head Teacher',
    control_no: finalControlNo,
  }, customFields);
  return { mergeData, controlNo: finalControlNo };
}

/**
 * Certificate of Appreciation — teachers who participated in running the
 * press conference (facilitator, judge, coordinator, reactor, etc.), issued
 * exclusively to them and distinct from the student/speaker certificates
 * (no grade/section/QR; the subtitle line shows their role/department
 * instead via the composed {{role_line}} field).
 */
async function renderTeacherCertificatePdf(opts, res) {
  const { template } = opts;
  const { mergeData, controlNo } = buildTeacherMergeData(opts);
  const tpl = template || DEFAULT_TEMPLATES.teacher;
  const docDefinition = await buildCertificateDocDefinition({
    elements: tpl.elements,
    orientation: tpl.orientation,
    paperSize: tpl.paper_size,
    mergeData,
    controlNo,
  });

  await streamPdf(docDefinition, res);
}

module.exports = {
  renderCertificatePdf,
  renderRankingCertificatePdf,
  renderSpeakerCertificatePdf,
  renderTeacherCertificatePdf,
  buildCompletionMergeData,
  buildRankingMergeData,
  buildSpeakerMergeData,
  buildTeacherMergeData,
  generateControlNo,
  RANK_WORDS,
  pageDims,
  buildCertificateDocDefinition,
  buildCertificateDocDefinitionMultiSheet,
  streamPdf,
};
