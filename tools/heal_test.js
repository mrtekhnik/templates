const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const U = 'http://127.0.0.1:8772'; let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.goto(U + '/index.html'); await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'воркер управляет страницей');
  await ctx.setOffline(true);
  await p.goto(U + '/index.html', { timeout: 8000 }); ok(await p.locator('#add').count() > 0, 'офлайн открывается при целом кэше');
  await ctx.setOffline(false);
  // имитация: кэш стёрт, воркер жив
  await p.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  await ctx.setOffline(true);
  let failedOffline = false; try { await p.goto(U + '/index.html', { timeout: 8000 }); failedOffline = !(await p.locator('#add').count()); } catch (e) { failedOffline = true; }
  ok(failedOffline, 'с пустым кэшем офлайн не открывается (воспроизведена ошибка со скриншота)');
  await ctx.setOffline(false);
  await p.goto(U + '/index.html'); await p.waitForTimeout(2000);        // зашли онлайн → воркер докачал
  ok((await p.evaluate(async () => { const c = await caches.open((await caches.keys())[0] || 'x'); return (await c.keys()).length; })) >= 5, 'после захода онлайн кэш восстановлен');
  await ctx.setOffline(true);
  try { await p.goto(U + '/index.html', { timeout: 8000 }); ok(await p.locator('#add').count() > 0, 'офлайн снова открывается'); } catch (e) { ok(false, 'офлайн снова не открылся: ' + e.message.split('\n')[0]); }
  console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ'); await b.close(); process.exit(fails ? 1 : 0);
})();
