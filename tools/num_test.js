const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  let f = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(400);
  await p.click('#menu'); await p.click('text=Ещё…'); await p.click('text=Защита входом'); await p.waitForTimeout(300);
  await p.click('text=Задать пароль…'); const pw = p.locator('.sheet input.pwmask');
  await pw.nth(0).fill('1234'); await pw.nth(1).fill('1234'); await p.click('.sheet >> text=Сохранить'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:lock')).num === true), 'цифровой пароль помечен');
  await p.click('text=🔒 Заблокировать сейчас'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('#lockscreen input').inputMode === 'numeric'), 'цифровая клавиатура включена');
  ok(await p.evaluate(() => !document.querySelector('input[type=password]') || true) && (await p.locator('#lockscreen input[type=password]').count()) === 0, 'нет type=password на экране входа');
  await p.click('text=Обычная клавиатура'); ok(await p.evaluate(() => document.querySelector('#lockscreen input').inputMode === 'text'), 'переключатель на обычную');
  await p.fill('#lockscreen input.pwmask', '1234'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(600);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('locked'))), 'вход работает');
  console.log(f ? 'FAILS' : 'ALL OK'); await b.close();
})();
