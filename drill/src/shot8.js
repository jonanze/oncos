const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 390, height: 1100 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/staging-drill.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('oncos-drill-ui', JSON.stringify({ mode: 'case', section: 'GI', site: '', sel: { GI: ['hcc'] } })); });
  await p.reload(); await p.waitForSelector('.opts button');
  const cats = {}; let tnm = 0;
  for (let i = 0; i < 25; i++) {
    const ed = await p.$eval('.bar .ed', e => e.textContent);
    if (!/BCLC/.test(ed)) tnm++;
    const opts = await p.$$eval('.opts button', bs => bs.map(x => x.textContent));
    cats[opts.join(',')] = 1;
    await (await p.$$('.opts button'))[0].click();
    if (i === 0) await p.screenshot({ path: 'v8-hcc.png', fullPage: true });
    await p.click('#next');
  }
  await p.click('.modes button:nth-child(2)');
  await p.screenshot({ path: 'v8-hcc-table.png' });
  console.log('non-BCLC', tnm, 'opts', Object.keys(cats), 'errors', errs);
  await b.close();
})();
