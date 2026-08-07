import type { InspectionReportSnapshot, ReportBranding } from "../../types/reporting";
import { escapeHtml, formatAnswer, outcomeClass } from "../html";

function address(snapshot: InspectionReportSnapshot) {
  return [
    snapshot.property.address_line1,
    snapshot.property.address_line2,
    snapshot.property.town_city,
    snapshot.property.county,
    snapshot.property.postcode
  ].filter(Boolean).map(escapeHtml).join(", ");
}

export function renderInspectionReportHtml(
  snapshot: InspectionReportSnapshot,
  branding: ReportBranding,
  documentNumber: string,
  versionNo: number
) {
  const grouped = new Map<string, typeof snapshot.answers>();
  for (const a of snapshot.answers) {
    const existing = grouped.get(a.section_title) ?? [];
    existing.push(a);
    grouped.set(a.section_title, existing);
  }

  const sections = [...grouped.entries()].map(([title, answers]) => `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <table class="answers">
        <thead><tr><th>Inspection item</th><th>Result</th><th>Outcome</th></tr></thead>
        <tbody>
          ${answers.map(a => `
            <tr>
              <td>${escapeHtml(a.prompt)}</td>
              <td>${escapeHtml(formatAnswer(a.answer, a.unit))}</td>
              <td><span class="badge ${outcomeClass(a.outcome)}">${escapeHtml(a.outcome)}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `).join("");

  const defects = snapshot.defects.length ? `
    <section class="section">
      <h2>Defects & Required Actions</h2>
      ${snapshot.defects.map(d => `
        <div class="defect">
          <div class="defect-head">
            <strong>${escapeHtml(d.reference_code || d.title)}</strong>
            <span class="badge ${d.severity === "critical" || d.severity === "high" ? "fail" : "conditional"}">
              ${escapeHtml(d.severity)}
            </span>
          </div>
          <p>${escapeHtml(d.description || "")}</p>
          <p><strong>Recommended action:</strong> ${escapeHtml(d.recommended_action || "Review required")}</p>
        </div>
      `).join("")}
    </section>
  ` : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<style>
${baseReportCss(branding)}
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">${escapeHtml(branding.organisationName)}</div>
      <div class="strap">${escapeHtml(branding.strapline || "Compliance Without Compromise.")}</div>
    </div>
    <div class="doc-meta">
      <strong>${escapeHtml(documentNumber)}</strong>
      <span>Version ${versionNo}</span>
    </div>
  </header>

  <div class="title-block">
    <div class="kicker">INSPECTION REPORT</div>
    <h1>${escapeHtml(snapshot.template.template_name)}</h1>
    <p>${escapeHtml(snapshot.property.name)} · ${escapeHtml(snapshot.asset.asset_code)}</p>
  </div>

  <section class="summary-grid">
    <div><label>Property</label><strong>${escapeHtml(snapshot.property.name)}</strong><span>${address(snapshot)}</span></div>
    <div><label>Asset</label><strong>${escapeHtml(snapshot.asset.asset_code)}</strong><span>${escapeHtml(snapshot.asset.name || "Asset")}</span></div>
    <div><label>Inspection outcome</label><strong class="${outcomeClass(snapshot.inspection.outcome)}-text">${escapeHtml(snapshot.inspection.outcome)}</strong></div>
    <div><label>Template</label><strong>${escapeHtml(snapshot.template.template_code)}</strong><span>v${snapshot.template.template_version_no}</span></div>
  </section>

  ${sections}
  ${defects}

  <section class="section">
    <h2>Audit & Rule Record</h2>
    <p>This report was generated from the immutable ORION inspection snapshot. The inspection retains the exact template and rule snapshot applicable when submitted.</p>
  </section>

  <footer>
    <span>${escapeHtml(branding.confidentialityText || "Confidential - issued for the intended recipient.")}</span>
    <span>${escapeHtml(branding.copyrightText || `© ${new Date().getFullYear()} ${branding.organisationName}`)}</span>
  </footer>
</body>
</html>`;
}

export function baseReportCss(branding: ReportBranding) {
  const accent = branding.accentHex || "#111827";
  return `
    @page { size: A4; margin: 18mm 15mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #17202a; font-size: 10.5pt; line-height: 1.45; margin: 0; }
    header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid ${accent}; padding-bottom:10px; margin-bottom:20px; }
    .brand { font-size:20pt; font-weight:800; letter-spacing:.04em; }
    .strap { color:#65717e; font-size:9pt; margin-top:3px; }
    .doc-meta { text-align:right; display:grid; gap:3px; }
    .doc-meta span { color:#65717e; font-size:9pt; }
    .title-block { padding:18px 0 8px; }
    .kicker { letter-spacing:.16em; color:#65717e; font-size:8pt; font-weight:700; }
    h1 { font-size:24pt; line-height:1.1; margin:6px 0; color:${accent}; }
    h2 { font-size:14pt; margin:0 0 10px; color:${accent}; }
    .title-block p { color:#65717e; font-size:11pt; }
    .summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0 22px; }
    .summary-grid > div { border:1px solid #d9dee5; border-radius:7px; padding:10px; display:grid; gap:2px; }
    label { text-transform:uppercase; letter-spacing:.1em; color:#7b8794; font-size:7.5pt; font-weight:700; }
    .summary-grid span { color:#65717e; font-size:9pt; }
    .section { margin:0 0 22px; page-break-inside:auto; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; background:#f2f4f7; color:#47515c; font-size:8pt; text-transform:uppercase; letter-spacing:.05em; }
    th, td { border:1px solid #d9dee5; padding:7px; vertical-align:top; }
    .answers th:nth-child(1) { width:58%; }
    .answers th:nth-child(2) { width:24%; }
    .badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:8pt; font-weight:700; text-transform:uppercase; }
    .pass { background:#e8f6ed; color:#176b3a; }
    .fail { background:#fbe9e7; color:#a12b21; }
    .conditional { background:#fff3dd; color:#8b5c00; }
    .neutral { background:#eef1f4; color:#52606d; }
    .pass-text { color:#176b3a; }
    .fail-text { color:#a12b21; }
    .conditional-text { color:#8b5c00; }
    .defect { border-left:4px solid ${accent}; padding:10px 12px; background:#fafbfc; margin-bottom:9px; }
    .defect-head { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    footer { position:fixed; bottom:-10mm; left:0; right:0; border-top:1px solid #d9dee5; padding-top:5px; display:flex; justify-content:space-between; color:#7b8794; font-size:7.5pt; }
  `;
}
