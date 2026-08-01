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
// height consumed so the caller can advance its layout cursor. `scale` lets
// the caller shrink chip size/spacing uniformly when there isn't room.
function drawChipRows(
  ctx: CanvasRenderingContext2D,
  items: string[],
  centerX: number,
  startY: number,
  maxRowWidth: number,
  scale = 1
): number {
  const paddingX = 24 * scale;
  const chipHeight = 56 * scale;
  const gapX = 16 * scale;
  const gapY = 16 * scale;
  const font = `600 ${Math.round(26 * scale)}px "Segoe UI", Arial, sans-serif`;
  ctx.font = font;

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
      ctx.font = font;
      ctx.fillText(text, x + w / 2, y + chipHeight / 2 + 1);
      x += w + gapX;
    });
    y += chipHeight + gapY;
  }
  return y - startY;
}

// Draws the name/grade/badge/category-list block starting at `startY` and
// returns the y position where it ends — called at least twice (see below)
// so the block can be measured, then re-drawn at whatever `scale` keeps it
// inside the canvas, centered in the taller "story" format instead of
// leaving a large empty gap under a short category list.
function drawContentBlock(
  ctx: CanvasRenderingContext2D,
  data: PosterData,
  width: number,
  startY: number,
  scale = 1
): number {
  const centerX = width / 2;
  let y = startY;
  const s = (n: number) => Math.round(n * scale);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `600 ${s(30)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText('PRESS-FILES', centerX, y);

  y += s(84);
  ctx.fillStyle = GOLD;
  ctx.font = `bold ${s(68)}px Georgia, "Times New Roman", serif`;
  ctx.fillText('CONGRATULATIONS!', centerX, y);

  y += s(96);
  ctx.fillStyle = WHITE;
  ctx.font = `bold italic ${s(80)}px Georgia, "Times New Roman", serif`;
  const nameLines = wrapWords(ctx, data.fullName, width - 200);
  for (const line of nameLines) {
    ctx.fillText(line, centerX, y);
    y += s(90);
  }

  y += s(8);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `400 ${s(34)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(`Grade ${data.grade} - ${data.section}`, centerX, y);

  y += s(70);
  const badgeText = `${data.categoriesCompleted.length} of ${data.threshold}+ Categories Completed`;
  ctx.font = `700 ${s(30)}px "Segoe UI", Arial, sans-serif`;
  const badgeWidth = ctx.measureText(badgeText).width + s(64);
  roundRectPath(ctx, centerX - badgeWidth / 2, y - s(42), badgeWidth, s(60), s(30));
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.fillText(badgeText, centerX, y);

  y += s(90);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `600 ${s(28)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText('CATEGORIES COMPLETED', centerX, y);

  y += s(40);
  if (data.categoriesCompleted.length > 0) {
    y += drawChipRows(ctx, data.categoriesCompleted, centerX, y, width - 200, scale);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `400 ${s(26)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText('Just getting started!', centerX, y + s(20));
    y += s(40);
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
  const availableHeight = footerY - 60 - topMargin;

  // Measurement pass at full scale (drawn, but the whole canvas gets cleared
  // and redrawn below) — finds how tall the content actually is. A long name
  // or a long completed-categories list can be taller than the available
  // space, so if it overflows, shrink font sizes/spacing uniformly (down to
  // 55%) rather than letting the content run into the footer or get clipped.
  const measuredHeight = drawContentBlock(ctx, data, width, topMargin) - topMargin;
  const scale = measuredHeight > availableHeight ? Math.max(0.55, availableHeight / measuredHeight) : 1;
  const contentHeight = scale === 1 ? measuredHeight : drawContentBlock(ctx, data, width, topMargin, scale) - topMargin;
  const centerOffset = format === 'story' ? Math.max(0, (availableHeight - contentHeight) / 2) : 0;

  // Background + decorative frame, then the real (possibly re-centered) pass.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, width - 116, height - 116);

  drawContentBlock(ctx, data, width, topMargin + centerOffset, scale);

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = '400 24px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR Attendance & Certification System', width / 2, footerY);

  return canvas.toDataURL('image/png');
}
