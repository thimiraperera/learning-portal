/* Modern: navy and gold side band with bold left-aligned type.
   Export { name, render(doc, d) }; the doc is an A4 landscape pdfkit page. */
module.exports = {
  name: "Modern",
  render(doc, d) {
    const W = doc.page.width;
    const H = doc.page.height;
    const x = 70;

    doc.rect(0, 0, 16, H).fill("#1E509B");
    doc.rect(16, 0, 4, H).fill("#C9A227");

    doc.fillColor("#1E509B").font("Helvetica-Bold").fontSize(12)
      .text((d.brandName || "Learning Portal").toUpperCase(), x, 70, { characterSpacing: 3 });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(44)
      .text("Certificate", x, 128);
    doc.fillColor("#C9A227").font("Helvetica-Bold").fontSize(20)
      .text("OF COMPLETION", x, 182, { characterSpacing: 2 });
    doc.fillColor("#6B7280").font("Helvetica").fontSize(14)
      .text("Awarded to", x, 244);
    doc.fillColor("#00265E").font("Helvetica-Bold").fontSize(32)
      .text(d.studentName, x, 267);
    doc.fillColor("#6B7280").font("Helvetica").fontSize(14)
      .text("for successfully completing", x, 324);
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(20)
      .text(`${d.courseTitle} (${d.courseCode})`, x, 347, { width: W - x - 60 });
    doc.fillColor("#9CA3AF").font("Helvetica").fontSize(10.5)
      .text(`Certificate No: ${d.certNo}    Issued: ${d.issuedText}`, x, H - 80);
  },
};
