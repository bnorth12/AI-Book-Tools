const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const htmlSetting = process.env.NW_HTML;
const htmlPath = htmlSetting
  ? (/^file:/i.test(htmlSetting) ? fileURLToPath(new URL(htmlSetting)) : path.isAbsolute(htmlSetting) ? htmlSetting : '')
  : path.resolve(__dirname, '..', 'NovelWriter', 'NovelWriter.html');
if (!htmlPath) throw new Error('NW_HTML must be an absolute path or file URL');
if (!fs.existsSync(htmlPath)) throw new Error(`HTML file does not exist: ${htmlPath}`);
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => typeof runQe5Smoke === 'function' && typeof needsQualityMultiPass === 'function', null, { timeout: 15000 });
  const qe5 = await page.evaluate(async () => await runQe5Smoke());
  const qe4 = await page.evaluate(async () => await runQe4Smoke());
  const txt = await page.evaluate(() => ({
    qe5: (document.getElementById('qe5SmokeResult') || {}).textContent || '',
    maxAutoPasses: (typeof NW_QUALITY_REVISE !== 'undefined' && NW_QUALITY_REVISE.maxAutoPasses),
    reviseOnJudgeAdvisory: (typeof NW_QUALITY_ROLES !== 'undefined' && NW_QUALITY_ROLES.reviseOnJudgeAdvisory),
    logLen: (novelData.qualityMultiPassLog || []).length
  }));
  console.log(JSON.stringify({ qe5, qe4, txt }, null, 2));
  await browser.close();
  if (!qe5 || !qe4) process.exit(2);
})().catch(e => { console.error('SMOKE_ERR', e); process.exit(1); });
