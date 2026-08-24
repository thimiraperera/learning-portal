/* Certificate of Completion (Ceylon Exchange Mentoring workshop design).
   Ported 1:1 from the supplied certificate.html/CSS: exact fonts (Playfair
   Display + Montserrat, embedded), exact colors, exact positions. The source
   lays everything out in millimetres on a 297x210mm sheet, so every number
   below is a millimetre straight out of that CSS, run through MM to reach
   pdfkit points. Only the recipient name, course/program name, subtitle,
   brand name, signer name/title/image and the date are dynamic.
   d = { studentName, courseTitle, certProgramName, certSubtitle, certNo,
         issuedText, signerName, signerTitle, signatureImage, brandName } */
const path = require("path");
const PAPER = path.join(__dirname, "assets", "workshop-paper.png");
const WATERMARK = path.join(__dirname, "assets", "workshop-watermark.png");
const CORNER_TL = path.join(__dirname, "assets", "workshop-corner-tl.png");
const CORNER_BR = path.join(__dirname, "assets", "workshop-corner-br.png");
const LOGO = path.join(__dirname, "assets", "workshop-logo-cem.png");
const FONT_PF_BOLD = path.join(__dirname, "assets", "fonts", "PlayfairDisplay-Bold.ttf");
const FONT_PF_SEMI = path.join(__dirname, "assets", "fonts", "PlayfairDisplay-SemiBold.ttf");
const FONT_MS_REGULAR = path.join(__dirname, "assets", "fonts", "Montserrat-Regular.ttf");
const FONT_MS_MEDIUM = path.join(__dirname, "assets", "fonts", "Montserrat-Medium.ttf");
const FONT_MS_BOLD = path.join(__dirname, "assets", "fonts", "Montserrat-Bold.ttf");

const INK = "#0C1A45";
const INK_SOFT = "#2E3548";
const BRAND = "#1553BD";
const GOLD = "#B8892F";
const GOLD_DEEP = "#7A5518";
const GOLD_LITE = "#F0CE86";
const COPPER = "#C07A2E";

const MM = 2.8346456693;
const mm = (v) => v * MM;

const PAGE_W = 297;   // mm
const PAGE_H = 210;   // mm
const CX = PAGE_W / 2;
const WATERMARK_OPACITY = 0.4; // source: --wm-op .4

// Measured on these fonts: pdfkit's text() y-parameter is the top of the glyph
// box; the rendered baseline sits ASCENT_RATIO x the font size below that top.
// Same conversion professional.cjs uses, just with a ratio per family.
const ASCENT_RATIO = { pf: 1.082, ms: 0.968 };
const DESCENT_RATIO = { pf: 0.251, ms: 0.251 };
const topY = (baseline, size, fam) => baseline - ASCENT_RATIO[fam] * size;

// The source design pins the TOP of each CSS line box. CSS centres the glyph
// box inside the line box, so half the leading sits between the two; this
// turns a box top in mm into the pdfkit y-parameter in points.
function lineTop(topMm, sizeMm, lh, fam) {
  const size = mm(sizeMm);
  const glyphBox = (ASCENT_RATIO[fam] + DESCENT_RATIO[fam]) * size;
  const baseline = mm(topMm) + (lh * size - glyphBox) / 2 + ASCENT_RATIO[fam] * size;
  return topY(baseline, size, fam);
}

// Largest font size in mm (down to minMm) at which text fits on one line.
function fitSize(doc, text, font, maxMm, minMm, maxWidthMm, csEm) {
  doc.font(font);
  let sizeMm = maxMm;
  while (sizeMm > minMm) {
    doc.fontSize(mm(sizeMm));
    if (runWidth(doc, text, csEm, sizeMm) <= maxWidthMm) break;
    sizeMm -= 0.25;
  }
  return sizeMm;
}

// Width in mm of the inked run, i.e. what the eye sees: glyph advances plus
// the letter-spacing BETWEEN glyphs, with no trailing gap after the last one.
function runWidth(doc, text, csEm, sizeMm) {
  return doc.widthOfString(text || "", { characterSpacing: (csEm || 0) * mm(sizeMm) }) / MM;
}

