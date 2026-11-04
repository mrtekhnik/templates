const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  await p.click('#add'); await p.fill('textarea.area', 'первый'); await p.click('text=Сохранить'); await p.waitForTimeout(300);
  // три шаблона, один в архиве, один в корзине
  await p.evaluate(() => { const k = 'my-templates-v1'; const st = JSON.parse(localStorage.getItem(k));
    const t = st.tabs[0]; const mk = (id, a) => ({ id, title: 'Т' + id, text: 'текст ' + id, archived: a });
    t.items = [mk('a1', false), mk('a2', false), mk('a3', true)];
    st.trash = [{ id: 'x1', deletedAt: Date.now(), kind: 'item', tabId: t.id, tabName: t.name, groupId: '', groupName: '', item: mk('z1', false) }];
    localStorage.setItem(k, JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(500);
  await p.click('#menu'); await p.waitForTimeout(200);
  let txt = await p.evaluate(() => document.querySelector('.sheet').innerText);
  ok(/Записей: 3 \(архив 1, корзина 1\)/.test(txt), 'сводка записей в меню: ' + (txt.match(/Записей:[^\n]*/) || [''])[0]);
  ok(/Хранилище: \d+% /.test(txt), 'сводка места в меню: ' + (txt.match(/Хранилище:[^\n]*/) || [''])[0]);
  await p.click('text=Ещё…'); await p.click('text=Хранилище и счётчик записей'); await p.waitForTimeout(300);
  txt = await p.evaluate(() => document.querySelector('.sheet').innerText);
  ok(/Шаблонов: 3 \(из них в архиве 1\)/.test(txt) && /В корзине: 1/.test(txt), 'окно: записи');
  ok(/Занято на этом адресе/.test(txt) && /Мои шаблоны — база/.test(txt), 'окно: место и список');
  await p.screenshot({ path: '/tmp/gm/stor1.png' });
  await p.click('text=Закрыть');
  // чужой большой ключ → ⚠
  await p.evaluate(() => { localStorage.setItem('other.app', 'x'.repeat(4.4 * 1024 * 1024)); });
  await p.click('#menu'); await p.waitForTimeout(200);
  txt = await p.evaluate(() => document.querySelector('.sheet').innerText);
  ok(/⚠ мало места/.test(txt), 'предупреждение при ≥80%: ' + (txt.match(/Хранилище:[^\n]*/) || [''])[0]);
  await p.click('text=Закрыть');
  // переполнение: добиваем место и пробуем сохранить
  await p.evaluate(() => { let n = 1; try { while (true) { localStorage.setItem('fill' + n, 'y'.repeat(200000)); n++; } } catch (e) {} let m = 0; try { while (true) { localStorage.setItem('fine' + m, 'z'.repeat(20)); m++; } } catch (e) {} });
  await p.click('#add'); await p.fill('textarea.area', 'новый текст при переполнении'); await p.click('text=Сохранить'); await p.waitForTimeout(400);
  const warn = await p.evaluate(() => { const w = document.getElementById('warn'); return { hidden: w.hidden, t: w.textContent }; });
  ok(!warn.hidden && /Не хватило места/.test(warn.t), 'при переполнении — своё сообщение: ' + warn.t.slice(0, 60));
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
