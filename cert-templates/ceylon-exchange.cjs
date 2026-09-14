/* Stock Market Beginners Course certificate (navy and teal design with the red seal).
   Ported 1:1 from the owner's ceylon-exchange-certificate.html: exact font
   (Quicksand at the four weights its CSS uses, embedded), exact colors, exact
   positions. The source lays everything out in millimetres on a 297x210mm
   sheet, so every number below is a millimetre straight out of that CSS, run
   through MM to reach pdfkit points. Only the recipient name, program name,
   subject line, signer name/title/image and the date are dynamic.
   d = { studentName, courseTitle, certProgramName, certSubtitle, certNo,
         issuedText, signerName, signerTitle, signatureImage, brandName } */
const path = require("path");
const LOGO = path.join(__dirname, "assets", "ceylon-logo.png");
const FONT_QS_450 = path.join(__dirname, "assets", "fonts", "Quicksand-W450.ttf");
const FONT_QS_600 = path.join(__dirname, "assets", "fonts", "Quicksand-W600.ttf");
const FONT_QS_650 = path.join(__dirname, "assets", "fonts", "Quicksand-W650.ttf");
const FONT_QS_700 = path.join(__dirname, "assets", "fonts", "Quicksand-W700.ttf");

const NAVY = "#1e1b3c";
const TEAL = "#2ba3b8";
const INK = "#221f4d";
const INK_SOFT = "#3b3866";
const SEAL_RED = "#f01414";

const MM = 2.8346456693;
const mm = (v) => v * MM;

const PAGE_W = 297;   // mm
const PAGE_H = 210;   // mm
const RULE = 0.5;     // mm, the border under the name and over each signing slot

// Straight from the font's own tables: hhea and OS/2 typo agree on ascender
// 1000 and descender -250 per 1000 units, and USE_TYPO_METRICS is set, so the
// browser sizes line boxes from these and not from the taller win metrics
// (1183/303). pdfkit reads the same hhea ascender, so its text() y-parameter
// is the top of this glyph box and the baseline sits ASCENT_RATIO x the font
// size below it.
const ASCENT_RATIO = 1.0;
const DESCENT_RATIO = 0.25;

// Baseline (mm) of a CSS line box whose top is topMm. CSS centres the glyph
// box inside the line box, so half the leading sits above the ascent; with
// line-height under 1.25 that half is negative.
function baselineOf(topMm, sizeMm, lh) {
  return topMm + (lh * sizeMm - (ASCENT_RATIO + DESCENT_RATIO) * sizeMm) / 2 + ASCENT_RATIO * sizeMm;
}
// pdfkit y-parameter in points that puts a sizeMm run's baseline at baseMm.
const topY = (baseMm, sizeMm) => mm(baseMm - ASCENT_RATIO * sizeMm);
const lineTop = (topMm, sizeMm, lh) => topY(baselineOf(topMm, sizeMm, lh), sizeMm);

// Browsers drop the common ligatures once letter-spacing is set (Quicksand
// has an "fi" ligature, and "certificate" hits it), so spaced runs turn them
// off too or their width and look drift from the source.
const features = (csEm) => (csEm ? { liga: false, clig: false } : undefined);

// Width in mm of the inked run: glyph advances plus the letter-spacing BETWEEN
// glyphs, with no trailing gap after the last one.
function runWidth(doc, text, csEm, sizeMm) {
  return doc.widthOfString(text || "", { characterSpacing: (csEm || 0) * mm(sizeMm), features: features(csEm) }) / MM;
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
  return Math.max(sizeMm, minMm);
}

// One left-aligned line starting at xMm. Anything still wider than maxWidthMm
// at the smallest allowed size is squeezed horizontally rather than let it run
// into the seal or off the white shape.
function left(doc, text, xMm, y, csEm, sizeMm, maxWidthMm) {
  const t = text || "";
  if (!t) return;
  doc.fontSize(mm(sizeMm));
  const w = runWidth(doc, t, csEm, sizeMm);
  const opts = { lineBreak: false, characterSpacing: (csEm || 0) * mm(sizeMm), features: features(csEm) };
  if (maxWidthMm && w > maxWidthMm) opts.horizontalScaling = (100 * maxWidthMm) / w;
  doc.text(t, mm(xMm), y, opts);
}

