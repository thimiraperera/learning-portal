/* Completion certificate (Ceylon Exchange Mentoring "Beginners" design).
   The design is a full-page background image; the dynamic fields (student name,
   course title, date, certificate number) are overlaid on top.
   d = { brandName, studentName, courseTitle, courseCode, certNo, issuedText } */
const path = require("path");
const BG = path.join(__dirname, "assets", "completion-bg.png");

// Largest font size (down to minSize) at which the text fits on one line.
function fitSize(doc, text, font, maxSize, minSize, maxWidth) {
  doc.font(font);
  let size = maxSize;
  while (size > minSize) { doc.fontSize(size); if (doc.widthOfString(text || "") <= maxWidth) break; size -= 1; }
  return size;
}

module.exports = {
  name: "Completion (Beginners)",
  render(doc, d) {
    const W = doc.page.width;  // 842
    const H = doc.page.height; // 595
    const NAVY = "#1c1c3c";

    doc.image(BG, 0, 0, { width: W, height: H });

    // Student name, centered just above the blank line (shrinks to fit one line).
    const name = d.studentName || "";
    const ns = fitSize(doc, name, "Helvetica-Bold", 28, 15, 468);
    doc.fillColor(NAVY).fontSize(ns).text(name, 125, 318 - ns, { width: 470, align: "center", lineBreak: false });

    // Course title, where the sample course name was (left-aligned, shrinks to fit).
    const course = d.courseTitle || "";
    const cs = fitSize(doc, course, "Helvetica-Bold", 20, 12, 423);
    doc.fillColor(NAVY).fontSize(cs).text(course, 132, 394 - cs, { width: 425, align: "left", lineBreak: false });

    // Issue date, above the "Date of presentation" line.
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(12)
      .text(d.issuedText || "", 372, 458, { width: 135, align: "center" });

    // Certificate number, subtle, bottom-centre.
    doc.fillColor("#9aa0aa").font("Helvetica").fontSize(8)
      .text(`Certificate No: ${d.certNo || ""}`, 0, 565, { width: W, align: "center" });
  },
};
