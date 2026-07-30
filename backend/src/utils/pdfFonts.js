const path = require('path');

// Tinos: Google's OFL-licensed, metrics-compatible replacement for Times New
// Roman (see backend/src/assets/fonts/TINOS-OFL-LICENSE.txt) — used for the
// certificate's serif display text (title, awardee name).
const TINOS_DIR = path.join(__dirname, '../assets/fonts');

// Roboto ships inside the pdfmake package itself — reused here for the
// sans-serif accents (small header labels, body paragraph, footer) so no
// extra font sourcing is needed for that family.
const ROBOTO_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');

// UnifrakturMaguntia: Google's OFL-licensed blackletter/"Old English" display
// face (see UNIFRAKTURMAGUNTIA-OFL-LICENSE.txt) — only ships one weight, so
// every style slot points at the same file; pdfmake still needs all four
// registered or requesting bold/italic on this font throws.
const OLD_ENGLISH_FILE = path.join(TINOS_DIR, 'UnifrakturMaguntia-Regular.ttf');

const fonts = {
  Tinos: {
    normal: path.join(TINOS_DIR, 'Tinos-Regular.ttf'),
    bold: path.join(TINOS_DIR, 'Tinos-Bold.ttf'),
    italics: path.join(TINOS_DIR, 'Tinos-Italic.ttf'),
    bolditalics: path.join(TINOS_DIR, 'Tinos-BoldItalic.ttf'),
  },
  Roboto: {
    normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf'),
  },
  OldEnglish: {
    normal: OLD_ENGLISH_FILE,
    bold: OLD_ENGLISH_FILE,
    italics: OLD_ENGLISH_FILE,
    bolditalics: OLD_ENGLISH_FILE,
  },
};

module.exports = { fonts };
