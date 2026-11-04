const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  for (const t of ['Альфа', 'Бета', 'Гамма']) { await p.click('#add'); await p.fill('textarea.area', t); await p.click('text=Сохранить'); await p.waitForTimeout(150); }
  const cp = async (t, n) => { for (let i = 0; i < n; i++) { await p.locator('#list .card', { hasText: t }).first().click(); await p.waitForTimeout(80); } };
  await cp('Гамма', 1); await cp('Бета', 2); await cp('Альфа', 3);
  await p.click('.chip.star'); await p.waitForTimeout(250);
  const heads = await p.evaluate(() => [...document.querySelectorAll('.sectoggle')].map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(heads[0].includes('Часто используемые'), 'раздел «Часто используемые» есть и первый: ' + JSON.stringify(heads));
  const rows = await p.evaluate(() => { const out = []; let on = false; for (const el of document.querySelector('#list').children) { if (el.classList.contains('sectoggle')) on = el.innerText.includes('Часто'); else if (on) out.push(el.innerText.replace(/\s+/g, ' ')); } return out; });
  ok(rows.length === 2, 'в списке два шаблона (разовое копирование не попало): ' + JSON.stringify(rows));
  ok(rows[0].includes('Альфа') && rows[0].includes('×3') && rows[1].includes('Бета') && rows[1].includes('×2'), 'порядок по числу копирований, с отметкой ×N');
  ok(!(await p.evaluate(() => JSON.stringify(localStorage.getItem('my-templates-v1')).includes('"n":3'))), 'счётчик не в базе шаблонов (не синхронизируется)');
  const use = await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:use'))); ok(Object.keys(use).length === 3, 'счётчики в отдельном ключе');
  // удаление шаблона → чистка счётчика
  await p.click('.chip:has-text("Работа")'); await p.waitForTimeout(150);
  await p.evaluate(() => { const k = 'my-templates-v1'; const st = JSON.parse(localStorage.getItem(k)); const t = st.tabs[0]; t.items = t.items.filter(i => i.text !== 'Гамма'); localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('.chip.star'); await p.waitForTimeout(250);
  ok(Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:use')))).length === 2, 'счётчик удалённого шаблона убран');
  // скрыть и сбросить
  await p.evaluate(() => { const k = 'my-templates-v1:ui'; const st = JSON.parse(localStorage.getItem(k) || '{}'); for (const pk of ['phone','desktop']) st[pk] = { ...(st[pk]||{}), freqN: 0 }; localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('.chip.star'); await p.waitForTimeout(250);
  ok(!(await p.evaluate(() => document.body.innerText.includes('Часто используемые'))), 'при 0 раздел скрыт');
  await p.evaluate(() => { const k = 'my-templates-v1:ui'; const st = JSON.parse(localStorage.getItem(k)); for (const pk of ['phone','desktop']) st[pk].freqN = 10; localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('#menu'); await p.click('text=Оформление и размеры'); await p.waitForTimeout(200);
  await p.click('summary:has-text("Вкладка ★")'); await p.waitForTimeout(150);
  await p.click('.sheet button:has-text("Сбросить счётчики копирований")'); await p.waitForTimeout(200);
  await p.click('.sheet button:text-is("Сбросить")'); await p.waitForTimeout(300);
  ok(Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:use')))).length === 0, 'сброс очистил счётчики');
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
