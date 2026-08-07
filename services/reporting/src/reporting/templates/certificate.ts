import type { ReportBranding } from "../../types/reporting";
import { escapeHtml } from "../html";
import { baseReportCss } from "./inspectionReport";

export function renderCertificateHtml(params: {
  branding: ReportBranding;
  documentNumber: string;
  versionNo: number;
  certificateTitle: string;
  propertyName: string;
  assetCode?: string;
  statement: string;
  issuedDate: string;
  issuedBy: string;
}) {
  const p = params;
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"/><style>
${baseReportCss(p.branding)}
.cert { min-height:220mm; display:flex; flex-direction:column; justify-content:center; text-align:center; }
.cert-box { border:2px solid #17202a; padding:24mm 18mm; }
.cert h1 { font-size:28pt; }
.cert-statement { font-size:13pt; line-height:1.7; margin:25px auto; max-width:150mm; }
.cert-meta { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:25px; text-align:left; }
</style></head>
<body>
<header>
<div><div class="brand">${escapeHtml(p.branding.organisationName)}</div></div>
<div class="doc-meta"><strong>${escapeHtml(p.documentNumber)}</strong><span>Version ${p.versionNo}</span></div>
</header>
<section class="cert">
<div class="cert-box">
<div class="kicker">CONTROLLED CERTIFICATE</div>
<h1>${escapeHtml(p.certificateTitle)}</h1>
<p><strong>${escapeHtml(p.propertyName)}</strong>${p.assetCode ? ` · ${escapeHtml(p.assetCode)}` : ""}</p>
<div class="cert-statement">${escapeHtml(p.statement)}</div>
<div class="cert-meta">
<div><label>Issued</label><strong>${escapeHtml(p.issuedDate)}</strong></div>
<div><label>Issued by</label><strong>${escapeHtml(p.issuedBy)}</strong></div>
</div>
</div>
</section>
<footer>
<span>${escapeHtml(p.branding.confidentialityText || "Controlled document.")}</span>
<span>${escapeHtml(p.branding.copyrightText || `© ${new Date().getFullYear()} ${p.branding.organisationName}`)}</span>
</footer>
</body></html>`;
}
