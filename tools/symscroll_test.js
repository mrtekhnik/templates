const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] }); const p = await (await b.newContext({ viewport: { width: 816, height: 640 } })).newPage();
  let f = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(400);
  await p.click('#add'); await p.waitForTimeout(300);
  const row = p.locator('.symrow:not(.cats)').first();
  const m = await row.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, bar: e.offsetHeight - e.clientHeight }));
  ok(m.sw > m.cw, 'ряд шире окна: ' + JSON.stringify(m));
  ok(m.bar > 0, 'на ПК виден ползунок прокрутки (высота ' + m.bar + ')');
  const bb = await row.boundingBox(); await p.mouse.move(bb.x + 100, bb.y + 20); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
  ok(await row.evaluate(e => e.scrollLeft) > 100, 'колесо мыши прокручивает вбок');
  await p.screenshot({ path: '/tmp/gm/sym.png' });
  console.log(f ? 'FAILS' : 'ALL OK'); await b.close();
})();
