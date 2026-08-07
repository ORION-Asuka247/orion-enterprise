import { chromium } from "playwright";

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 }
    });

    await page.setContent(html, { waitUntil: "networkidle" });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });
  } finally {
    await browser.close();
  }
}
