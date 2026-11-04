const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  await p.click('#add'); await p.waitForSelector('.sheet input.field');
  const info = await p.evaluate(() => { const i = document.querySelector('.sheet input.field'); return { t: i.type, ac: i.autocomplete, cb: getComputedStyle(i, '::-webkit-search-cancel-button').display }; });
  ok(info.t === 'search' && info.ac === 'off', 'название шаблона: type=search, autocomplete=off ' + JSON.stringify(info));
  await p.fill('.sheet input.field', 'Тест'); await p.fill('textarea.area', 'текст');
  await p.click('text=Сохранить'); await p.waitForTimeout(300);
  ok(await p.locator('text=Тест').count() > 0, 'шаблон сохранился с названием');
  // оставшиеся текстовые поля
  const left = await p.evaluate(() => [...document.querySelectorAll('input')].filter(i => i.type === 'text').length);
  ok(left === 0, 'type=text не осталось на главном экране');
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
