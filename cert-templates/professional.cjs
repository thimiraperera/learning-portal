/* Professional certificate (Ceylon Exchange Mentoring navy/gold design).
   Full-page decorative border background, with the logo, headings, seal and
   all dynamic fields drawn on top with pdfkit.
   d = { studentName, courseTitle, certProgramName, certNo, issuedText,
         signerName, signerTitle, signatureImage } */
const path = require("path");
const BG = path.join(__dirname, "assets", "professional-bg.png");
const LOGO = path.join(__dirname, "assets", "professional-logo.png");
const SEAL = path.join(__dirname, "assets", "professional-seal.png");

const GOLD = "#725b31";
const INK = "#111111";

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
    const padSide = 99.21;
    const contentX = padSide;
    const contentW = W - padSide * 2;
    const cx = W / 2;

    doc.image(BG, 0, 0, { width: W, height: H });

    let y = 54;

    // Logo (centered, fixed height, aspect-correct width).
    const logoH = 54;
    const logoW = logoH * (669 / 238);
    doc.image(LOGO, cx - logoW / 2, y, { width: logoW, height: logoH });
    y += logoH + 13;

    // Title.
    doc.font("Times-Roman").fontSize(41).fillColor(GOLD);
    doc.text("Professional Certificate", contentX, y, { width: contentW, align: "center", lineBreak: false });
    y += doc.currentLineHeight() + 8;

    // Subtitle, with short decorative rules hugging either side of the text.
    const subtitle = "In Stock Market Investments";
    doc.font("Times-Roman").fontSize(21).fillColor(INK);
    const subH = doc.currentLineHeight();
    const subW = doc.widthOfString(subtitle);
    doc.text(subtitle, contentX, y, { width: contentW, align: "center", lineBreak: false });
    const lineY = y + subH / 2;
    const subGap = 16, subLineLen = 46;
    doc.save().lineWidth(1.4).strokeColor(GOLD)
      .moveTo(cx - subW / 2 - subGap - subLineLen, lineY).lineTo(cx - subW / 2 - subGap, lineY).stroke()
      .moveTo(cx + subW / 2 + subGap, lineY).lineTo(cx + subW / 2 + subGap + subLineLen, lineY).stroke()
      .restore();
    y += subH + 13;

    // "This is to certify that"
    doc.font("Times-Roman").fontSize(14).fillColor(INK);
    doc.text("This is to certify that", contentX, y, { width: contentW, align: "center", lineBreak: false });
    y += doc.currentLineHeight() + 10;

    // Recipient name, shrunk to fit one line, with a bottom rule sized to the
    // text itself (at least as wide as the "Recipient Name" sample slot).
    const name = d.studentName || "";
    const nameSize = fitSize(doc, name, "Times-Roman", 22, 13, contentW * 0.85);
    doc.font("Times-Roman").fontSize(nameSize).fillColor(INK);
    const nameH = doc.currentLineHeight();
    const nameW = Math.max(180, doc.widthOfString(name) + 24);
    doc.text(name, contentX, y, { width: contentW, align: "center", lineBreak: false });
    const nameLineY = y + nameH + 4;
    doc.save().lineWidth(1.2).strokeColor(GOLD)
      .moveTo(cx - nameW / 2, nameLineY).lineTo(cx + nameW / 2, nameLineY).stroke().restore();
    y = nameLineY + 12;

    // "has successfully completed..." (wraps if needed).
    doc.font("Times-Roman").fontSize(14).fillColor(INK);
    const line2 = "has successfully completed and met the required standards in the";
    doc.text(line2, contentX, y, { width: contentW, align: "center" });
    y += doc.heightOfString(line2, { width: contentW, align: "center" }) + 8;

    // Program name (course title, or the admin override), shrunk to fit one line.
    const program = d.certProgramName || d.courseTitle || "";
    const programSize = fitSize(doc, program, "Times-Roman", 19, 12, contentW * 0.85);
    doc.font("Times-Roman").fontSize(programSize).fillColor(INK);
    doc.text(program, contentX, y, { width: contentW, align: "center", lineBreak: false });
    y += doc.currentLineHeight() + 12;

    // Assessment line, italic, above a gold rule, shrunk to fit one line.
    const assessText = "Including assessment and evaluation of investment knowledge and practical understanding";
    doc.save().lineWidth(1.2).strokeColor(GOLD).moveTo(contentX, y).lineTo(contentX + contentW, y).stroke().restore();
    y += 10;
    const assessSize = fitSize(doc, assessText, "Times-Italic", 13, 9, contentW);
    doc.font("Times-Italic").fontSize(assessSize).fillColor(INK);
    doc.text(assessText, contentX, y, { width: contentW, align: "center", lineBreak: false });

    // ---- Signature row, anchored to the bottom of the page ----
    const blockW = 164;
    const gap = 42;
    const rowX = cx - (blockW * 2 + gap) / 2;
    const leftX = rowX, rightX = rowX + blockW + gap;
    const borderY = 478;

    // Signature image sits just above the left block's rule, if configured.
    if (d.signatureImage) {
      const sigH = 32;
      try {
        doc.image(d.signatureImage, leftX, borderY - sigH - 4, { fit: [blockW, sigH], align: "center" });
      } catch { /* bad/unreadable image data: skip it rather than fail the whole PDF */ }
    }

    doc.save().lineWidth(1.2).strokeColor(INK)
      .moveTo(leftX, borderY).lineTo(leftX + blockW, borderY).stroke()
      .moveTo(rightX, borderY).lineTo(rightX + blockW, borderY).stroke()
      .restore();

    const signerName = d.signerName || "";
    const signerTitle = d.signerTitle || "";
    doc.font("Times-Roman").fontSize(12).fillColor(INK)
      .text(signerName, leftX, borderY + 7, { width: blockW, align: "center", lineBreak: false });
    doc.font("Times-Italic").fontSize(10).fillColor(INK)
      .text(signerTitle, leftX, borderY + 7 + doc.currentLineHeight(), { width: blockW, align: "center", lineBreak: false });

    doc.font("Times-Roman").fontSize(12).fillColor(INK)
      .text(d.issuedText || "", rightX, borderY + 7, { width: blockW, align: "center", lineBreak: false });

    // Seal, bottom-right corner.
    const sealW = 108;
    const sealH = sealW * (544 / 546);
    doc.image(SEAL, W - 50 - sealW, H - 40 - sealH, { width: sealW, height: sealH });

    // Certificate number, subtle, bottom-centre.
    doc.fillColor("#9a9a9a").font("Times-Roman").fontSize(8)
      .text(`Certificate No: ${d.certNo || ""}`, 0, H - 22, { width: W, align: "center" });
  },
};
