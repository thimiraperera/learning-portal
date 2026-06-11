/* Corporate: solid navy header band with white title, content on white below.
   Export { name, render(doc, d) }; the doc is an A4 landscape pdfkit page. */
module.exports = {
  name: "Corporate",
  render(doc, d) {
    const W = doc.page.width;
    const H = doc.page.height;

    doc.rect(0, 0, W, 132).fill("#00265E");
    doc.fillColor("#C9A227").font("Helvetica-Bold").fontSize(12)
      .text((d.brandName || "Learning Portal").toUpperCase(), 0, 40, { align: "center", characterSpacing: 3 });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(30)
      .text("Certificate of Completion", 0, 70, { align: "center" });

    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("This is to certify that", 0, 196, { align: "center" });
    doc.fillColor("#00265E").font("Helvetica-Bold").fontSize(30)
      .text(d.studentName, 0, 226, { align: "center" });
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("has successfully completed", 0, 284, { align: "center" });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(21)
      .text(`${d.courseTitle} (${d.courseCode})`, 0, 314, { align: "center" });

    doc.rect(0, H - 52, W, 52).fill("#00265E");
    doc.fillColor("#FFFFFF").font("Helvetica").fontSize(10.5)
      .text(`Certificate No: ${d.certNo}        Issued: ${d.issuedText}`, 0, H - 35, { align: "center" });
  },
};
