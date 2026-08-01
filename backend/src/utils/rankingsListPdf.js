// Builds a square, poster-style "Top N" results graphic meant to be posted
// straight to social media — not a plain table. Everything is absolutely
// positioned on one square page (same pdfmake technique the certificate
// generator uses), so this is closer to a leaderboard graphic than a report.

// Categories like "Radio Broadcasting" are produced by a crew rather than a
// single writer/photographer, so the printed results list styles them as a
// "Team" category instead of a "Journalism" one. Purely name-based since the
// categories table has no explicit type column.
function isTeamCategory(name) {
  return /\b(team|broadcast|radio)\b/i.test(name || '');
}

const PAGE = 900;
const MEDAL_COLORS = { 1: '#F5D061', 2: '#D9DEE3', 3: '#D8A15C' };
const MEDAL_TEXT_COLOR = '#1a1310';

const PALETTES = {
  journalism: { bg: '#0c1a3a', band: '#173a8c', accent: '#F5D061', accentDim: '#5b6ea8' },
  team: { bg: '#241203', band: '#7a3f0a', accent: '#FFCE7A', accentDim: '#a87840' },
};

function textNode(content, x, y, opts = {}) {
  return {
    text: content,
    absolutePosition: { x, y },
    width: opts.width,
    alignment: opts.alignment || 'left',
    fontSize: opts.fontSize || 12,
    bold: !!opts.bold,
    color: opts.color || '#ffffff',
    characterSpacing: opts.characterSpacing,
    font: opts.font,
  };
}

// Hand-centers a short numeral (the 1-2 digit rank number inside a badge
// circle) around `centerX` using an estimated average glyph width, rather
// than relying on `alignment: 'center'` + `width` on a bare absolutely
// positioned text node — pdfmake only resolves that combination against the
// node's own width when it's boxed inside a `columns`/table cell, and
// wrapping every badge number in a `columns` node turned out to trigger
// pdfmake's row-layout pagination even inside an absolutely positioned
// block, silently splitting the one-page design onto a stray second page.
function centeredNumberX(centerX, fontSize, digitCount) {
  const avgGlyphWidth = fontSize * 0.56;
  return centerX - (avgGlyphWidth * digitCount) / 2;
}

function rectNode(x, y, w, h, opts = {}) {
  return {
    canvas: [{ type: 'rect', x, y, w, h, r: opts.r, color: opts.color, lineColor: opts.lineColor, lineWidth: opts.lineColor ? opts.lineWidth ?? 1 : 0, fillOpacity: opts.fillOpacity }],
    absolutePosition: { x: 0, y: 0 },
  };
}

function circleNode(cx, cy, r, opts = {}) {
  return {
    canvas: [{ type: 'ellipse', x: cx, y: cy, r1: r, r2: r, color: opts.color, lineColor: opts.lineColor, lineWidth: opts.lineColor ? opts.lineWidth ?? 2 : 0 }],
    absolutePosition: { x: 0, y: 0 },
  };
}

function lineNode(x1, y1, x2, y2, opts = {}) {
  return {
    canvas: [{ type: 'line', x1, y1, x2, y2, lineColor: opts.color || '#ffffff', lineWidth: opts.lineWidth || 1 }],
    absolutePosition: { x: 0, y: 0 },
  };
}

// Long category names ("Editorial Cartooning") need a smaller headline than
// short ones ("Photojournalism") to avoid running off the square page.
function headlineFontSize(name) {
  const len = (name || '').length;
  if (len <= 12) return 56;
  if (len <= 18) return 46;
  if (len <= 24) return 38;
  return 30;
}

