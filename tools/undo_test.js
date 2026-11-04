const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const val = () => p.inputValue('textarea.area');
  const undo = () => p.click('.undob[aria-label="Отменить"]');
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  // режим по паузе (по умолчанию)
  await p.click('#add'); await p.waitForSelector('.undob[aria-label="Отменить"]');
  ok(await p.locator('.undob[aria-label="Отменить"]').isDisabled(), 'в начале отмена недоступна');
  await p.click('textarea.area');
  await p.keyboard.type('Привет'); await p.waitForTimeout(800);
  await p.keyboard.type(' мир'); await p.waitForTimeout(800);
  await p.keyboard.type('!');
  ok(await val() === 'Привет мир!', 'набрано');
  await undo(); ok(await val() === 'Привет мир', 'шаг 1: убран хвост без паузы («!»): ' + await val());
  await undo(); ok(await val() === 'Привет', 'шаг 2: « мир» убрано: ' + await val());
  await undo(); ok(await val() === '', 'шаг 3: всё убрано');
  ok(await p.locator('.undob[aria-label="Отменить"]').isDisabled(), 'после полной отмены кнопка серая');
  // символ — отдельный шаг, Ctrl+Z
  await p.keyboard.type('Размер '); await p.waitForTimeout(800);
  await p.click('.symrow:not(.cats) button:has-text("Ø")');
  await p.keyboard.type('20'); await p.waitForTimeout(800);
  ok(await val() === 'Размер Ø20', 'с символом');
  await p.keyboard.press('Control+z'); ok(await val() === 'Размер Ø', 'Ctrl+Z убрал «20»: ' + await val());
  await undo(); ok(await val() === 'Размер ', 'символ отдельным шагом: ' + await val());
  // режим по пробелу
  await p.evaluate(() => { const k = 'my-templates-v1:ui'; const st = JSON.parse(localStorage.getItem(k) || '{}'); for (const pk of ['phone','desktop']) st[pk] = { ...(st[pk]||{}), undoMode: 'word' }; localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('#add'); await p.waitForSelector('.undob[aria-label="Отменить"]');
  await p.click('textarea.area'); await p.keyboard.type('один два три');
  await undo(); ok(await val() === 'один два ', 'word: шаг 1: ' + JSON.stringify(await val()));
  await undo(); ok(await val() === 'один ', 'word: шаг 2: ' + JSON.stringify(await val()));
  await undo(); ok(await val() === '', 'word: шаг 3');
  await p.keyboard.type('a, b'); await undo(); ok(await val() === 'a, ', 'word: запятая+пробел: ' + JSON.stringify(await val()));
  // режим «предложение»
  await p.evaluate(() => { const k = 'my-templates-v1:ui'; const st = JSON.parse(localStorage.getItem(k) || '{}'); for (const pk of ['phone','desktop']) st[pk] = { ...(st[pk]||{}), undoMode: 'sentence' }; localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('#add'); await p.waitForSelector('.undob[aria-label="Отменить"]');
  await p.click('textarea.area'); await p.keyboard.type('Один два. Три, четыре! Пять шесть');
  await undo(); ok(await val() === 'Один два. Три, четыре! ', 'sentence: шаг 1: ' + JSON.stringify(await val()));
  await undo(); ok(await val() === 'Один два. ', 'sentence: шаг 2: ' + JSON.stringify(await val()));
  await undo(); ok(await val() === '', 'sentence: шаг 3');
  await p.keyboard.type('т.д. и'); await undo(); ok(await val() === 'т.д. ', 'sentence: шаг после «т.д. »: ' + JSON.stringify(await val()));
  await undo(); ok(await val() === '', 'sentence: откат до пустого');
  // название отдельно
  await p.focus('.sheet input.field'); await p.keyboard.type('Тема'); await undo();
  ok(await p.inputValue('.sheet input.field') === '', 'название откатывается отдельно');
  ok(await val() === '', 'текст при этом цел');
  await p.screenshot({ path: '/tmp/gm/undo1.png' });
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
