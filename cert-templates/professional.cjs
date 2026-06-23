/* Professional certificate (Ceylon Exchange Mentoring gold-border design).
   The design is a full-page background image; the dynamic fields (student name,
   course title, date, certificate number) are overlaid on top.
   d = { brandName, studentName, courseTitle, courseCode, certNo, issuedText } */
const path = require("path");
const BG = path.join(__dirname, "assets", "professional-bg.png");

// Largest font size (down to minSize) at which the text fits on one line.
function fitSize(doc, text, font, maxSize, minSize, maxWidth) {
  doc.font(font);
  let size = maxSize;
  while (size > minSize) { doc.fontSize(size); if (doc.widthOfString(text || "") <= maxWidth) break; size -= 1; }
  return size;
}

module.exports = {
  name: "Professional",
  render(doc, d) {
    const W = doc.page.width;  // 842
    const H = doc.page.height; // 595

    doc.image(BG, 0, 0, { width: W, height: H });

    // Student name, centered in the gap (shrinks to fit one line).
    const name = d.studentName || "";
    const ns = fitSize(doc, name, "Times-Bold", 28, 15, 600);
    doc.fillColor("#725b31").fontSize(ns).text(name, 121, 314 - ns, { width: 600, align: "center", lineBreak: false });

    // Course title, where the sample program name was (shrinks to fit one line).
    const course = d.courseTitle || "";
    const cs = fitSize(doc, course, "Times-Bold", 22, 12, 600);
    doc.fillColor("#1a1a1a").fontSize(cs).text(course, 121, 378 - cs, { width: 600, align: "center", lineBreak: false });

    // Issue date, above the "Date of Issue" label.
    doc.fillColor("#1a1a1a").font("Times-Roman").fontSize(12)
      .text(d.issuedText || "", 456, 462, { width: 130, align: "center" });

    // Certificate number, subtle, bottom-centre.
    doc.fillColor("#9a9a9a").font("Times-Roman").fontSize(8)
      .text(`Certificate No: ${d.certNo || ""}`, 0, 548, { width: W, align: "center" });
  },
};
