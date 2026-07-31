// Crops an uploaded image client-side into a perfect circle that fully
// fills its frame — the source image is scaled to "cover" the circle (like
// CSS object-fit: cover), cropping any overflow rather than stretching the
// image or leaving empty space, so a logo never comes out warped/oval
// regardless of the uploaded photo's own aspect ratio. Always exported as
// PNG (regardless of the source format) so the transparent ring outside the
// circle is preserved when printed. Shared by the certificate designer's
// logo upload and Certificate Settings' school logo upload.
export function cropImageToCoverCircle(file: File, maxDim = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxDim;
        canvas.height = maxDim;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));

        ctx.save();
        ctx.beginPath();
        ctx.arc(maxDim / 2, maxDim / 2, maxDim / 2, 0, Math.PI * 2);
        ctx.clip();

        const coverScale = Math.max(maxDim / image.width, maxDim / image.height);
        const drawWidth = image.width * coverScale;
        const drawHeight = image.height * coverScale;
        ctx.drawImage(image, (maxDim - drawWidth) / 2, (maxDim - drawHeight) / 2, drawWidth, drawHeight);
        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
