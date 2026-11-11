const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  let f = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(400);
  await p.click('#menu'); await p.click('text=Ещё…'); await p.click('text=Защита входом'); await p.waitForTimeout(300);
  await p.click('text=Задать пароль…'); const pw = p.locator('.sheet input.pwmask');
  await pw.nth(0).fill('1234'); await pw.nth(1).fill('1234'); await p.click('.sheet >> text=Сохранить'); await p.waitForTimeout(500);
  await p.evaluate(() => { const k = 'my-templates-v1:lock', c = JSON.parse(localStorage.getItem(k)); delete c.num; localStorage.setItem(k, JSON.stringify(c)); });
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#lockscreen input').inputMode === 'text'), 'старый пароль: клавиатура обычная');
  await p.fill('#lockscreen input.pwmask', '1234'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:lock')).num === true), 'после входа признак «цифры» запомнен');
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#lockscreen input').inputMode === 'numeric'), 'в следующий раз клавиатура цифровая');
  await p.fill('#lockscreen input.pwmask', '1234'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(600);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('locked'))), 'вход работает');
  // буквенный пароль остаётся обычным
  await p.evaluate(() => { const k = 'my-templates-v1:lock', c = JSON.parse(localStorage.getItem(k)); c.num = false; localStorage.setItem(k, JSON.stringify(c)); });
  console.log(f ? 'FAILS' : 'ALL OK'); await b.close();
})();
