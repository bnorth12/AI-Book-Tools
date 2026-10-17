import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const htmlSetting = process.env.NW_HTML;
const htmlPath = htmlSetting
  ? (/^file:/i.test(htmlSetting) ? fileURLToPath(new URL(htmlSetting)) : path.isAbsolute(htmlSetting) ? htmlSetting : '')
  : path.resolve(SCRIPT_DIR, '..', 'NovelWriter', 'NovelWriter.html');
if (!htmlPath) throw new Error('NW_HTML must be an absolute path or file URL');
if (!fs.existsSync(htmlPath)) throw new Error(`HTML file does not exist: ${htmlPath}`);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
