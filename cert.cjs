/* Certificate PDF generation with pdfkit (built-in Helvetica fonts). */
const PDFDocument = require("pdfkit");

function formatDate(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function generateCertificate({ brandName, studentName, courseTitle, courseCode, certNo, issuedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;

    doc.lineWidth(4).strokeColor("#1E509B").rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1).strokeColor("#C9A227").rect(34, 34, W - 68, H - 68).stroke();

    doc.fillColor("#1E509B").font("Helvetica-Bold").fontSize(13)
      .text((brandName || "Learning Portal").toUpperCase(), 0, 72, { align: "center", characterSpacing: 2 });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(40)
      .text("Certificate of Completion", 0, 132, { align: "center" });
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("This is to certify that", 0, 205, { align: "center" });
    doc.fillColor("#00265E").font("Helvetica-Bold").fontSize(30)
      .text(studentName, 0, 235, { align: "center" });
    doc.fillColor("#3D3D3D").font("Helvetica").fontSize(15)
      .text("has successfully completed the course", 0, 292, { align: "center" });
    doc.fillColor("#121212").font("Helvetica-Bold").fontSize(22)
      .text(`${courseTitle} (${courseCode})`, 0, 322, { align: "center" });
    doc.fillColor("#6B7280").font("Helvetica").fontSize(11)
      .text(`Certificate No: ${certNo}        Issued: ${formatDate(issuedAt)}`, 0, H - 92, { align: "center" });

    doc.end();
  });
}

module.exports = { generateCertificate };
