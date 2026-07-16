const PDFDocument = require('pdfkit');
const { generateQrPngBuffer } = require('./qrGenerator');

// Palette: deep navy + press-gold, matches a newsroom/press-pass look
const NAVY = '#0B1F3A';
const GOLD = '#C7A24A';
const WHITE = '#FFFFFF';

// Standard CR80 card size (matches a real ID card / press pass)
const CARD_W = 3.375 * 72; // 243pt
const CARD_H = 2.125 * 72; // 153pt

/**
 * Draws one press-pass ID card at the given origin on an already-open
 * PDFDocument. Used both for the single full-page card and for the bulk
 * grid sheet, so the design only lives in one place.
 */
async function drawCard(doc, originX, originY, student) {
  doc.save();
  doc.translate(originX, originY);

  // Background
  doc.rect(0, 0, CARD_W, CARD_H).fill(NAVY);
  doc.rect(0, 0, CARD_W, 6).fill(GOLD);
  doc.rect(0, CARD_H - 6, CARD_W, 6).fill(GOLD);

  // DepEd logo placeholder (school pastes official seal image here)
  doc.circle(24, 26, 15).lineWidth(1).stroke(GOLD);
  doc.fontSize(5).fillColor(GOLD).font('Helvetica-Bold')
    .text('DepEd', 12, 22, { width: 24, align: 'center' });

  // Header text
  doc.fontSize(7).fillColor(GOLD).font('Helvetica-Bold')
    .text('DEPARTMENT OF EDUCATION', 44, 10, { width: CARD_W - 54 });
  doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
    .text((student.school_name || 'Your School Name').toUpperCase(), 44, 20, { width: CARD_W - 54 });
  doc.fontSize(6.5).fillColor(GOLD).font('Helvetica-Oblique')
    .text('School Press Conference — Official Press Pass', 44, 32, { width: CARD_W - 54 });

  // Divider
  doc.moveTo(10, 46).lineTo(CARD_W - 10, 46).lineWidth(0.5).stroke(GOLD);

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
  doc.rect(CARD_W - qrSize - 10, 54, qrSize + 4, qrSize + 4).fill(WHITE);
  doc.image(qrBuffer, CARD_W - qrSize - 8, 56, { width: qrSize, height: qrSize });

  // Footer / signature line
  doc.moveTo(10, CARD_H - 22).lineTo(90, CARD_H - 22).lineWidth(0.5).stroke(WHITE);
  doc.fontSize(5.5).fillColor(WHITE).text('Adviser / Principal Signature', 10, CARD_H - 18, { width: 90 });

  doc.fontSize(5.5).fillColor(GOLD).text(
    `ID: ${student.student_id_no || student.id.slice(0, 8).toUpperCase()}`,
    10, CARD_H - 32
  );

  doc.restore();
}

/**
 * Single card, sized to exactly one CR80 card page (for card printers or
 * a single quick download).
 */
async function renderIdCardPdf(student, res) {
  const doc = new PDFDocument({ size: [CARD_W, CARD_H], margin: 0 });
  doc.pipe(res);
  await drawCard(doc, 0, 0, student);
  doc.end();
}

/**
 * Bulk sheet: lays out many cards on Letter-size ("short") bond paper in a
 * grid with dashed cut-lines, so a teacher can print one sheet and cut out
 * several press passes at once instead of printing one page per student.
 * Fits 2 columns x 4 rows = 8 cards per Letter page (8.5in x 11in).
 */
async function renderIdCardsBulkPdf(students, res) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
  doc.pipe(res);

  const pageW = doc.page.width;   // 612pt
  const pageH = doc.page.height;  // 792pt
  const cols = 2;
  const rows = 4;
  const gapX = 14;
  const gapY = 14;

  const gridW = cols * CARD_W + (cols - 1) * gapX;
  const gridH = rows * CARD_H + (rows - 1) * gapY;
  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  const perPage = cols * rows;

  for (let i = 0; i < students.length; i++) {
    const posOnPage = i % perPage;
    if (i > 0 && posOnPage === 0) doc.addPage();

    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);
    const x = marginX + col * (CARD_W + gapX);
    const y = marginY + row * (CARD_H + gapY);

    // Dashed cut-line guide around each card slot
    doc.save();
    doc.dash(4, { space: 3 }).lineWidth(0.75).strokeColor('#999999');
    doc.rect(x - 3, y - 3, CARD_W + 6, CARD_H + 6).stroke();
    doc.undash();
    doc.restore();

    await drawCard(doc, x, y, students[i]);
  }

  doc.end();
}

module.exports = { renderIdCardPdf, renderIdCardsBulkPdf, drawCard, CARD_W, CARD_H };