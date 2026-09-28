import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
const r = await page.evaluate(() => {
  const ok = (typeof runQe6Smoke === 'function') ? runQe6Smoke() : false;
  const txt = (document.getElementById('qe6SmokeResult') || document.getElementById('qe5SmokeResult') || {}).textContent || '';
  const has = typeof scoreSlopTells === 'function' && typeof buildAntiSlopReviseBrief === 'function';
  return { ok, txt, has, maxP: (NW_QUALITY_REVISE || {}).maxAutoPasses };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
if (!r.ok || !r.has) process.exit(1);
console.log('B2 LEAN QE6+ANTISLOP SMOKE PASS');
