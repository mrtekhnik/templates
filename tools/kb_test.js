const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const clip = () => p.evaluate(() => navigator.clipboard.readText());
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  for (const t of ['яблоко красное', 'яблоко зелёное', 'груша', 'банан']) { await p.click('#add'); await p.fill('textarea.area', t); await p.click('text=Сохранить'); await p.waitForTimeout(150); }
  // Alt+цифры на главном экране
  const n = await p.locator('#list .card').count(); ok(n >= 4, 'карточек: ' + n);
  await p.keyboard.press('Alt+Digit2'); await p.waitForTimeout(200);
  const c2 = await clip(); ok(c2.length > 0, 'Alt+2 скопировал: ' + JSON.stringify(c2));
  const order = await p.evaluate(() => [...document.querySelectorAll('#list .card .pre')].map(e => e.textContent));
  ok(c2 === order[1], 'Alt+2 = вторая карточка (' + order[1] + ')');
  // поиск: фокус, номера и подсветка
  await p.focus('#q'); await p.keyboard.type('ябл'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.body.classList.contains('kbnav')), 'номера включены при фокусе поиска');
  ok(await p.locator('#list .card.kbsel').count() === 1, 'подсвечен первый результат');
  const first = await p.evaluate(() => document.querySelector('#list .card.kbsel .pre').textContent);
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok(await clip() === first, 'Enter копирует подсвеченный: ' + first);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  const second = await p.evaluate(() => document.querySelector('#list .card.kbsel .pre').textContent);
  ok(second !== first, 'стрелка вниз сдвинула выбор: ' + second);
  await p.keyboard.press('Enter'); await p.waitForTimeout(200); ok(await clip() === second, 'Enter копирует второй');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelector('#list .card.kbsel .pre').textContent) === first, 'вверх не выходит за первый');
  await p.screenshot({ path: '/tmp/gm/kb1.png' });
  // Esc: очистить, потом снять фокус
  await p.keyboard.press('Escape'); ok(await p.inputValue('#q') === '', 'Esc очищает поиск');
  await p.keyboard.press('Escape'); ok(await p.evaluate(() => document.activeElement.id !== 'q'), 'второй Esc снимает фокус');
  // Enter при пустом поиске ничего не копирует
  await p.evaluate(() => navigator.clipboard.writeText('X')); await p.focus('#q'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(await clip() === 'X', 'Enter при пустом поиске не копирует');
  // Alt+цифра из поля поиска; в окне правки не срабатывает
  await p.keyboard.type('груш'); await p.keyboard.press('Alt+Digit1'); await p.waitForTimeout(150); ok(await clip() === 'груша', 'Alt+1 из поиска');
  await p.fill('#q', ''); await p.evaluate(() => document.getElementById('q').blur());
  await p.evaluate(() => navigator.clipboard.writeText('Y')); await p.click('#add'); await p.keyboard.press('Alt+Digit1'); await p.waitForTimeout(150);
  ok(await clip() === 'Y', 'в окне правки Alt+1 не копирует');
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
