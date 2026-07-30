// Generates a branded social-media poster (PNG data URL) entirely in the
// browser via Canvas 2D — no server round-trip, so it carries none of the
// deployment risk a server-side image renderer (headless Chrome, node-canvas)
// would on Render's plain Node runtime.

export type PosterFormat = 'square' | 'story';

export interface PosterData {
  fullName: string;
  grade: string;
  section: string;
  categoriesCompleted: string[];
  threshold: number;
}

const NAVY = '#2B6CB0';
const GOLD = '#D6E4F0';
const GOLD_LIGHT = '#E7EEF4';
const WHITE = '#FFFFFF';

const SIZES: Record<PosterFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Packs chip labels into centered rows (like flex-wrap), returning the total
// height consumed so the caller can advance its layout cursor.
function drawChipRows(
  ctx: CanvasRenderingContext2D,
  items: string[],
  centerX: number,
  startY: number,
  maxRowWidth: number
): number {
  const paddingX = 24;
  const chipHeight = 56;
  const gapX = 16;
  const gapY = 16;

  const rows: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const item of items) {
    const w = ctx.measureText(item).width + paddingX * 2;
    const addWidth = current.length ? w + gapX : w;
    if (current.length && currentWidth + addWidth > maxRowWidth) {
      rows.push(current);
      current = [item];
      currentWidth = w;
    } else {
      current.push(item);
      currentWidth += addWidth;
    }
  }
  if (current.length) rows.push(current);

  let y = startY;
  for (const row of rows) {
    const widths = row.map((t) => ctx.measureText(t).width + paddingX * 2);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + gapX * (row.length - 1);
    let x = centerX - totalWidth / 2;
    row.forEach((text, i) => {
      const w = widths[i];
      roundRectPath(ctx, x, y, w, chipHeight, chipHeight / 2);
      ctx.fillStyle = 'rgba(214, 228, 240, 0.16)';
      ctx.fill();
      roundRectPath(ctx, x, y, w, chipHeight, chipHeight / 2);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = GOLD_LIGHT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
      ctx.fillText(text, x + w / 2, y + chipHeight / 2 + 1);
      x += w + gapX;
    });
    y += chipHeight + gapY;
  }
  return y - startY;
}

// Draws the name/grade/badge/category-list block starting at `startY` and
// returns the y position where it ends — called twice (see below) so the
// block can be measured, then re-drawn centered in the taller "story" format
// instead of leaving a large empty gap under a short category list.
function drawContentBlock(ctx: CanvasRenderingContext2D, data: PosterData, width: number, startY: number): number {
  const centerX = width / 2;
  let y = startY;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '600 30px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PRESS-FILES', centerX, y);

  y += 84;
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 68px Georgia, "Times New Roman", serif';
  ctx.fillText('CONGRATULATIONS!', centerX, y);

  y += 96;
  ctx.fillStyle = WHITE;
  ctx.font = 'bold italic 80px Georgia, "Times New Roman", serif';
  const nameLines = wrapWords(ctx, data.fullName, width - 200);
  for (const line of nameLines) {
    ctx.fillText(line, centerX, y);
    y += 90;
  }

  y += 8;
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '400 34px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Grade ${data.grade} - ${data.section}`, centerX, y);

  y += 70;
  const badgeText = `${data.categoriesCompleted.length} of ${data.threshold}+ Categories Completed`;
  ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 64;
  roundRectPath(ctx, centerX - badgeWidth / 2, y - 42, badgeWidth, 60, 30);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.fillText(badgeText, centerX, y);

  y += 90;
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CATEGORIES COMPLETED', centerX, y);

  y += 40;
  if (data.categoriesCompleted.length > 0) {
    y += drawChipRows(ctx, data.categoriesCompleted, centerX, y, width - 200);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 26px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Just getting started!', centerX, y + 20);
    y += 40;
  }

  return y;
}

export function generatePosterDataUrl(data: PosterData, format: PosterFormat): string {
  const { width, height } = SIZES[format];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const footerY = height - 80;
  const topMargin = height * (format === 'square' ? 0.16 : 0.12);

  // Measurement pass (drawn, but the whole canvas gets cleared and redrawn
  // below) — finds how tall the content actually is so it can be centered
  // in the available space instead of leaving a gap under it.
  const measuredEndY = drawContentBlock(ctx, data, width, topMargin);
  const contentHeight = measuredEndY - topMargin;
  const availableHeight = footerY - 60 - topMargin;
  const centerOffset = format === 'story' ? Math.max(0, (availableHeight - contentHeight) / 2) : 0;

  // Background + decorative frame, then the real (possibly re-centered) pass.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, width - 116, height - 116);

  drawContentBlock(ctx, data, width, topMargin + centerOffset);

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '400 24px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR Attendance & Certification System', width / 2, footerY);

  return canvas.toDataURL('image/png');
}
