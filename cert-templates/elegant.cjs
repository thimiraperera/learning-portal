/* Elegant: warm parchment background with serif type and twin gold rules.
   Export { name, render(doc, d) }; the doc is an A4 landscape pdfkit page. */
module.exports = {
  name: "Elegant",
  render(doc, d) {
    const W = doc.page.width;
    const H = doc.page.height;

    doc.rect(0, 0, W, H).fill("#FDFBF5");
    doc.lineWidth(1.5).strokeColor("#C9A227");
    doc.moveTo(90, 60).lineTo(W - 90, 60).stroke();
    doc.moveTo(90, H - 60).lineTo(W - 90, H - 60).stroke();

    doc.fillColor("#8A6D1A").font("Times-Roman").fontSize(13)
      .text((d.brandName || "Learning Portal").toUpperCase(), 0, 86, { align: "center", characterSpacing: 4 });
    doc.fillColor("#2B2B2B").font("Times-Bold").fontSize(42)
      .text("Certificate of Completion", 0, 138, { align: "center" });
    doc.fillColor("#6B6B6B").font("Times-Italic").fontSize(16)
      .text("This certificate is proudly presented to", 0, 214, { align: "center" });
    doc.fillColor("#1E509B").font("Times-Bold").fontSize(34)
      .text(d.studentName, 0, 246, { align: "center" });
    doc.lineWidth(1).moveTo((W - 260) / 2, 298).lineTo((W + 260) / 2, 298).stroke();
    doc.fillColor("#6B6B6B").font("Times-Italic").fontSize(16)
      .text("for the successful completion of", 0, 316, { align: "center" });
    doc.fillColor("#2B2B2B").font("Times-Bold").fontSize(24)
      .text(`${d.courseTitle} (${d.courseCode})`, 0, 346, { align: "center" });
    doc.fillColor("#9C9C9C").font("Times-Roman").fontSize(11)
      .text(`Certificate No: ${d.certNo}        Issued: ${d.issuedText}`, 0, H - 100, { align: "center" });
  },
};
