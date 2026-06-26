/* Client-side image processing for uploads.
   Validates the file (image, <= 1 MB), resizes to maxWidth keeping aspect
   ratio, and returns a WebP data URL. */
export function resizeToWebp(file, maxWidth = 256, quality = 0.85, square = false) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file (PNG, JPG, WebP)."));
    if (file.size > 2 * 1024 * 1024) return reject(new Error("Image must be 2 MB or smaller."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (square) {
          // Fixed maxWidth x maxWidth canvas, image fit-contained and centred
          // (used for the favicon, which always renders square).
          const size = maxWidth;
          canvas.width = size; canvas.height = size;
          const scale = Math.min(size / img.width, size / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
        } else {
          const scale = Math.min(1, maxWidth / img.width);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = () => reject(new Error("Could not read the image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/* Resize a PNG/JPG to a PNG data URL (keeps transparency). Used for the email
   header logo: WebP is unreliable in email clients, so we only accept and emit
   PNG/JPG. Output is always PNG so logos with transparency look right on the
   email's dark header. */
export function resizeToPng(file, maxWidth = 480) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) return reject(new Error("Please choose a PNG or JPG image (not WebP)."));
    if (file.size > 1024 * 1024) return reject(new Error("Image must be 1 MB or smaller."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not read the image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
