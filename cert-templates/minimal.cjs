/* Minimal: clean, lots of whitespace, a single thin rule under the name.
   Export { name, render(doc, d) }; the doc is an A4 landscape pdfkit page. */
module.exports = {
  name: "Minimal",
  render(doc, d) {
    const W = doc.page.width;
    const H = doc.page.height;

    doc.fillColor("#9CA3AF").font("Helvetica").fontSize(11)
      .text((d.brandName || "Learning Portal").toUpperCase(), 0, 90, { align: "center", characterSpacing: 4 });
    doc.fillColor("#111827").font("Helvetica").fontSize(30)
      .text("Certificate of Completion", 0, 150, { align: "center", characterSpacing: 1 });
    doc.fillColor("#6B7280").font("Helvetica").fontSize(13)
      .text("This certifies that", 0, 220, { align: "center" });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(34)
      .text(d.studentName, 0, 250, { align: "center" });
    doc.lineWidth(1).strokeColor("#111827").moveTo((W - 300) / 2, 308).lineTo((W + 300) / 2, 308).stroke();
    doc.fillColor("#6B7280").font("Helvetica").fontSize(13)
      .text("has completed", 0, 326, { align: "center" });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(19)
      .text(`${d.courseTitle} (${d.courseCode})`, 0, 352, { align: "center" });
    doc.fillColor("#9CA3AF").font("Helvetica").fontSize(10)
      .text(`${d.certNo}    ${d.issuedText}`, 0, H - 84, { align: "center", characterSpacing: 1 });
  },
};
