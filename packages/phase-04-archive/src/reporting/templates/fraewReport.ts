import type { FRAEWItem, ReportBranding } from "../../types/reporting";
import { escapeHtml } from "../html";
import { baseReportCss } from "./inspectionReport";

export function renderFRAEWReportHtml(params: {
  branding: ReportBranding;
  documentNumber: string;
  versionNo: number;
  propertyName: string;
  title: string;
  executiveSummary?: string;
  items: FRAEWItem[];
}) {
  const { branding, documentNumber, versionNo, propertyName, title, executiveSummary, items } = params;

  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"/><style>
${baseReportCss(branding)}
.fraew { display:grid; grid-template-columns:1fr; gap:10px; }
.fraew-card { border:1px solid #d9dee5; border-radius:8px; overflow:hidden; page-break-inside:avoid; }
.fraew-head { background:#f2f4f7; padding:8px 10px; font-weight:800; display:flex; justify-content:space-between; }
.fraew-grid { display:grid; grid-template-columns:95px 1fr; }
.fraew-grid > div { padding:8px 10px; border-top:1px solid #e2e6eb; }
.fraew-label { color:#65717e; font-weight:800; background:#fbfcfd; }
</style></head>
<body>
<header>
  <div><div class="brand">${escapeHtml(branding.organisationName)}</div><div class="strap">${escapeHtml(branding.strapline || "")}</div></div>
  <div class="doc-meta"><strong>${escapeHtml(documentNumber)}</strong><span>Version ${versionNo}</span></div>
</header>
<div class="title-block">
  <div class="kicker">F.R.A.E.W ASSESSMENT</div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(propertyName)}</p>
</div>
${executiveSummary ? `<section class="section"><h2>Executive Summary</h2><p>${escapeHtml(executiveSummary)}</p></section>` : ""}
<section class="section">
<h2>Findings</h2>
<div class="fraew">
${items.map((i, idx) => `
  <article class="fraew-card">
    <div class="fraew-head"><span>${escapeHtml(i.reference || `Finding ${idx+1}`)}</span><span>${escapeHtml(i.severity || "")}</span></div>
    <div class="fraew-grid">
      <div class="fraew-label">Fault</div><div>${escapeHtml(i.fault)}</div>
      <div class="fraew-label">Risk</div><div>${escapeHtml(i.risk)}</div>
      <div class="fraew-label">Action</div><div>${escapeHtml(i.action)}</div>
      <div class="fraew-label">Evidence</div><div>${escapeHtml(i.evidence)}</div>
      <div class="fraew-label">Who</div><div>${escapeHtml(i.who)}</div>
    </div>
  </article>
`).join("")}
</div>
</section>
<footer>
<span>${escapeHtml(branding.confidentialityText || "Confidential - issued for the intended recipient.")}</span>
<span>${escapeHtml(branding.copyrightText || `© ${new Date().getFullYear()} ${branding.organisationName}`)}</span>
</footer>
</body></html>`;
}