// The seal, a 44-point starburst in the source's 0..100 viewBox.
const SEAL_POINTS = "50.00,0.00 55.91,8.92 64.09,2.03 67.24,12.25 77.03,7.94 77.18,18.64 87.79,17.26 84.91,27.56 95.48,29.23 89.82,38.31 99.49,42.88 91.50,50.00 99.49,57.12 89.82,61.69 95.48,70.77 84.91,72.44 87.79,82.74 77.18,81.36 77.03,92.06 67.24,87.75 64.09,97.97 55.91,91.08 50.00,100.00 44.09,91.08 35.91,97.97 32.76,87.75 22.97,92.06 22.82,81.36 12.21,82.74 15.09,72.44 4.52,70.77 10.18,61.69 0.51,57.12 8.50,50.00 0.51,42.88 10.18,38.31 4.52,29.23 15.09,27.56 12.21,17.26 22.82,18.64 22.97,7.94 32.76,12.25 35.91,2.03 44.09,8.92";

module.exports = {
  name: "Stock Market Beginners Course",
  render(doc, d) {
    doc.registerFont("QS-450", FONT_QS_450);
    doc.registerFont("QS-600", FONT_QS_600);
    doc.registerFont("QS-650", FONT_QS_650);
    doc.registerFont("QS-700", FONT_QS_700);

    // ---- Backdrop: the source SVG uses a 297x210 viewBox stretched over the
    // page, so its units are already millimetres. ----
    doc.rect(0, 0, mm(PAGE_W), mm(PAGE_H)).fill(NAVY);
    doc.ellipse(mm(149), mm(125), mm(150), mm(178)).fill(TEAL);
    doc.ellipse(mm(148), mm(101), mm(140.6), mm(168.3)).fill("#ffffff");

    // ---- The frame: left 46, top 21, right 35. Every block below only has a
    // margin-top and the frame is absolutely positioned, so nothing collapses
    // and each top is simply the previous bottom plus the margin. ----
    const X = 46;
    const FRAME_TOP = 21;
    const FRAME_W = PAGE_W - X - 35; // 216mm

    // 1. Logo (275x101).
    const logoTop = FRAME_TOP + 2.426;
    const logoW = 45.75;
    const logoH = logoW * (101 / 275);
    doc.image(LOGO, mm(X), mm(logoTop), { width: mm(logoW), height: mm(logoH) });

    // 2. "CERTIFICATE OF COMPLETION", 12.04mm, line-height 1.
    const h1Top = logoTop + logoH + 15.914;
    const h1Bottom = h1Top + 12.04;
    doc.font("QS-650").fillColor(INK);
    left(doc, "CERTIFICATE OF COMPLETION", X, lineTop(h1Top, 12.04, 1), 0.0599, 12.04);

    // 3. "This certificate is presented to", 5.28mm, line-height 1.2.
    const ledeTop = h1Bottom + 18.404;
    doc.font("QS-450").fillColor(INK_SOFT);
    left(doc, "This certificate is presented to", X, lineTop(ledeTop, 5.28, 1.2), 0.045, 5.28);

    // Optional subject line. Not in the artwork: it goes in the existing gap
    // between the heading and the lede, centred in it, so a course without
    // one prints the design exactly as drawn and nothing else ever moves.
    const subject = (d.certSubtitle || "").trim();
    if (subject) {
      const gap = ledeTop - h1Bottom;
      const subSize = fitSize(doc, subject, "QS-600", 5.28, 3.5, FRAME_W, 0.045);
      doc.font("QS-600").fillColor(INK_SOFT);
      left(doc, subject, X, lineTop(h1Bottom + (gap - 1.2 * subSize) / 2, subSize, 1.2), 0.045, subSize, FRAME_W);
    }

    // 4. Recipient. A 163.2mm border-box: padding 0 2 1.8 0.3, a 0.5mm bottom
    // border and min-height 11mm. The name shrinks to stay on one line but
    // keeps the full-size baseline, so it always sits the same distance above
    // the rule, and the rule itself never moves.
    const recTop = ledeTop + 5.28 * 1.2 + 10.248;
    const recW = 163.2;
    const recH = Math.max(11, 7.91 * 1.15 + 1.8 + RULE);
    const recBase = baselineOf(recTop, 7.91, 1.15);
    const name = d.studentName || "";
    const nameMaxW = recW - 0.3 - 2;
    const nameSize = fitSize(doc, name, "QS-600", 7.91, 4, nameMaxW, 0);
    doc.font("QS-600").fillColor(INK);
    left(doc, name, X + 0.3, topY(recBase, nameSize), 0, nameSize, nameMaxW);
    doc.rect(mm(X), mm(recTop + recH - RULE), mm(recW), mm(RULE)).fill(INK);

    // 5. "To commemorate the participation of the"
    const occTop = recTop + recH + 8.845;
    doc.font("QS-450").fillColor(INK_SOFT);
    left(doc, "To commemorate the participation of the", X, lineTop(occTop, 5.28, 1.2), 0.045, 5.28);

    // 6. Program name, 7.91mm bold, shrunk to one line across the frame. A
    // smaller size keeps the line box top, as the CSS would, so it still hangs
    // just under the line above.
    const courseTop = occTop + 5.28 * 1.2 + 0.864;
    const course = d.certProgramName || d.courseTitle || "";
    const courseSize = fitSize(doc, course, "QS-700", 7.91, 4, FRAME_W, 0.045);
    doc.font("QS-700").fillColor(INK);
    left(doc, course, X, lineTop(courseTop, courseSize, 1.2), 0.045, courseSize, FRAME_W);

    // ---- 7. Signing row: two 59.9mm slots 22.6mm apart, 148.238mm down the
    // frame. Each slot is a 0.5mm top rule, 1.631mm of padding, then text. ----
    const SLOT_W = 59.9;
    const RULE_Y = FRAME_TOP + 148.238;
    const slot1X = X;
    const slot2X = X + SLOT_W + 22.6;
    const capTop = RULE_Y + RULE + 1.631;
    const CAP_SIZE = 5.44;
    const CAP_LH = 1.0974;
    const INK_BOTTOM = RULE_Y - 1; // signature and date sit just above the rules

    // Signature image, bottom-aligned on the left rule like a pen signature.
    // The design leaves about 19mm clear above it.
    if (d.signatureImage) {
      try {
        doc.image(d.signatureImage, mm(slot1X), mm(INK_BOTTOM - 18),
          { fit: [mm(SLOT_W), mm(18)], align: "left", valign: "bottom" });
      } catch { /* bad/unreadable image data: skip it rather than fail the whole PDF */ }
    }

    // Date in the matching space above the right rule, lined up with the
    // "Date of presentation" label under it. The design leaves this blank for
    // handwriting, but every issued certificate carries its date. Its glyph box
    // (descender included) ends where the signature does.
    const DATE_X = slot2X + 2.638;
    const date = d.issuedText || "";
    const dateSize = fitSize(doc, date, "QS-600", CAP_SIZE, 3.5, SLOT_W - 2.638, 0);
    doc.font("QS-600").fillColor(INK);
    left(doc, date, DATE_X, mm(INK_BOTTOM - (ASCENT_RATIO + DESCENT_RATIO) * dateSize), 0, dateSize, SLOT_W - 2.638);

    doc.rect(mm(slot1X), mm(RULE_Y), mm(SLOT_W), mm(RULE)).fill(INK);
    doc.rect(mm(slot2X), mm(RULE_Y), mm(SLOT_W), mm(RULE)).fill(INK);

    // Signer and role read as one block, so they shrink together; a long
    // title beside a short name would otherwise leave two unrelated sizes.
    // The signer keeps its full-size baseline, level with the date label, and
    // the role follows one line pitch below at whatever size they end up.
    const signer = d.signerName || "Mr. Kavindu Herath";
    const role = d.signerTitle || "Academic Director";
    const capSize = Math.min(
      fitSize(doc, signer, "QS-700", CAP_SIZE, 3, SLOT_W, 0.007),
      fitSize(doc, role, "QS-450", CAP_SIZE, 3, SLOT_W, 0.03),
    );
    const signerBase = baselineOf(capTop, CAP_SIZE, CAP_LH);
    doc.font("QS-700").fillColor(INK);
    left(doc, signer, slot1X, topY(signerBase, capSize), 0.007, capSize, SLOT_W);
    doc.font("QS-450").fillColor(INK_SOFT);
    left(doc, role, slot1X, topY(signerBase + capSize * CAP_LH, capSize), 0.03, capSize, SLOT_W);

    doc.font("QS-450").fillColor(INK_SOFT);
    left(doc, "Date of presentation", DATE_X, lineTop(capTop, CAP_SIZE, CAP_LH), 0.03, CAP_SIZE);

    // ---- 8. Seal: 55.6mm square, right 43.3mm, bottom 10.2mm. ----
    const SEAL = 55.6;
    const sealX = PAGE_W - 43.3 - SEAL;
    const sealY = PAGE_H - 10.2 - SEAL;
    const pts = SEAL_POINTS.split(" ").map((p) => {
      const [px, py] = p.split(",").map(Number);
      return [mm(sealX + (px * SEAL) / 100), mm(sealY + (py * SEAL) / 100)];
    });
    doc.polygon(...pts).fill(SEAL_RED);
  },
};
