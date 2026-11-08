// Drill module inside the oncOS shell, Chromium and WebKit:
// 150 cases light and 30 dark (debrief on every result, no page errors);
// Table opens the case's cancer in Staging and Back returns the same case, mid-case
// and after the result; Tables then Practice through the tabs keeps the case.
//   node shot_module.js http://localhost:8790
const pw = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8790';
const OUT = process.argv[3] || '.';
const [VW, VH] = (process.argv[4] || '390x1100').split('x').map(Number), PHONE = VW <= 760;
(async () => {
  let failed = 0;
  for (const name of ['chromium', 'webkit']) {
    const b = await pw[name].launch(); const errs = []; let n = 0, withDb = 0;
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, colorScheme: scheme, serviceWorkers: 'block' });
      const p = await ctx.newPage();
      // WebKit reports a search index fetch cut off by the test's own page.goto as a
      // page error; search_ui.js catches it, so it is not counted.
      p.on('pageerror', e => { if (!/\/search\/\w+\.json due to access control checks/.test(e.message)) errs.push(e.message); });
      await p.goto(BASE + '/drill/'); await p.waitForSelector('#drill-app .opts button');
      // Staging's two tabs, the Practise cell and the sidebar scope
      if (scheme === 'light') {
        await p.goto(BASE + '/staging/?record=breast'); await p.waitForSelector('#viewroot .dvhead');
        const tabs = await p.$$eval('#viewroot .st-tabs .wl-tab', t => t.map(x => x.textContent + (x.getAttribute('aria-selected') === 'true' ? '*' : '')).join('|'));
        await p.click('#viewroot .st-practise');
        await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'drill' && document.querySelector('#drill-app .vig'));
        const scope = await p.$eval('#drill-app .scope .v', e => e.textContent), here = await p.$eval('.oncos-rail .suite-link[aria-current="page"]', a => a.textContent.trim());
        const tabs2 = await p.$$eval('#viewroot .st-tabs .wl-tab', t => t.map(x => x.textContent + (x.getAttribute('aria-selected') === 'true' ? '*' : '')).join('|'));
        if (PHONE) { await p.click('#burger'); await p.waitForTimeout(200); }
        await p.evaluate(() => [...document.querySelectorAll('#viewnav .navsec[data-sec="Thoracic"] .secname')].forEach(b => b.closest('.navsec').classList.contains('collapsed') && b.click()));
        await p.evaluate(() => [...document.querySelectorAll('#viewnav button')].find(b => b.textContent === 'All Thoracic').click());
        await p.waitForTimeout(200);
        const scope2 = await p.$eval('#drill-app .scope .v', e => e.textContent), ed2 = await p.$eval('#drill-app .ed', e => e.textContent);
        const sheetOpen = await p.evaluate(() => document.body.classList.contains('nav-open'));
        console.log(name, 'tabs', tabs, '->', tabs2, '| Practise scope:', scope, '| marked:', here, '| sidebar scope:', scope2, '(' + ed2 + ')', PHONE ? '| sheet open after choice: ' + sheetOpen : '');
        if (tabs !== 'Tables*|Practice' || tabs2 !== 'Tables|Practice*') errs.push('tabs ' + tabs + ' ' + tabs2);
        if (scope !== 'Breast · Breast cancer' || here !== 'Staging') errs.push('Practise scope ' + scope + ' ' + here);
        if (scope2 !== 'Thoracic' || !/Lung|Mesothelioma|Thym|NSCLC|SCLC|IASLC|Masaoka/.test(ed2)) errs.push('sidebar scope ' + scope2 + ' ' + ed2);
        if (PHONE && sheetOpen) errs.push('sheet stayed open');
        if (PHONE) { await p.click('#burger'); await p.waitForTimeout(150); }
        await p.evaluate(() => [...document.querySelectorAll('#viewnav button')].find(b => b.textContent === 'All cancers').click());
        if (PHONE) await p.evaluate(() => document.body.classList.remove('nav-open'));
        await p.waitForSelector('#drill-app .opts button');
      }
      for (let i = 0; i < (scheme === 'light' ? 150 : 30); i++) {
        let g = 0;
        while (!(await p.$('#next')) && g++ < 6) { const bs = await p.$$('#drill-app .opts button:not([disabled])'); await bs[bs.length > 2 ? 1 : 0].click(); }
        n++;
        const arrows = await p.$eval('#drill-app', e => [...e.querySelectorAll('.verdict, .debrief')].map(x => x.innerText).join('\n').match(/[→←]/g));
        if (arrows) errs.push('arrow in result or debrief: ' + await p.$eval('#drill-app .ed', e => e.textContent));
        if (await p.$('#drill-app .debrief')) withDb++; else errs.push('no debrief: ' + await p.$eval('#drill-app .ed', e => e.textContent));
        if (i === 3) await p.screenshot({ path: `${OUT}/drill-${name}-${scheme}.png`, fullPage: true });
        await p.click('#next');
      }
      for (const stage of ['mid', 'done']) {
        await p.waitForSelector('#drill-app .opts button');
        if (stage === 'mid') await (await p.$$('#drill-app .opts button'))[0].click();
        else { let g = 0; while (!(await p.$('#next')) && g++ < 6) await (await p.$$('#drill-app .opts button:not([disabled])'))[0].click(); }
        const before = await p.$eval('#drill-app', e => e.innerText);
        const href = await p.$eval('#drill-app a.tablelink', a => a.getAttribute('href'));
        await p.click('#drill-app a.tablelink');
        await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'staging' && document.querySelector('#viewroot .dvhead'));
        const url = p.url(), title = await p.$eval('#viewroot .dvhead h2', e => e.textContent);
        if (scheme === 'light' && stage === 'mid') await p.screenshot({ path: `${OUT}/drill-${name}-staging.png` });
        await p.goBack();
        await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'drill' && document.querySelector('#drill-app .vig'));
        const after = await p.$eval('#drill-app', e => e.innerText);
        console.log(name, scheme, stage, href, '->', url.replace(BASE, ''), '|', title, '| same case on Back:', before === after);
        if (before !== after) errs.push('case changed on Back (' + stage + ')');
        if (stage === 'done') await p.click('#next');
      }
      // A trial in the debrief opens its Evidence row; Back returns the same case
      let ev = null;
      for (let i = 0; i < 40 && !ev; i++) {
        let g = 0;
        while (!(await p.$('#next')) && g++ < 6) await (await p.$$('#drill-app .opts button:not([disabled])'))[0].click();
        if (await p.$('#drill-app a[data-evidence]')) { ev = await p.$eval('#drill-app a[data-evidence]', a => [a.getAttribute('href'), a.dataset.evidence, a.textContent]); break; }
        await p.click('#next');
      }
      if (!ev) errs.push('no Evidence link in 40 cases');
      else {
        const before = await p.$eval('#drill-app', e => e.innerText);
        await p.click('#drill-app a[data-evidence]');
        await p.waitForFunction(id => document.documentElement.getAttribute('data-view') === 'evidence' && document.getElementById(id), ev[1]);
        await p.waitForTimeout(400);
        const row = await p.evaluate(id => { const r = document.getElementById(id), b = r.getBoundingClientRect(); return { cls: r.className, top: Math.round(b.top), inView: b.top >= 0 && b.top < innerHeight }; }, ev[1]);
        if (scheme === 'light') await p.screenshot({ path: `${OUT}/drill-${name}-evidence.png` });
        await p.goBack();
        await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'drill' && document.querySelector('#drill-app .vig'));
        const after = await p.$eval('#drill-app', e => e.innerText);
        console.log(name, scheme, 'evidence', ev[0], ev[2], '| row', JSON.stringify(row), '| same case on Back:', before === after);
        if (!row.inView) errs.push('Evidence row not in view ' + ev[1]);
        if (before !== after) errs.push('case changed on Back from Evidence');
      }
      // Oesophagus: Table opens the block for the case's grouping (cTNM SCC/AC, pTNM, ypTNM)
      if (scheme === 'light') {
        // scope to the oesophagus from the sidebar (Sections sheet on a phone)
        if (PHONE) { await p.click('#burger'); await p.waitForTimeout(150); }
        await p.evaluate(() => [...document.querySelectorAll('#viewnav button')].find(b => b.textContent === 'Oesophageal & OGJ cancer').click());
        if (PHONE) await p.evaluate(() => document.body.classList.remove('nav-open'));
        await p.waitForSelector('#drill-app .opts button');
        const seen = {};
        for (let i = 0; i < 60 && Object.keys(seen).length < 4; i++) {
          const href = await p.$eval('#drill-app a.tablelink', a => a.getAttribute('href'));
          const anchor = decodeURIComponent((href.split('#')[1] || ''));
          const label = await p.$eval('#drill-app .ed', e => e.textContent);
          if (!anchor) errs.push('oesophagus case without a block anchor: ' + label);
          if (anchor && !seen[anchor]) {
            const before = await p.$eval('#drill-app', e => e.innerText);
            await p.click('#drill-app a.tablelink');
            await p.waitForFunction(id => document.documentElement.getAttribute('data-view') === 'staging' && document.getElementById(id), anchor);
            await p.waitForTimeout(300);
            const pos = await p.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(b.top), h4: document.getElementById(id).querySelector('h4').textContent }; }, anchor);
            seen[anchor] = label + ' -> ' + pos.h4 + ' (top ' + pos.top + ')';
            if (pos.top < 0 || pos.top > 200) errs.push('block not at top: ' + anchor + ' ' + pos.top);
            await p.screenshot({ path: `${OUT}/drill-${name}-${anchor}.png` });
            await p.goBack();
            await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'drill' && document.querySelector('#drill-app .vig'));
            if (before !== await p.$eval('#drill-app', e => e.innerText)) errs.push('case changed on Back from ' + anchor);
          }
          let g = 0; while (!(await p.$('#next')) && g++ < 6) await (await p.$$('#drill-app .opts button:not([disabled])'))[0].click();
          await p.click('#next');
        }
        console.log(name, 'oesophagus blocks', JSON.stringify(seen, null, 1));
        if (Object.keys(seen).length < 4) errs.push('oesophagus groupings seen: ' + Object.keys(seen).join(','));
      }
      const before = await p.$eval('#drill-app', e => e.innerText);
      await p.click('#viewroot .st-tabs a.wl-tab');
      await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'staging');
      await p.click('#viewroot .st-tabs a.wl-tab');
      await p.waitForFunction(() => document.documentElement.getAttribute('data-view') === 'drill' && document.querySelector('#drill-app .vig'));
      const after = await p.$eval('#drill-app', e => e.innerText);
      console.log(name, scheme, 'Tables/Practice tabs round trip, same case:', before === after);
      if (before !== after) errs.push('case changed via the tabs');
      await ctx.close();
    }
    console.log(name, 'cases', n, 'debrief', withDb, 'errors', errs.length, errs.slice(0, 8));
    failed += errs.length;
    await b.close();
  }
  console.log(failed ? 'FAIL' : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})();
