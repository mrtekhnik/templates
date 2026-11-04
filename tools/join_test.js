const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const pv = () => p.evaluate(() => document.querySelector('.sheet pre.pv').textContent);
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  for (const t of ['Альфа', 'Бета', 'Гамма']) { await p.click('#add'); await p.fill('textarea.area', t); await p.click('text=Сохранить'); await p.waitForTimeout(150); }
  await p.click('#menu'); await p.click('text=Выбрать несколько'); await p.waitForTimeout(200);
  for (const t of ['Гамма', 'Альфа', 'Бета']) { await p.locator('#list .card', { hasText: t }).first().click(); await p.waitForTimeout(120); }
  await p.click('#selMore'); await p.click('text=Склеить тексты'); await p.waitForSelector('pre.pv');
  ok(await pv() === 'Гамма\n\nАльфа\n\nБета', 'порядок «как выбирали»: ' + JSON.stringify(await pv()));
  await p.click('.sheet button:has-text("1.")'); await p.waitForTimeout(100);
  ok(await pv() === '1. Гамма\n\n2. Альфа\n\n3. Бета', 'нумерация 1.: ' + JSON.stringify(await pv()));
  await p.click('.sheet button:has-text("1)")'); ok((await pv()).startsWith('1) Гамма'), 'нумерация 1)');
  await p.click('.sheet button:has-text("(1)")'); ok((await pv()).startsWith('(1) Гамма'), 'нумерация (1)');
  await p.fill('.sheet input[type=number]', '5'); await p.dispatchEvent('.sheet input[type=number]', 'change'); await p.waitForTimeout(100);
  ok((await pv()).startsWith('(5) Гамма') && (await pv()).includes('(7) Бета'), 'начать с 5');
  // стрелка вниз у первого, вверх у последнего
  await p.locator('.sheet .trow').nth(0).locator('button[aria-label="Ниже"]').click(); await p.waitForTimeout(100);
  ok((await pv()).startsWith('(5) Альфа\n\n(6) Гамма'), 'первый вниз: ' + JSON.stringify(await pv()));
  await p.locator('.sheet .trow').nth(2).locator('button[aria-label="Выше"]').click(); await p.waitForTimeout(100);
  ok((await pv()) === '(5) Альфа\n\n(6) Бета\n\n(7) Гамма', 'последний вверх: ' + JSON.stringify(await pv()));
  await p.locator('.sheet .trow').nth(1).locator('button[aria-label="Убрать из склейки"]').click(); await p.waitForTimeout(100);
  ok((await pv()) === '(5) Альфа\n\n(6) Гамма', 'убрали Бету: ' + JSON.stringify(await pv()));
  await p.click('.sheet button:has-text("Без номеров")'); await p.click('.sheet button:has-text("Новая строка")');
  ok((await pv()) === 'Альфа\nГамма', 'без номеров, через новую строку');
  await p.click('.sheet button:has-text("Как в базе")'); await p.waitForTimeout(100);
  const bd = await pv(); ok(bd.split('\n').length === 3 && bd.includes('Бета'), 'сброс порядка «как в базе» вернул все три: ' + JSON.stringify(bd));
  await p.click('.sheet button:has-text("1.")'); await p.click('.sheet button:has-text("Копировать")'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(/^5\. .*\n6\. .*\n7\. /.test(clip), 'в буфер ушло с номерами: ' + JSON.stringify(clip));
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
