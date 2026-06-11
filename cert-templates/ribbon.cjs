/* Ribbon: gold corner accents and a drawn award seal at the foot.
   Export { name, render(doc, d) }; the doc is an A4 landscape pdfkit page. */
module.exports = {
  name: "Ribbon",
  render(doc, d) {
    const W = doc.page.width;
    const H = doc.page.height;

    // Gold corner triangles.
    doc.fillColor("#C9A227");
    doc.moveTo(0, 0).lineTo(120, 0).lineTo(0, 120).fill();
    doc.moveTo(W, H).lineTo(W - 120, H).lineTo(W, H - 120).fill();

    doc.lineWidth(2).strokeColor("#00265E").rect(40, 40, W - 80, H - 80).stroke();

    doc.fillColor("#00265E").font("Helvetica-Bold").fontSize(13)
      .text((d.brandName || "Learning Portal").toUpperCase(), 0, 80, { align: "center", characterSpacing: 2 });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(38)
      .text("Certificate of Achievement", 0, 128, { align: "center" });
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("Awarded to", 0, 200, { align: "center" });
    doc.fillColor("#00265E").font("Helvetica-Bold").fontSize(32)
      .text(d.studentName, 0, 230, { align: "center" });
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("for successfully completing", 0, 290, { align: "center" });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(21)
      .text(`${d.courseTitle} (${d.courseCode})`, 0, 320, { align: "center" });

    // Simple award seal.
    const cx = W / 2;
    const cy = H - 96;
    doc.circle(cx, cy, 26).lineWidth(2).strokeColor("#C9A227").stroke();
    doc.circle(cx, cy, 20).lineWidth(1).strokeColor("#C9A227").stroke();
    doc.fillColor("#C9A227").font("Helvetica-Bold").fontSize(13).text("★", cx - 6, cy - 8);

    doc.fillColor("#6B7280").font("Helvetica").fontSize(10.5)
      .text(`Certificate No: ${d.certNo}    Issued: ${d.issuedText}`, 0, H - 52, { align: "center" });
  },
};
