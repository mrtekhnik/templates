const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:420,height:800}, permissions: ['clipboard-read','clipboard-write'] }); const p = await ctx.newPage();
 const bad = []; p.on('console', m => { if (m.text().startsWith('NULLARG')) bad.push(m.text()); });
 await p.addInitScript(() => { const o = Element.prototype.replaceChildren; Element.prototype.replaceChildren = function (...a) { if (a.some(x => x === null || x === undefined || x === false)) console.log('NULLARG ' + (new Error().stack.split('\n')[2] || '').trim()); return o.apply(this, a); }; });
 await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(400);
 await p.click('#add'); await p.fill('textarea.area','аа'); await p.click('text=Сохранить'); await p.waitForTimeout(200);
 await p.locator('#list .card').first().click(); await p.waitForTimeout(150);
 await p.click('#menu'); await p.waitForTimeout(150); 
 for (const t of ['Настройки вкладок','Оформление и размеры','Корзина','Меню']) { 
   try { if (t!=='Меню') { await p.getByText(t, {exact:false}).first().click(); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(150); const open = await p.locator('.sheet').count(); if (!open) { await p.click('#menu'); await p.waitForTimeout(150);} } } catch(e){ console.log('skip', t, e.message.slice(0,60)); } }
 await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(o=>o.remove()));
 await p.click('#menu'); await p.click('text=Ещё…'); for (const t of ['Автокопии','Подстановки в тексте','Хранилище и счётчик','Экспорт в текстовый']) { try { await p.getByText(t,{exact:false}).first().click(); await p.waitForTimeout(250); await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(o=>o.remove())); await p.click('#menu'); await p.click('text=Ещё…'); } catch(e){ console.log('skip', t); } }
 console.log('NULLARGS:', bad.length, bad.slice(0,6)); await b.close(); })();
