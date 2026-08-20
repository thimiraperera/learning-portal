/* Professional certificate (Ceylon Exchange Mentoring navy/gold design).
   Ported 1:1 from the supplied certificate.html/CSS: exact fonts (Libre
   Baskerville, embedded), exact colors, exact positions - measured directly
   off a browser-accurate reference render (see project notes). Only the
   recipient name, program name, signer name/title/image, and the date are
   dynamic; every other position/size/color is a literal constant from the
   source design.
   d = { studentName, courseTitle, certProgramName, certSubtitle, certNo,
         issuedText, signerName, signerTitle, signatureImage } */
const path = require("path");
const BG = path.join(__dirname, "assets", "professional-bg.png");
const LOGO = path.join(__dirname, "assets", "professional-logo.png");
const SEAL = path.join(__dirname, "assets", "professional-seal.png");
const FONT_REGULAR = path.join(__dirname, "assets", "fonts", "LibreBaskerville-Regular.ttf");
const FONT_ITALIC = path.join(__dirname, "assets", "fonts", "LibreBaskerville-Italic.ttf");

const GOLD = "#725b31";
const INK = "#010101";
// Measured on this font: pdfkit's text() y-parameter is the top of the line;
// the rendered baseline sits ~0.97x the font size below that top. Used to
// convert the reference design's exact baseline positions into pdfkit's
// top-anchored y-parameter.
const ASCENT_RATIO = 0.97;
const topY = (baseline, size) => baseline - ASCENT_RATIO * size;

// Largest font size (down to minSize) at which text fits on one line.
function fitSize(doc, text, font, maxSize, minSize, maxWidth) {
  doc.font(font);
  let size = maxSize;
  while (size > minSize) { doc.fontSize(size); if (doc.widthOfString(text || "") <= maxWidth) break; size -= 1; }
  return size;
}