function buildRankingsListDocDefinition({ categoryName, rows, eventName, dateRange, venue }) {
  const isTeam = isTeamCategory(categoryName);
  const palette = isTeam ? PALETTES.team : PALETTES.journalism;
  const content = [];

  // Background + colored header band + gold seam.
  content.push(rectNode(0, 0, PAGE, PAGE, { color: palette.bg }));
  const bandHeight = 300;
  content.push(rectNode(0, 0, PAGE, bandHeight, { color: palette.band }));
  content.push(rectNode(0, bandHeight - 6, PAGE, 6, { color: palette.accent }));

  // Decorative frame.
  content.push(rectNode(24, 24, PAGE - 48, PAGE - 48, { lineColor: palette.accent, lineWidth: 3 }));
  content.push(rectNode(38, 38, PAGE - 76, PAGE - 76, { lineColor: palette.accentDim, lineWidth: 1 }));

  // Header text.
  content.push(textNode((eventName || 'School Press Conference').toUpperCase(), 0, 56, {
    width: PAGE, alignment: 'center', fontSize: 15, color: '#EAF0FB', characterSpacing: 1,
  }));
  content.push(textNode((categoryName || '').toUpperCase(), 0, 96, {
    width: PAGE, alignment: 'center', fontSize: headlineFontSize(categoryName), bold: true, color: '#ffffff',
  }));
  content.push(textNode(`TOP ${rows.length} • ${isTeam ? 'TEAM CATEGORY' : 'JOURNALISM CATEGORY'} RESULTS`, 0, 178, {
    width: PAGE, alignment: 'center', fontSize: 17, bold: true, color: palette.accent, characterSpacing: 1,
  }));
  const metaLine = [dateRange, venue].filter(Boolean).join('   •   ');
  if (metaLine) {
    content.push(textNode(metaLine, 0, 212, { width: PAGE, alignment: 'center', fontSize: 13, color: '#EAF0FB' }));
  }

  // Leaderboard rows — 1st/2nd/3rd get a bigger "podium" treatment (medal
  // colored badge, larger name), 4th-10th get a compact uniform row. Base
  // sizes assume a handful of rows; if all 10 ranks are assigned, that would
  // run well past the bottom of a fixed-size page. pdfmake's text layout
  // force-paginates a text node once it's positioned close enough to the
  // page bottom that its own line doesn't fit — even for absolutely
  // positioned nodes — so rather than truncate or silently overflow onto a
  // stray second page, everything (row height, badge size, font sizes, gaps)
  // scales down uniformly (down to a 50% floor) until the whole list is
  // guaranteed to fit in the space available above the footer.
  const BASE = {
    rowH: { podium: 104, rest: 62 },
    gap: 14,
    badgeR: { podium: 36, rest: 23 },
    // Name font sizes are a MAX cap, not a fixed size — each row's name is
    // sized up to fill most of the available width on the right (up to this
    // cap), shrinking only as far as needed for a long name to still fit on
    // one line. See the per-row fill calculation below.
    nameFS: { podium: 52, rest: 34, min: { podium: 20, rest: 14 } },
    numFS: { podium: 32, rest: 19 },
    nameGap: 20,
  };

  const rawHeight = (scale) =>
    rows.filter((r) => r.rank <= 3).length * BASE.rowH.podium * scale +
    rows.filter((r) => r.rank > 3).length * BASE.rowH.rest * scale +
    Math.max(0, rows.length - 1) * BASE.gap * scale;

  const listTop = bandHeight + 36;
  const listBottom = PAGE - 100;
  const available = listBottom - listTop;

  // Floor is a defensive minimum, not the expected case — the worst case
  // (all 10 ranks assigned) computes to ~0.53 given the constants above,
  // which stays just above it.
  const unscaledHeight = rawHeight(1);
  const scale = unscaledHeight > available ? Math.max(0.5, available / unscaledHeight) : 1;
  const totalHeight = scale === 1 ? unscaledHeight : rawHeight(scale);

  const leftMargin = 92;
  const rightMargin = PAGE - 70;

  let y = listTop + Math.max(0, (available - totalHeight) / 2);
  for (const row of rows) {
    const isPodium = row.rank <= 3;
    const rowH = (isPodium ? BASE.rowH.podium : BASE.rowH.rest) * scale;
    const badgeR = (isPodium ? BASE.badgeR.podium : BASE.badgeR.rest) * scale;
    const badgeCx = leftMargin + badgeR;
    const badgeCy = y + rowH / 2;
    const numberFontSize = (isPodium ? BASE.numFS.podium : BASE.numFS.rest) * scale;

    // The name is sized to fill most of the available width on the right
    // rather than sitting at one small fixed size — short names render at
    // the tier's max cap (big and prominent), longer names scale down only
    // as far as needed to still occupy the row on one line, never wrapping
    // (which would run into the row below, since rows are one line tall).
    // Estimated at ~0.52x fontSize per character, an average for Roboto Bold.
    const nameX = badgeCx + badgeR + BASE.nameGap * scale;
    const nameWidth = rightMargin - nameX;
    const maxFontSize = (isPodium ? BASE.nameFS.podium : BASE.nameFS.rest) * scale;
    const minFontSize = (isPodium ? BASE.nameFS.min.podium : BASE.nameFS.min.rest) * scale;
    const widthPerUnitFontSize = row.full_name.length * 0.52;
    let nameFontSize = Math.min(maxFontSize, (nameWidth * 0.94) / widthPerUnitFontSize);
    nameFontSize = Math.max(nameFontSize, minFontSize);
    // Defensive: a pathologically long name could still overflow even at the
    // floor size — shrink further rather than let it wrap and overlap.
    if (nameFontSize * widthPerUnitFontSize > nameWidth) {
      nameFontSize = nameWidth / widthPerUnitFontSize;
    }

    if (row.rank === 1) {
      content.push(rectNode(leftMargin - 20 * scale, y - 8 * scale, rightMargin - leftMargin + 40 * scale, rowH + 16 * scale, { color: palette.accent, fillOpacity: 0.12, r: 18 * scale }));
    }

    content.push(
      circleNode(badgeCx, badgeCy, badgeR, isPodium ? { color: MEDAL_COLORS[row.rank] } : { color: palette.band, lineColor: palette.accent, lineWidth: 2 })
    );
    const rankStr = String(row.rank);
    content.push(textNode(rankStr, centeredNumberX(badgeCx, numberFontSize, rankStr.length), badgeCy - numberFontSize / 2, {
      fontSize: numberFontSize, bold: true, color: isPodium ? MEDAL_TEXT_COLOR : palette.accent,
    }));

    content.push(textNode(row.full_name, nameX, badgeCy - nameFontSize / 2, {
      width: nameWidth, alignment: 'left', fontSize: nameFontSize, bold: isPodium, color: '#ffffff',
    }));

    if (!isPodium) {
      content.push(lineNode(leftMargin, y + rowH - 2, rightMargin, y + rowH - 2, { color: palette.accentDim, lineWidth: 0.5 }));
    }

    y += rowH + BASE.gap * scale;
  }

  content.push(textNode('PRESS-FILES', 0, PAGE - 56, { width: PAGE, alignment: 'center', fontSize: 14, bold: true, color: palette.accent, characterSpacing: 2 }));
  content.push(textNode('Attendance & Certification System', 0, PAGE - 36, { width: PAGE, alignment: 'center', fontSize: 11, color: '#EAF0FB' }));

  return {
    pageSize: { width: PAGE, height: PAGE },
    pageMargins: 0,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    content,
  };
}

module.exports = {
  isTeamCategory,
  buildRankingsListDocDefinition,
  // Shared low-level pdfmake node builders, reused by awardsListPdf.js so
  // both "square social-media leaderboard" PDFs stay visually consistent
  // without duplicating the same canvas/text plumbing.
  textNode,
  rectNode,
  lineNode,
  headlineFontSize,
};
