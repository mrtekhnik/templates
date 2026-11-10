const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const URL = 'http://localhost:8770/index.html';
  await p.goto(URL); await p.waitForTimeout(500);
  await p.click('#add'); await p.fill('textarea.area', 'Секретный шаблон'); await p.click('text=Сохранить'); await p.waitForTimeout(150);
  const locked = () => p.evaluate(() => document.documentElement.classList.contains('locked'));
  ok(!(await locked()), 'без настройки вход не требуется');
  // установка пароля
  await p.click('#menu'); await p.click('text=Ещё…'); await p.click('text=Защита входом'); await p.waitForTimeout(300);
  await p.click('text=Задать пароль…'); await p.waitForTimeout(150);
  const pw = p.locator('.sheet input.pwmask');
  await pw.nth(0).fill('12'); await pw.nth(1).fill('12'); await p.click('.sheet >> text=Сохранить'); await p.waitForTimeout(300);
  ok((await p.locator('.sheet .err').innerText()).includes('короткий'), 'короткий пароль отклонён');
  await pw.nth(0).fill('abcd'); await pw.nth(1).fill('abce'); await p.click('.sheet >> text=Сохранить'); await p.waitForTimeout(300);
  ok((await p.locator('.sheet .err').innerText()).includes('не совпадают'), 'несовпадение отклонено');
  await pw.nth(1).fill('abcd'); await p.click('.sheet >> text=Сохранить'); await p.waitForTimeout(500);
  const cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:lock')));
  ok(cfg && cfg.hash && cfg.salt && !JSON.stringify(cfg).includes('abcd'), 'хэш сохранён, пароль в открытом виде нет');
  // блокировка сейчас
  await p.click('text=🔒 Заблокировать сейчас'); await p.waitForTimeout(200);
  ok(await locked(), 'экран блокировки показан');
  ok(!(await p.locator('#list').isVisible()), 'список скрыт');
  await p.keyboard.press('Alt+Digit1'); await p.keyboard.press('/');
  // неверный пароль
  await p.fill('#lockscreen input.pwmask', 'wrong'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(600);
  ok((await locked()) && (await p.locator('#lockscreen .err').innerText()).includes('Неверный'), 'неверный пароль не пускает');
  // троттлинг
  for (let i = 0; i < 4; i++) { await p.fill('#lockscreen input.pwmask', 'x' + i); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(500); }
  await p.fill('#lockscreen input.pwmask', 'abcd'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(500);
  ok((await locked()) && (await p.locator('#lockscreen .err').innerText()).includes('Слишком'), 'после 5 ошибок — пауза, даже верный пароль не принят');
  await p.evaluate(() => { const k = 'my-templates-v1:lock', c = JSON.parse(localStorage.getItem(k)); c.until = 0; localStorage.setItem(k, JSON.stringify(c)); });
  await p.fill('#lockscreen input.pwmask', 'abcd'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(600);
  ok(!(await locked()), 'верный пароль открывает');
  ok((await p.locator('#list .card', { hasText: 'Секретный' }).count()) === 1, 'данные на месте');
  // запуск заново — заблокировано
  await p.reload(); await p.waitForTimeout(400);
  ok(await locked(), 'при новом открытии требуется вход');
  await p.fill('#lockscreen input.pwmask', 'abcd'); await p.press('#lockscreen input.pwmask', 'Enter'); await p.waitForTimeout(600);
  ok(!(await locked()), 'вход после перезапуска');
  // пропуск при обновлении
  await p.evaluate(() => sessionStorage.setItem('lockSkip', String(Date.now()))); await p.reload(); await p.waitForTimeout(400);
  ok(!(await locked()), 'после обновления приложения повторный вход не нужен');
  // автоблокировка: сразу при сворачивании
  await p.evaluate(() => { const k = 'my-templates-v1:lock', c = JSON.parse(localStorage.getItem(k)); c.auto = 0; localStorage.setItem(k, JSON.stringify(c)); });
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(200); ok(await locked(), 'автоблокировка при сворачивании (режим «сразу»)');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  // сброс пароля
  await p.click('text=Забыли пароль?'); await p.waitForTimeout(200);
  await p.click('text=Стереть всё и сбросить вход'); await p.waitForTimeout(800);
  ok(!(await locked()), 'после сброса вход снят');
  ok((await p.locator('#list .card', { hasText: 'Секретный' }).count()) === 0, 'данные стёрты');
  ok(await p.evaluate(() => localStorage.getItem('my-templates-v1:nosync') === '1'), 'синхронизация отключена до повторного ввода токена');
  // биометрия через виртуальный аутентификатор
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('#menu'); await p.click('text=Ещё…'); await p.click('text=Защита входом'); await p.waitForTimeout(500);
  await p.click('text=Включить биометрию'); await p.waitForTimeout(800);
  const c2 = await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:lock')));
  ok(c2 && c2.cred && !c2.hash, 'биометрия включена без пароля');
  await p.click('.sheet >> text=🔒 Заблокировать сейчас'); await p.waitForTimeout(800);
  ok(!(await locked()), 'биометрия автоматически разблокировала');
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await p.reload(); await p.waitForTimeout(1200);
  ok(await locked(), 'без подтверждения биометрии остаётся блокировка');
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
  await p.click('text=👆 Разблокировать'); await p.waitForTimeout(800);
  ok(!(await locked()), 'повторная попытка по кнопке открывает');
  // отключение биометрии → защита снята
  await p.click('#menu'); await p.click('text=Ещё…'); await p.click('text=Защита входом'); await p.waitForTimeout(400);
  await p.click('text=Отключить биометрию'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => localStorage.getItem('my-templates-v1:lock') === null), 'без способов входа защита полностью снята');
  ok(errs.length === 0, 'ошибок JS нет ' + JSON.stringify(errs));
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK'); await b.close();
})();