module.exports = {
  name: "Professional Certificate",
  render(doc, d) {
    const W = doc.page.width;  // 842
    const H = doc.page.height; // 595
    const cx = W / 2;          // 421

    doc.registerFont("LB-Regular", FONT_REGULAR);
    doc.registerFont("LB-Italic", FONT_ITALIC);

    doc.image(BG, 0, 0, { width: W, height: H });
    doc.image(LOGO, 341.25, 57.0, { width: 159, height: 56.25 });

    // Title.
    doc.font("LB-Regular").fontSize(48.75).fillColor(GOLD)
      .text("Professional Certificate", 0, topY(174.75, 48.75), { width: W, align: "center", lineBreak: false });

    // Subtitle, with fixed decorative gold rules either side (exact positions
    // from the source design - these do not move with subtitle text length).
    const subtitle = d.certSubtitle || "In Stock Market Investments";
    const subtitleSize = fitSize(doc, subtitle, "LB-Regular", 23.25, 12, 355.5);
    doc.font("LB-Regular").fontSize(subtitleSize).fillColor(INK)
      .text(subtitle, 0, topY(221.25, subtitleSize), { width: W, align: "center", lineBreak: false });
    doc.save().lineWidth(1.5).strokeColor(GOLD)
      .moveTo(171.75, 213.75).lineTo(236.25, 213.75).stroke()
      .moveTo(606.0, 213.75).lineTo(669.75, 213.75).stroke()
      .restore();

    // "This is to certify that"
    doc.font("LB-Regular").fontSize(16.91).fillColor(INK)
      .text("This is to certify that", 0, topY(260.25, 16.91), { width: W, align: "center", lineBreak: false });

    // Recipient name, shrunk to fit one line only if it would overflow, with
    // a gold rule sized to the design's fixed 90mm minimum (grows for a name
    // wider than that, exactly like the source design's flex min-width).
    const name = d.studentName || "";
    const nameSize = fitSize(doc, name, "LB-Regular", 16.91, 10, W * 0.85);
    doc.font("LB-Regular").fontSize(nameSize).fillColor(INK)
      .text(name, 0, topY(291.75, nameSize), { width: W, align: "center", lineBreak: false });
    const nameLineW = Math.max(255.1, doc.widthOfString(name));
    doc.save().lineWidth(1.5).strokeColor(GOLD)
      .moveTo(cx - nameLineW / 2, 303.0).lineTo(cx + nameLineW / 2, 303.0).stroke().restore();

    // "has successfully completed and met the required standards in the"
    doc.font("LB-Regular").fontSize(16.91).fillColor(INK)
      .text("has successfully completed and met the required standards in the", 0, topY(330.75, 16.91), { width: W, align: "center", lineBreak: false });

    // Program name (course title, or the admin override), shrunk to fit one line.
    const program = d.certProgramName || d.courseTitle || "";
    const programSize = fitSize(doc, program, "LB-Regular", 22.62, 12, W * 0.9);
    doc.font("LB-Regular").fontSize(programSize).fillColor(INK)
      .text(program, 0, topY(364.5, programSize), { width: W, align: "center", lineBreak: false });

    // Assessment line, italic, above a full-width gold rule.
    doc.save().lineWidth(1.5).strokeColor(GOLD).moveTo(98.25, 383.25).lineTo(743.25, 383.25).stroke().restore();
    doc.font("LB-Italic").fontSize(15.45).fillColor(INK)
      .text("Including assessment and evaluation of investment knowledge and practical understanding", 0, topY(409.5, 15.45), { width: W, align: "center", lineBreak: false });

    // ---- Signature row: two blocks, each sized to its own content (min
    // 58mm/164.25pt, exactly like the source design), row centered on the page. ----
    const signerName = d.signerName || "";
    const signerTitle = d.signerTitle || "";
    const issuedText = d.issuedText || "";
    const GAP = 42.75;
    doc.font("LB-Regular").fontSize(13.99);
    const nameW = doc.widthOfString(signerName);
    doc.font("LB-Italic").fontSize(12.0);
    const titleW = doc.widthOfString(signerTitle);
    doc.font("LB-Regular").fontSize(13.99);
    const dateW = doc.widthOfString(issuedText);

    const leftBlockW = Math.max(164.25, nameW, titleW);
    const rightBlockW = Math.max(164.25, dateW);
    const rowX0 = cx - (leftBlockW + GAP + rightBlockW) / 2;
    const leftX = rowX0, leftCenter = leftX + leftBlockW / 2;
    const rightX = leftX + leftBlockW + GAP, rightCenter = rightX + rightBlockW / 2;
    const lineY = 477.75; // exact center of the source design's signature rules

    // Signature image sits on top of the line, just like a pen signature
    // would (mirrored below for the date, per instruction).
    if (d.signatureImage) {
      const sigH = 32;
      try {
        doc.image(d.signatureImage, leftCenter - leftBlockW / 2, lineY - 1.5 - sigH - 3, { fit: [leftBlockW, sigH], align: "center" });
      } catch { /* bad/unreadable image data: skip it rather than fail the whole PDF */ }
    }
    // The date sits on top of its line, the same way a signature does.
    doc.font("LB-Regular").fontSize(13.99).fillColor(INK)
      .text(issuedText, rightX, topY(lineY - 1.5 - 8, 13.99), { width: rightBlockW, align: "center", lineBreak: false });

    doc.save().lineWidth(1.5).strokeColor(INK)
      .moveTo(leftX, lineY).lineTo(leftX + leftBlockW, lineY).stroke()
      .moveTo(rightX, lineY).lineTo(rightX + rightBlockW, lineY).stroke()
      .restore();

    doc.font("LB-Regular").fontSize(13.99).fillColor(INK)
      .text(signerName, leftX, topY(499.5, 13.99), { width: leftBlockW, align: "center", lineBreak: false });
    doc.font("LB-Italic").fontSize(12.0).fillColor(INK)
      .text(signerTitle, leftX, topY(513.0, 12.0), { width: leftBlockW, align: "center", lineBreak: false });
    // "Date of Issue" caption below the line, mirroring the signer name/title caption.
    doc.font("LB-Regular").fontSize(13.99).fillColor(INK)
      .text("Date of Issue", rightX, topY(499.5, 13.99), { width: rightBlockW, align: "center", lineBreak: false });

    // Seal.
    doc.image(SEAL, 660.75, 426.0, { width: 124.5, height: 123.75 });

    // Certificate number, subtle, bottom-centre (app metadata, not part of the source design).
    doc.fillColor("#9a9a9a").font("LB-Regular").fontSize(8)
      .text(`Certificate No: ${d.certNo || ""}`, 0, H - 22, { width: W, align: "center" });
  },
};
