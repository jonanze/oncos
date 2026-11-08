const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let n = 0, withDb = 0, shot = false;
  for (const scheme of ['light', 'dark']) {
    shot = false; const p = await b.newPage({ viewport: { width: 390, height: 1100 }, colorScheme: scheme });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + __dirname + '/staging-drill.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.waitForSelector('.opts button');
    for (let i = 0; i < (scheme === 'light' ? 150 : 30); i++) {
      let g = 0; while (!(await p.$('#next')) && g++ < 6) { const bs = await p.$$('.opts button:not([disabled])'); await bs[bs.length > 2 ? 1 : 0].click(); }
      n++; if (await p.$('.debrief')) withDb++; else errs.push('no debrief: ' + await p.$eval('.bar .ed', e => e.textContent));
      if (i === 0 || (!shot && await p.$('.more'))) { shot = true; await p.screenshot({ path: `v7-debrief-${scheme}.png`, fullPage: true }); const m = await p.$('.more'); if (m) { await m.click(); await p.screenshot({ path: `v7-rules-${scheme}.png`, fullPage: true }); } }
      await p.click('#next');
    }
  }
  console.log('cases', n, 'debrief', withDb, 'errors', errs.slice(0, 8), errs.length);
  await b.close();
})();
