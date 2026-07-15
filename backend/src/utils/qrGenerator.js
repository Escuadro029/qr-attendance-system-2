const QRCode = require('qrcode');

/**
 * Generates a QR code PNG buffer that encodes only the student's opaque
 * qr_token (a UUID) — never personal information — matching the
 * "unique student ID, not necessarily all personal info" requirement.
 */
async function generateQrPngBuffer(qrToken) {
  return QRCode.toBuffer(qrToken, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0B1F3A', // deep navy, matches the press-conference theme
      light: '#FFFFFF',
    },
  });
}

async function generateQrDataUrl(qrToken) {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 8,
    color: { dark: '#0B1F3A', light: '#FFFFFF' },
  });
}

module.exports = { generateQrPngBuffer, generateQrDataUrl };
