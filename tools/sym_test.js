const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  await p.click('#add'); await p.waitForSelector('.symbar');
  await p.fill('textarea.area', 'Размер ');
  await p.click('.symrow:not(.cats) button:has-text("Ø")');
  await p.click('.symrow:not(.cats) button:has-text("±")');
  let v = await p.inputValue('textarea.area'); console.log('text:', JSON.stringify(v));
  // вставка в середину
  await p.evaluate(() => { const t = document.querySelector('textarea.area'); t.setSelectionRange(0, 0); });
  await p.click('.symrow:not(.cats) button:has-text("°")');
  console.log('mid:', JSON.stringify(await p.inputValue('textarea.area')));
  // в название
  await p.focus('input.field[type=text]'); await p.click('.symrow:not(.cats) button:has-text("×")');
  console.log('title:', JSON.stringify(await p.inputValue('input.field[type=text]')));
  // категория
  await p.click('.symrow.cats button:has-text("Стрелки")');
  console.log('arrow btn:', await p.locator('.symrow:not(.cats) button').first().textContent());
  await p.screenshot({ path: '/tmp/gm/sym1.png' });
  // выключить в настройках
  await p.evaluate(() => { const k = 'my-templates-v1:ui'; const st = JSON.parse(localStorage.getItem(k) || '{}'); for (const pk of ['phone','desktop']) st[pk] = { ...(st[pk]||{}), symbols: false }; localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('#add'); await p.waitForTimeout(300);
  console.log('bar when off:', await p.locator('.symbar').count());
  console.log('errors:', errs);
  await b.close();
})();
