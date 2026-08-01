// Square, social-media-style leaderboard for award-based categories (Radio
// Broadcasting, Scriptwriting) — same visual language as rankingsListPdf.js,
// but each section is one named AWARD (e.g. "Champion", "Best News Anchor")
// that can list one or several students, instead of one student per rank.
const { isTeamCategory, textNode, rectNode, lineNode, headlineFontSize } = require('./rankingsListPdf');

const PAGE = 1000;
const MEDAL_COLORS = { gold: '#F5D061', silver: '#D9DEE3', bronze: '#D8A15C' };

const PALETTES = {
  journalism: { bg: '#0c1a3a', band: '#173a8c', accent: '#F5D061', accentDim: '#5b6ea8' },
  team: { bg: '#241203', band: '#7a3f0a', accent: '#FFCE7A', accentDim: '#a87840' },
};

// Awards named "Best .../Champion", "Better .../1st Runner-up", and
// "Good .../2nd Runner-up" are each some category's top/middle/bottom tier —
// color them gold/silver/bronze the same way the numeric leaderboard colors
// 1st/2nd/3rd place, so the visual language stays consistent across both.
function tierColor(label, accent) {
  if (/^(Best\b|Champion)/i.test(label)) return MEDAL_COLORS.gold;
  if (/^(Better\b|1st Runner-up)/i.test(label)) return MEDAL_COLORS.silver;
  if (/^(Good\b|2nd Runner-up)/i.test(label)) return MEDAL_COLORS.bronze;
  return accent;
}

// Estimates how many lines a block of text will wrap to at a given font
// size/width, using the same average-glyph-width heuristic used elsewhere
// in this codebase — needed to budget vertical space for each award section
// up front, since pdfmake absolutely-positioned nodes don't reflow.  Errs on
// the side of predicting MORE lines than the real render (a slightly taller
// glyph-width factor) so a section never ends up shorter than what pdfmake
// actually draws, which would run into the section below it.
function estimateLineCount(text, fontSize, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const glyphWidth = fontSize * 0.58;
  const spaceWidth = fontSize * 0.3;
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const wordWidth = word.length * glyphWidth;
    const addWidth = lineWidth > 0 ? wordWidth + spaceWidth : wordWidth;
    if (lineWidth > 0 && lineWidth + addWidth > maxWidth) {
      lines++;
      lineWidth = wordWidth;
    } else {
      lineWidth += addWidth;
    }
  }
  return lines;
}

const LINE_FACTOR = 1.2;
const BASE = { labelFS: 18, nameFS: 24, labelGap: 6, sectionGap: 16 };

function buildAwardsListDocDefinition({ categoryName, awardGroups, eventName, dateRange, venue }) {
  const isTeam = isTeamCategory(categoryName);
  const palette = isTeam ? PALETTES.team : PALETTES.journalism;
  const content = [];

  const bandHeight = 260;
  content.push(rectNode(0, 0, PAGE, PAGE, { color: palette.bg }));
  content.push(rectNode(0, 0, PAGE, bandHeight, { color: palette.band }));
  content.push(rectNode(0, bandHeight - 6, PAGE, 6, { color: palette.accent }));
  content.push(rectNode(24, 24, PAGE - 48, PAGE - 48, { lineColor: palette.accent, lineWidth: 3 }));
  content.push(rectNode(38, 38, PAGE - 76, PAGE - 76, { lineColor: palette.accentDim, lineWidth: 1 }));

  content.push(textNode((eventName || 'School Press Conference').toUpperCase(), 0, 48, {
    width: PAGE, alignment: 'center', fontSize: 15, color: '#EAF0FB', characterSpacing: 1,
  }));
  content.push(textNode((categoryName || '').toUpperCase(), 0, 86, {
    width: PAGE, alignment: 'center', fontSize: headlineFontSize(categoryName), bold: true, color: '#ffffff',
  }));
  content.push(textNode('AWARDS', 0, 164, {
    width: PAGE, alignment: 'center', fontSize: 17, bold: true, color: palette.accent, characterSpacing: 2,
  }));
  const metaLine = [dateRange, venue].filter(Boolean).join('   •   ');
  if (metaLine) {
    content.push(textNode(metaLine, 0, 196, { width: PAGE, alignment: 'center', fontSize: 13, color: '#EAF0FB' }));
  }

  const leftMargin = 70;
  const rightMargin = PAGE - 70;
  const textWidth = rightMargin - leftMargin;
  const listTop = bandHeight + 30;
  const listBottom = PAGE - 90;
  const available = listBottom - listTop;

  // Two-pass measurement (same shape as rankingsListPdf.js's auto-fit): find
  // how tall everything is at full scale, then shrink uniformly if it would
  // overflow past the footer — pdfmake force-paginates absolutely positioned
  // text once it's positioned close enough to the bottom that its own line
  // doesn't fit, so the layout must fit on its own rather than relying on
  // absolutePosition to bypass overflow.
  function measure(scale) {
    const sections = awardGroups.map((group) => {
      const nameText = group.students.join('   •   ');
      const labelFS = BASE.labelFS * scale;
      const nameFS = BASE.nameFS * scale;
      const lines = estimateLineCount(nameText, nameFS, textWidth);
      const sectionHeight = labelFS * LINE_FACTOR + BASE.labelGap * scale + lines * nameFS * LINE_FACTOR;
      return { group, nameText, labelFS, nameFS, sectionHeight };
    });
    const total = sections.reduce((sum, s) => sum + s.sectionHeight, 0) + Math.max(0, sections.length - 1) * BASE.sectionGap * scale;
    return { total, sections };
  }

  const unscaled = measure(1);
  const scale = unscaled.total > available ? Math.max(0.5, available / unscaled.total) : 1;
  const { total: totalHeight, sections } = scale === 1 ? unscaled : measure(scale);

  let y = listTop + Math.max(0, (available - totalHeight) / 2);
  for (const { group, nameText, labelFS, nameFS, sectionHeight } of sections) {
    content.push(textNode(group.label.toUpperCase(), leftMargin, y, {
      width: textWidth, fontSize: labelFS, bold: true, color: tierColor(group.label, palette.accent), characterSpacing: 1,
    }));
    const nameY = y + labelFS * LINE_FACTOR + BASE.labelGap * scale;
    content.push(textNode(nameText, leftMargin, nameY, {
      width: textWidth, fontSize: nameFS, bold: true, color: '#ffffff',
    }));
    const dividerY = y + sectionHeight + (BASE.sectionGap * scale) / 2;
    content.push(lineNode(leftMargin, dividerY, rightMargin, dividerY, { color: palette.accentDim, lineWidth: 0.5 }));
    y += sectionHeight + BASE.sectionGap * scale;
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

module.exports = { buildAwardsListDocDefinition };
