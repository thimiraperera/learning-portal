/* Certificate PDF generation with pdfkit.
   Templates live in ./cert-templates; every .cjs file there becomes a
   selectable template (its id is the filename without the extension).
   Each template module exports { name, render(doc, d) } and draws onto an
   A4 landscape page. Drop more files into the folder to add templates. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const TEMPLATE_DIR = path.join(__dirname, "cert-templates");

function loadTemplates() {
  const map = {};
  let files = [];
  try { files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".cjs")).sort(); }
  catch { return map; }
  for (const f of files) {
    const id = path.basename(f, ".cjs");
    try {
      const t = require(path.join(TEMPLATE_DIR, f));
      if (t && typeof t.render === "function") map[id] = { id, name: t.name || id, render: t.render };
    } catch (e) {
      console.error(`Certificate template ${f} failed to load: ${e.message}`);
    }
  }
  return map;
}
const templates = loadTemplates();

function templatesList() {
  return Object.values(templates).map(({ id, name }) => ({ id, name }));
}
function defaultTemplateId() {
  return templates.professional ? "professional" : (Object.keys(templates)[0] || null);
}

// data.issuedText must already be a final display string (the caller decides
// the date and formats it; see server.cjs certPdf()).
function generateCertificate(data, templateId) {
  const t = templates[templateId] || templates[defaultTemplateId()];
  return new Promise((resolve, reject) => {
    if (!t) return reject(new Error("No certificate templates are installed."));
    const doc = new PDFDocument({
      size: "A4", layout: "landscape", margin: 0,
      // Locked so the PDF cannot be edited or have its content copied out
      // (e.g. to alter the name/course) in compliant readers. No user
      // password is set, so anyone can still open, view and print it; the
      // owner password is only an internal key to enable these restrictions
      // and is never shared with anyone.
      ownerPassword: crypto.randomBytes(16).toString("hex"),
      pdfVersion: "1.7ext3",
      permissions: {
        printing: "highResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    t.render(doc, data);
    doc.end();
  });
}

module.exports = { generateCertificate, templatesList, defaultTemplateId };
