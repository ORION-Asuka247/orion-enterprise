"""Render real print CSS to PDF; ensure reports and QR labels stay printable."""
from pathlib import Path
from tempfile import TemporaryDirectory
from weasyprint import HTML, CSS
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
styles = [CSS(filename=str(root / 'apps/web/src/styles' / name))
          for name in ('app.css', 'orion-theme.css')]

def printed(body, path):
    HTML(string='<html><body>' + body + '</body></html>').write_pdf(path, stylesheets=styles)
    return '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)

with TemporaryDirectory() as directory:
    shell = '<div class="app-shell"><aside>INTERNAL-NAVIGATION</aside><main><header class="topbar">STAFF-HEADER</header><section class="content">{}</section></main></div>'
    report = shell.format('<div class="no-print">ISSUE-CONTROLS</div><div class="dummy-report-banner">TEST ONLY SIMULATED DATA</div><article class="report-sheet"><h1>Controlled inspection report QA-PRINT-001</h1><h2>Inspection findings</h2><p>Recorded measurement 3 mm. Result PASS.</p></article>')
    text = printed(report, Path(directory) / 'report.pdf')
    assert 'QA-PRINT-001' in ''.join(text.split()) and '3 mm' in text, 'Report content is hidden in print output'
    assert 'SIMULATED DATA' in text, 'Test-data watermark is hidden'
    assert not any(value in text for value in ('INTERNAL-NAVIGATION', 'STAFF-HEADER', 'ISSUE-CONTROLS')), 'Staff controls leaked into printed report'
    label = shell.format('<p>PRIVATE-ASSET-HISTORY</p><div class="print-only asset-label-print"><h1>QR-LABEL-001</h1></div>')
    text = printed(label, Path(directory) / 'label.pdf')
    assert 'QR-LABEL-001' in text, 'QR label is hidden'
    assert 'PRIVATE-ASSET-HISTORY' not in text and 'INTERNAL-NAVIGATION' not in text, 'Unrelated records appear on QR label'
print('PASS: PDF report content, watermark, hidden staff controls and isolated QR label')
