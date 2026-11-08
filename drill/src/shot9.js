const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; const ys = [];
  const p = await b.newPage({ viewport: { width: 390, height: 700 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/staging-drill.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('.opts button');
  for (let i = 0; i < 20; i++) {
    let g = 0; while (!(await p.$('#next')) && g++ < 6) { const bs = await p.$$('.opts button'); await bs[0].click(); }
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const before = await p.evaluate(() => window.scrollY);
    if (i % 2) await p.click('#next'); else await p.keyboard.press('Enter');
    ys.push(before + '→' + await p.evaluate(() => window.scrollY));
  }
  console.log(ys.join(' '), 'errors', errs);
  await b.close();
})();
