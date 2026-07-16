const PDFDocument = require('pdfkit');
const { generateQrPngBuffer } = require('./qrGenerator');

const NAVY = '#0B1F3A';
const GOLD = '#C7A24A';
const INK = '#1A1A1A';
const RED = '#C23B3B';
const GRAY = '#666666';

const RANK_WORDS = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };

function generateControlNo(prefix = 'PRESSCONF') {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  const rand2 = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${rand}-${rand2}-${year}`;
}

/**
 * Shared frame: seal header, decorative title, awardee block, achievement
 * paragraph (built from styled segments so key phrases can be bold),
 * "Given this..." line, signature block, QR code, and a footer row with
 * logo placeholders + certificate control number — mirrors a standard
 * DepEd Certificate of Recognition layout.
 *
 * `bodySegments` is an array of { text, bold? } rendered as one flowing,
 * centered paragraph so specific words (category name, rank, event name)
 * can be emphasized without breaking the sentence into separate blocks.
 */
async function drawCertificateFrame(doc, {
  title,
  awardeeName,
  schoolLine,
  bodySegments,
  givenLine,
  signatoryName,
  signatoryTitle,
  controlNo,
  qrToken,
  officeLine,
}) {
  const { width, height } = doc.page;
  const centerX = width / 2;

  // Outer card background + thin rule under header (matches the sample's
  // plain white card with a gray divider under the DepEd header block)
  doc.rect(0, 0, width, height).fill('#FFFFFF');

  // Seal placeholder (school/division pastes their real seal image here)
  doc.circle(centerX, 55, 26).lineWidth(1.2).strokeColor(NAVY).stroke();
  doc.fontSize(6).fillColor(NAVY).font('Helvetica-Bold')
    .text('OFFICIAL\nSEAL', centerX - 26, 47, { width: 52, align: 'center' });

  doc.fontSize(10).fillColor(INK).font('Times-Roman')
    .text('Republic of the Philippines', 0, 90, { align: 'center' });
  doc.fontSize(15).fillColor(INK).font('Times-BoldItalic')
    .text('Department of Education', 0, 103, { align: 'center' });
  if (officeLine) {
    doc.fontSize(9).fillColor(INK).font('Helvetica-Bold')
      .text(officeLine.toUpperCase(), 0, 124, { align: 'center' });
  }

  doc.moveTo(60, 140).lineTo(width - 60, 140).lineWidth(1).strokeColor('#999999').stroke();

  // Title
  doc.fontSize(30).fillColor('#111111').font('Times-BoldItalic')
    .text(title, 0, 158, { align: 'center' });

  doc.fontSize(11).fillColor(INK).font('Helvetica')
    .text('is awarded to', 0, 200, { align: 'center' });

  // Awardee name, underlined
  doc.fontSize(22).fillColor(NAVY).font('Times-Bold')
    .text(awardeeName, 0, 218, { align: 'center' });
  const nameWidth = doc.widthOfString(awardeeName, { font: 'Times-Bold', fontSize: 22 });
  doc.moveTo(centerX - nameWidth / 2 - 6, 246).lineTo(centerX + nameWidth / 2 + 6, 246)
    .lineWidth(0.75).strokeColor(INK).stroke();

  if (schoolLine) {
    doc.fontSize(10.5).fillColor(INK).font('Helvetica-Oblique')
      .text(schoolLine, 80, 254, { align: 'center', width: width - 160 });
  }

  // Achievement paragraph, built from mixed bold/regular segments on one
  // flowing block. NOTE: PDFKit's "continued" text + align:'center' is
  // buggy (it centers each internal fragment separately, scrambling word
  // order) — so this paragraph is justified/left-aligned within an indented
  // block instead, which flows correctly with mixed bold/regular runs.
  let bodyY = 286;
  const bodyWidth = width - 180;
  const bodyX = 90;
  doc.fontSize(11.5);
  doc.x = bodyX;
  doc.y = bodyY;
  bodySegments.forEach((seg, i) => {
    doc.font(seg.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(seg.bold ? NAVY : INK)
      .text(seg.text, { continued: i < bodySegments.length - 1, width: bodyWidth, align: 'justify' });
  });

  // "Given this..." line
  doc.fontSize(10.5).fillColor(INK).font('Helvetica')
    .text(givenLine, 80, doc.y + 16, { align: 'center', width: bodyWidth });

  // Signature block
  const sigY = height - 150;
  doc.moveTo(centerX - 140, sigY).lineTo(centerX + 140, sigY).lineWidth(0.75).strokeColor(INK).stroke();
  doc.fontSize(10.5).fillColor(INK).font('Helvetica-Bold')
    .text(signatoryName.toUpperCase(), 0, sigY + 4, { align: 'center' });
  doc.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique')
    .text(signatoryTitle, 0, sigY + 18, { align: 'center' });

  // QR code, bottom right — encodes the control number for verification
  const qrBuffer = await generateQrPngBuffer(qrToken || controlNo);
  const qrSize = 62;
  doc.image(qrBuffer, width - 100, height - 110, { width: qrSize, height: qrSize });

  // Footer: logo placeholders + control number box
  const footerY = height - 40;
  doc.moveTo(30, footerY - 8).lineTo(width - 30, footerY - 8).lineWidth(0.5).strokeColor('#cccccc').stroke();

  const logoSlots = 4;
  for (let i = 0; i < logoSlots; i++) {
    const lx = 34 + i * 34;
    doc.roundedRect(lx, footerY - 2, 26, 26, 3).lineWidth(0.75).strokeColor('#bbbbbb').stroke();
    doc.fontSize(5).fillColor('#999999').text('LOGO', lx, footerY + 9, { width: 26, align: 'center' });
  }

  doc.rect(width - 210, footerY, 180, 22).fill(RED);
  doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold')
    .text('CERTIFICATE CONTROL NO.', width - 205, footerY + 4, { width: 170, align: 'center' });
  doc.fontSize(8).fillColor(INK).font('Helvetica')
    .text(controlNo, width - 205, footerY + 26, { width: 170, align: 'center' });
}

/**
 * Certificate of Recognition — completion award for students who finished
 * 6+ journalism categories across the Friday press conference sessions.
 */
async function renderCertificatePdf({
  student, categoriesCompleted, schoolName, divisionName, dateRange,
  officeLine, venue, signatoryName, signatoryTitle, controlNo,
}, res) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  doc.pipe(res);

  await drawCertificateFrame(doc, {
    title: 'Certificate of Recognition',
    awardeeName: student.full_name,
    schoolLine: `Grade ${student.grade} - ${student.section}, ${schoolName || 'Your School Name'}`,
    officeLine: officeLine || divisionName || 'Schools Division Office',
    bodySegments: [
      { text: 'For having successfully completed ' },
      { text: `${categoriesCompleted} journalism categories `, bold: true },
      { text: 'during the ' },
      { text: 'School Press Conference ', bold: true },
      { text: `held ${dateRange || 'on the scheduled Fridays'}${venue ? ' at ' + venue : ''}, demonstrating dedication, versatility, and excellence in campus journalism.` },
    ],
    givenLine: `Given this day at ${venue || (schoolName || 'the school campus')}.`,
    signatoryName: signatoryName || 'Juan D. Santos',
    signatoryTitle: signatoryTitle || 'School Principal / Head Teacher',
    controlNo: controlNo || generateControlNo('PRESSCONF-COMP'),
    qrToken: student.qr_token,
  });

  doc.end();
}

/**
 * Certificate of Recognition — per-category ranking award (1st/2nd/3rd).
 */
async function renderRankingCertificatePdf({
  student, categoryName, rank, eventName, dateRange, venue,
  schoolName, officeLine, signatoryName, signatoryTitle, controlNo,
}, res) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  doc.pipe(res);

  const rankWord = RANK_WORDS[rank] || 'OUTSTANDING';

  await drawCertificateFrame(doc, {
    title: 'Certificate of Recognition',
    awardeeName: student.full_name,
    schoolLine: `Grade ${student.grade} - ${student.section}, ${schoolName || 'Your School Name'}`,
    officeLine: officeLine || 'Schools Division Office',
    bodySegments: [
      { text: 'For having achieved as ' },
      { text: `${rankWord} `, bold: true },
      { text: 'in the ' },
      { text: `${categoryName} `, bold: true },
      { text: 'during the ' },
      { text: `${eventName || 'School Press Conference'} `, bold: true },
      { text: `held ${dateRange || 'on the scheduled date'}${venue ? ' at ' + venue : ''}.` },
    ],
    givenLine: `Given this day at ${venue || (schoolName || 'the school campus')}.`,
    signatoryName: signatoryName || 'Juan D. Santos',
    signatoryTitle: signatoryTitle || 'School Principal / Head Teacher',
    controlNo: controlNo || generateControlNo('PRESSCONF-RANK'),
    qrToken: student.qr_token,
  });

  doc.end();
}

module.exports = { renderCertificatePdf, renderRankingCertificatePdf, generateControlNo, RANK_WORDS };