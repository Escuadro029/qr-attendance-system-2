const path = require('path');

// Free, OFL/permissively-licensed fonts bundled under this one directory —
// see the *-LICENSE.txt file alongside each family.
const FONTS_DIR = path.join(__dirname, '../assets/fonts');

// Roboto ships inside the pdfmake package itself — reused here for the
// sans-serif accents (small header labels, body paragraph, footer) so no
// extra font sourcing is needed for that family.
const ROBOTO_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');

// UnifrakturMaguntia: Google's OFL-licensed blackletter/"Old English" display
// face (see UNIFRAKTURMAGUNTIA-OFL-LICENSE.txt) — only ships one weight, so
// every style slot points at the same file; pdfmake still needs all four
// registered or requesting bold/italic on this font throws.
const OLD_ENGLISH_FILE = path.join(FONTS_DIR, 'UnifrakturMaguntia-Regular.ttf');

// Cinzel: Google's OFL-licensed Roman-inscriptional display face (see
// CINZEL-OFL-LICENSE.txt) — the standard free substitute for Adobe's
// commercial "Trajan Pro" (which can't legally be bundled/redistributed
// here). Only ships as a single variable-font file, so — same caveat as
// UnifrakturMaguntia above — every style slot points at it; pdfmake embeds
// the file's default (Regular) instance regardless of slot, so "bold" text
// in this family won't visually bolden.
const TRAJAN_SUBSTITUTE_FILE = path.join(FONTS_DIR, 'Cinzel-Variable.ttf');

const fonts = {
  Tinos: {
    normal: path.join(FONTS_DIR, 'Tinos-Regular.ttf'),
    bold: path.join(FONTS_DIR, 'Tinos-Bold.ttf'),
    italics: path.join(FONTS_DIR, 'Tinos-Italic.ttf'),
    bolditalics: path.join(FONTS_DIR, 'Tinos-BoldItalic.ttf'),
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
  TrajanPro: {
    normal: TRAJAN_SUBSTITUTE_FILE,
    bold: TRAJAN_SUBSTITUTE_FILE,
    italics: TRAJAN_SUBSTITUTE_FILE,
    bolditalics: TRAJAN_SUBSTITUTE_FILE,
  },
  // Tahoma is a commercial Microsoft font and can't legally be bundled here
  // either — DejaVu Sans is the long-established free substitute (used by
  // Linux/LibreOffice as the default Tahoma/Verdana replacement) and, unlike
  // the two faces above, ships proper normal/bold/oblique/bold-oblique files.
  Tahoma: {
    normal: path.join(FONTS_DIR, 'DejaVuSans.ttf'),
    bold: path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf'),
    italics: path.join(FONTS_DIR, 'DejaVuSans-Oblique.ttf'),
    bolditalics: path.join(FONTS_DIR, 'DejaVuSans-BoldOblique.ttf'),
  },
};

module.exports = { fonts };
