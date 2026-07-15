const PDFDocument = require('pdfkit');
const { generateQrPngBuffer } = require('./qrGenerator');

// Palette: deep navy + press-gold, matches a newsroom/press-pass look
const NAVY = '#0B1F3A';
const GOLD = '#C7A24A';
const WHITE = '#FFFFFF';
const INK = '#1A1A1A';

/**
 * Renders a CR80-ish sized (3.375in x 2.125in) press-pass style ID card,
 * DepEd-aligned: school name, LRN, grade & section, DepEd logo placeholder
 * box (schools drop in their own official seal), signature line, and the
 * student's QR code for Friday press-conference attendance.
 */
async function renderIdCardPdf(student, res) {
  const cardW = 3.375 * 72; // 243pt
  const cardH = 2.125 * 72; // 153pt
  const doc = new PDFDocument({ size: [cardW, cardH], margin: 0 });
  doc.pipe(res);

  // Background
  doc.rect(0, 0, cardW, cardH).fill(NAVY);
  doc.rect(0, 0, cardW, 6).fill(GOLD);
  doc.rect(0, cardH - 6, cardW, 6).fill(GOLD);

  // DepEd logo placeholder (school pastes official seal image here)
  doc.circle(24, 26, 15).lineWidth(1).stroke(GOLD);
  doc.fontSize(5).fillColor(GOLD).font('Helvetica-Bold')
    .text('DepEd', 12, 22, { width: 24, align: 'center' });

  // Header text
  doc.fontSize(7).fillColor(GOLD).font('Helvetica-Bold')
    .text('DEPARTMENT OF EDUCATION', 44, 10, { width: cardW - 54 });
  doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
    .text((student.school_name || 'Your School Name').toUpperCase(), 44, 20, { width: cardW - 54 });
  doc.fontSize(6.5).fillColor(GOLD).font('Helvetica-Oblique')
    .text('School Press Conference — Official Press Pass', 44, 32, { width: cardW - 54 });

  // Divider
  doc.moveTo(10, 46).lineTo(cardW - 10, 46).lineWidth(0.5).stroke(GOLD);

  // Photo placeholder box
  doc.rect(10, 54, 55, 65).lineWidth(1).stroke(WHITE);
  doc.fontSize(6).fillColor(WHITE).text('PHOTO', 10, 82, { width: 55, align: 'center' });

  // Student details
  const infoX = 74;
  doc.fontSize(6).fillColor(GOLD).font('Helvetica-Bold').text('NAME', infoX, 54);
  doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold').text(student.full_name, infoX, 62, { width: 90 });

  doc.fontSize(6).fillColor(GOLD).font('Helvetica-Bold').text('GRADE & SECTION', infoX, 82);
  doc.fontSize(8.5).fillColor(WHITE).font('Helvetica').text(`Grade ${student.grade} - ${student.section}`, infoX, 90, { width: 90 });

  doc.fontSize(6).fillColor(GOLD).font('Helvetica-Bold').text('LRN', infoX, 104);
  doc.fontSize(8.5).fillColor(WHITE).font('Helvetica').text(student.lrn || 'N/A', infoX, 112, { width: 90 });

  // QR code
  const qrBuffer = await generateQrPngBuffer(student.qr_token);
  const qrSize = 60;
  doc.rect(cardW - qrSize - 10, 54, qrSize + 4, qrSize + 4).fill(WHITE);
  doc.image(qrBuffer, cardW - qrSize - 8, 56, { width: qrSize, height: qrSize });

  // Footer / signature line
  doc.moveTo(10, cardH - 22).lineTo(90, cardH - 22).lineWidth(0.5).stroke(WHITE);
  doc.fontSize(5.5).fillColor(WHITE).text('Adviser / Principal Signature', 10, cardH - 18, { width: 90 });

  doc.fontSize(5.5).fillColor(GOLD).text(
    `ID: ${student.student_id_no || student.id.slice(0, 8).toUpperCase()}`,
    10, cardH - 32
  );

  doc.end();
}

module.exports = { renderIdCardPdf };
