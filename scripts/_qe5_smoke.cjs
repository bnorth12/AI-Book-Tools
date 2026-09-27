const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto('file:///C:/NovelWriterSite/NovelWriter/NovelWriter.html');
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