// One centred line. pdfkit's align:"center" measures the run with a trailing
// letter-space after the final glyph, which drags a spaced word left by half a
// space; the source cancels the same thing with text-indent, so x is worked
// out here from the run's true width instead.
function centred(doc, text, cxMm, y, csEm, sizeMm) {
  const t = text || "";
  if (!t) return;
  const cs = (csEm || 0) * mm(sizeMm);
  doc.text(t, mm(cxMm) - mm(runWidth(doc, t, csEm, sizeMm)) / 2, y, { lineBreak: false, characterSpacing: cs });
}

// A gold rule drawn as a filled bar, x0 -> x1, with [offset, opacity] stops
// along that direction so it can fade out at whichever end the source fades.
function goldRule(doc, x0Mm, x1Mm, cyMm, thickMm, stops) {
  const g = doc.linearGradient(mm(x0Mm), mm(cyMm), mm(x1Mm), mm(cyMm));
  for (const [offset, alpha] of stops) g.stop(offset, GOLD, alpha);
  const left = Math.min(x0Mm, x1Mm);
  doc.save()
    .rect(mm(left), mm(cyMm - thickMm / 2), mm(Math.abs(x1Mm - x0Mm)), mm(thickMm))
    .fill(g)
    .restore();
}

module.exports = {
  name: "Certificate of Completion",
  render(doc, d) {
    doc.registerFont("PF-Bold", FONT_PF_BOLD);
    doc.registerFont("PF-Semi", FONT_PF_SEMI);
    doc.registerFont("MS-Regular", FONT_MS_REGULAR);
    doc.registerFont("MS-Medium", FONT_MS_MEDIUM);
    doc.registerFont("MS-Bold", FONT_MS_BOLD);

    const brandName = d.brandName || "Ceylon Exchange Mentoring";

    // ---- Background artwork, stacked bottom to top like the source. ----
    doc.image(PAPER, 0, 0, { width: mm(PAGE_W), height: mm(PAGE_H) });
    doc.save().opacity(WATERMARK_OPACITY)
      .image(WATERMARK, 0, 0, { width: mm(PAGE_W), height: mm(PAGE_H) })
      .restore().opacity(1);

    // Corner ornaments. Both PNGs are 1134x1181, so height follows from the
    // width the source sets. The bottom-right one is pushed 1.95mm past the
    // bottom edge to cancel the transparent margin baked into that image; the
    // page clips the overhang.
    const CORNER_AR = 1134 / 1181;
    doc.image(CORNER_TL, 0, 0, { width: mm(99), height: mm(99 / CORNER_AR) });
    const brH = 104 / CORNER_AR;
    doc.image(CORNER_BR, mm(PAGE_W - 104), mm(PAGE_H + 1.95 - brH), { width: mm(104), height: mm(brH) });

    // ---- Thin gold frame and the four copper brackets. ----
    const frameGrad = doc.linearGradient(mm(4), mm(4), mm(293), mm(206));
    frameGrad.stop(0, GOLD).stop(0.28, GOLD_LITE).stop(0.55, GOLD).stop(0.8, GOLD_LITE).stop(1, GOLD);
    doc.save().lineWidth(mm(0.38)).strokeColor(frameGrad)
      .rect(mm(4), mm(4), mm(289), mm(202)).stroke().restore();

    doc.save().lineWidth(mm(0.5)).lineCap("square").strokeColor(COPPER)
      .moveTo(mm(5.6), mm(12)).lineTo(mm(5.6), mm(5.6)).lineTo(mm(12), mm(5.6)).stroke()
      .moveTo(mm(285), mm(5.6)).lineTo(mm(291.4), mm(5.6)).lineTo(mm(291.4), mm(12)).stroke()
      .moveTo(mm(291.4), mm(198)).lineTo(mm(291.4), mm(204.4)).lineTo(mm(285), mm(204.4)).stroke()
      .moveTo(mm(12), mm(204.4)).lineTo(mm(5.6), mm(204.4)).lineTo(mm(5.6), mm(198)).stroke()
      .restore();

    // ---- 1. Logo (450x165), 21.5mm tall, centred in the source's 23mm box. ----
    const logoH = 21.5;
    const logoW = logoH * (450 / 165);
    doc.image(LOGO, mm((PAGE_W - logoW) / 2), mm(11.4 + (23 - logoH) / 2), { width: mm(logoW), height: mm(logoH) });

    // ---- 2. "CERTIFICATE" ----
    doc.font("PF-Bold").fontSize(mm(19.2)).fillColor(INK);
    centred(doc, "CERTIFICATE", CX, lineTop(43.75, 19.2, 1, "pf"), 0.161, 19.2);

    // ---- 3. Subtitle between two gold rules, the row centred on the page. ----
    const subtitle = d.certSubtitle || "OF COMPLETION";
    const subSize = fitSize(doc, subtitle, "MS-Bold", 6.9, 3.5, 150, 0.113);
    doc.font("MS-Bold").fontSize(mm(subSize)).fillColor(BRAND);
    const subCy = 66.2 + 8 / 2; // the source centres the row in an 8mm box
    centred(doc, subtitle, CX, lineTop(subCy - subSize / 2, subSize, 1, "ms"), 0.113, subSize);
    const subHalf = runWidth(doc, subtitle, 0.113, subSize) / 2;
    goldRule(doc, CX - subHalf - 4.3 - 34, CX - subHalf - 4.3, subCy, 0.42, [[0, 0.12], [0.18, 1], [1, 1]]);
    goldRule(doc, CX + subHalf + 4.3 + 34, CX + subHalf + 4.3, subCy, 0.42, [[0, 0.12], [0.18, 1], [1, 1]]);

    // ---- 4. "THIS IS TO CERTIFY THAT" ----
    doc.font("MS-Regular").fontSize(mm(4.6)).fillColor(INK_SOFT);
    centred(doc, "THIS IS TO CERTIFY THAT", CX, lineTop(80.4, 4.6, 1, "ms"), 0.10, 4.6);

    // ---- 5. Recipient name, shrunk to stay on one line. The source anchors it
    // to the BOTTOM of a 90mm/22.5mm box so it keeps the same short distance
    // above the divider whatever size it ends up at. ----
    const name = d.studentName || "";
    const nameSize = fitSize(doc, name, "PF-Semi", 10, 4.5, 251, 0.012);
    const nameBoxBottom = 90 + 22.5;
    doc.font("PF-Semi").fontSize(mm(nameSize)).fillColor(INK);
    centred(doc, name, CX, lineTop(nameBoxBottom - 1.1 * nameSize, nameSize, 1.1, "pf"), 0.012, nameSize);

    // ---- 6. Gold divider: two fading rules either side of a small diamond. ----
    const divCy = 114.6 + 5 / 2;
    goldRule(doc, CX - 2.5 / 2 - 4 - 78, CX - 2.5 / 2 - 4, divCy, 0.34, [[0, 0], [0.6, 1], [1, 1]]);
    goldRule(doc, CX + 2.5 / 2 + 4 + 78, CX + 2.5 / 2 + 4, divCy, 0.34, [[0, 0], [0.6, 1], [1, 1]]);
    // A 2.5mm square turned 45 degrees. Turning the square turns its gradient
    // with it, so the source's 135deg shading ends up running straight down.
    const dHalf = (2.5 * Math.SQRT2) / 2;
    const dGrad = doc.linearGradient(mm(CX), mm(divCy - dHalf), mm(CX), mm(divCy + dHalf));
    dGrad.stop(0, GOLD_LITE).stop(0.45, GOLD).stop(1, GOLD_DEEP);
    doc.save()
      .moveTo(mm(CX), mm(divCy - dHalf))
      .lineTo(mm(CX + dHalf), mm(divCy))
      .lineTo(mm(CX), mm(divCy + dHalf))
      .lineTo(mm(CX - dHalf), mm(divCy))
      .closePath().fill(dGrad).restore();

    // ---- 7. Award wording. ----
    doc.font("MS-Regular").fontSize(mm(4.8)).fillColor(INK_SOFT);
    centred(doc, "has successfully completed the", CX, lineTop(124.3, 4.8, 1.25, "ms"), 0, 4.8);

    const course = d.certProgramName || d.courseTitle || "";
    const courseSize = fitSize(doc, course, "MS-Bold", 6.1, 3.5, 250, 0.015);
    doc.font("MS-Bold").fontSize(mm(courseSize)).fillColor(INK);
    centred(doc, course, CX, lineTop(131.1, courseSize, 1.2, "ms"), 0.015, courseSize);

    // The source hardcodes the organisation here; this app is white-label, so
    // it comes from the brand instead.
    const conducted = `conducted by ${brandName}.`;
    const conductedSize = fitSize(doc, conducted, "MS-Regular", 4.8, 3, 250, 0);
    doc.font("MS-Regular").fontSize(mm(conductedSize)).fillColor(INK_SOFT);
    centred(doc, conducted, CX, lineTop(140.4, conductedSize, 1.25, "ms"), 0, conductedSize);

    // ---- 8. Signature and date blocks, two 72mm columns. ----
    const BLOCK_W = 72;
    const INK_BOTTOM = 158.5 + 19.5 - 1.2; // content sits on the box's 1.2mm padding
    const LINE_Y = 158.5 + 19.5;
    const LINE_STOPS = [[0, 0], [0.18, 1], [0.82, 1], [1, 0]];
    const R1_TOP = LINE_Y + 0.34 + 2.6;
    const R2_TOP = R1_TOP + 4.3 * 1.25 + 0.9;
    const leftCx = 49 + BLOCK_W / 2;   // 85mm
    const rightCx = 176 + BLOCK_W / 2; // 212mm

    // Signature image, bottom-aligned on the left rule like a pen signature.
    if (d.signatureImage) {
      try {
        doc.image(d.signatureImage, mm(leftCx - 56 / 2), mm(INK_BOTTOM - 18),
          { fit: [mm(56), mm(18)], align: "center", valign: "bottom" });
      } catch { /* bad/unreadable image data: skip it rather than fail the whole PDF */ }
    }

    // Date of issue sits in the matching space above the right rule.
    doc.font("MS-Medium").fontSize(mm(5.2)).fillColor(INK);
    centred(doc, d.issuedText || "", rightCx, lineTop(INK_BOTTOM - 5.2, 5.2, 1, "ms"), 0, 5.2);

    goldRule(doc, leftCx - 31, leftCx + 31, LINE_Y + 0.34 / 2, 0.34, LINE_STOPS);
    goldRule(doc, rightCx - 31, rightCx + 31, LINE_Y + 0.34 / 2, 0.34, LINE_STOPS);

    const signerName = d.signerName || "Director";
    const signerTitle = d.signerTitle || brandName;
    // The two captions directly under the rules read as one line across the
    // page, so they share a size. Shrinking only the longer one would leave
    // them visibly uneven in both height and baseline.
    const r1Size = Math.min(
      fitSize(doc, signerName, "MS-Bold", 4.3, 2.6, BLOCK_W, 0.02),
      fitSize(doc, "DATE OF ISSUE", "MS-Bold", 4.3, 2.6, BLOCK_W, 0.06),
    );
    const captions = [
      { text: signerName, cx: leftCx, top: R1_TOP, font: "MS-Bold", color: INK, cs: 0.02, size: r1Size },
      { text: signerTitle, cx: leftCx, top: R2_TOP, font: "MS-Regular", color: INK_SOFT, cs: 0 },
      { text: "DATE OF ISSUE", cx: rightCx, top: R1_TOP, font: "MS-Bold", color: BRAND, cs: 0.06, size: r1Size },
    ];
    for (const c of captions) {
      const size = c.size || fitSize(doc, c.text, c.font, 4.3, 2.6, BLOCK_W, c.cs);
      doc.font(c.font).fontSize(mm(size)).fillColor(c.color);
      centred(doc, c.text, c.cx, lineTop(c.top, size, 1.25, "ms"), c.cs, size);
    }
  },
};
