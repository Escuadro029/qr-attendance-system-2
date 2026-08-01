// Bulk poster export — posters are pure client-side Canvas 2D PNGs (see
// poster.ts) with no backend counterpart, so "print all" packages every
// generated PNG into a single .zip the browser downloads in one go.
import JSZip from 'jszip';
import { generatePosterDataUrl, PosterData, PosterFormat } from './poster';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export interface PosterZipItem {
  fileNameBase: string;
  data: PosterData;
}

export async function generatePosterZipBlob(items: PosterZipItem[], format: PosterFormat): Promise<Blob> {
  const zip = new JSZip();
  for (const item of items) {
    const dataUrl = generatePosterDataUrl(item.data, format);
    zip.file(`${item.fileNameBase}-${format}.png`, dataUrlToBlob(dataUrl));
  }
  return zip.generateAsync({ type: 'blob' });
}
