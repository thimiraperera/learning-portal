// Helpers for showing rich-text (HTML) course descriptions as short plain-text
// previews on cards, while the full HTML is rendered elsewhere.

// Strip HTML tags to plain text and decode a few common entities.
export function htmlToText(html) {
  return String(html || "")
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, " ") // block breaks become spaces
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// First `maxWords` words of the plain-text version, with a trailing "..." when
// cut. maxWords of 0 means unlimited: the full description, untruncated.
export function previewWords(html, maxWords) {
  const text = htmlToText(html);
  if (!text) return "";
  if (Number(maxWords) === 0) return text;
  const n = Math.max(1, Number(maxWords) || 60);
  const words = text.split(" ");
  if (words.length <= n) return text;
  return words.slice(0, n).join(" ") + "...";
}
