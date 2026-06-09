/* Client-side image processing for uploads.
   Validates the file (image, <= 1 MB), resizes to maxWidth keeping aspect
   ratio, and returns a WebP data URL. */
export function resizeToWebp(file, maxWidth = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file (PNG, JPG, WebP)."));
    if (file.size > 1024 * 1024) return reject(new Error("Image must be 1 MB or smaller."));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = () => reject(new Error("Could not read the image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
