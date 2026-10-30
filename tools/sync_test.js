const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const APP = 'http://localhost:8770/index.html', API = 'http://127.0.0.1:8771';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const KEY = 'my-templates-v1';
async function newDev(browser, name, state) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.addInitScript(([st, api, key]) => {
    try {
      if (!localStorage.getItem('mrtekhnik.sync')) localStorage.setItem('mrtekhnik.sync', JSON.stringify({ repo: 'mrtekhnik/sync', token: 'test-token' }));
      localStorage.setItem('mrtekhnik.sync.api', api);
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(st));
    } catch (e) {}
  }, [state, API, KEY]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(name, 'PAGEERR', e.message));
  await page.goto(APP); await sleep(300);
  return { name, ctx, page };
}
const getSt = d => d.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
async function setSt(d, fn) { const st = await getSt(d); fn(st); await d.page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, st]); await d.page.reload(); await sleep(300); }
async function sync(d) {
  await d.page.click('#syncBtn');
  await d.page.waitForFunction(() => !document.querySelector('#syncProg'), null, { timeout: 15000 });
  await sleep(150);
  const dlg = await d.page.evaluate(() => { const s = document.querySelector('.sheet'); return s ? s.innerText : null; });
  const toast = await d.page.evaluate(() => document.querySelector('#toast').textContent);
  if (dlg) { await d.page.getByText('Понятно', { exact: true }).click(); await sleep(100); }
  return dlg || toast;
}
// содержимое для сравнения устройств (без служебных sm/collapsed/archiveOpen)
const view = st => st.tabs.map(t => ({ n: t.name, a: !!t.archived, g: t.groups.map(g => [g.id, g.name, g.parent || null, !!g.archived]), i: t.items.map(i => [i.id, i.title, i.text, i.group || null, !!i.fav, !!i.archived, !!i.inline]) }));
const same = (a, b) => JSON.stringify(view(a)) === JSON.stringify(view(b));
const it = (id, title, text, group) => ({ id, title, text, fav: false, group: group || null });
const baseA = () => ({ active: 't1', trash: [], tabs: [
  { id: 't1', name: 'Работа', groups: [{ id: 'g1', name: 'Письма' }, { id: 'g2', name: 'Тех' }], items: [it('a1', 'Привет', 'Здравствуйте', 'g1'), it('a2', 'Пока', 'До свидания', 'g1'), it('a3', '', 'корень'), it('a4', 'T', 'в тех', 'g2')] },
  { id: 't2', name: 'Дом', groups: [], items: [it('b1', 'Адрес', 'ул. Мира 1')] }] });
const empty = () => ({ active: null, trash: [], tabs: [] });

(async () => {
  const run = async (title, fn) => {
    console.log('\n=== ' + title);
    try { execSync('pkill -f "[g]hm"ock.py || true'); } catch (e) {}
    const mock = spawn('python3', ['/tmp/gm/ghmock.py', '8771'], { stdio: 'ignore' }); await sleep(700);
    const browser = await chromium.launch();
    try { await fn(browser); } catch (e) { fails++; console.log('FAIL exception', e.message); }
    await browser.close(); mock.kill();
  };

  await run('1. первая отправка и получение на втором устройстве', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    console.log('A:', await sync(A));
    console.log('B:', await sync(B));
    ok(same(await getSt(A), await getSt(B)), 'B получил то же, что у A');
    const b = await getSt(B); ok(b.tabs.length === 2 && b.tabs[0].items.length === 4 && b.tabs[0].groups.length === 2, 'вкладки/группы/шаблоны на B');
    console.log('A again:', await sync(A));
    ok(/Всё уже синхронизировано/.test(await sync(B)), '6. повторная синхронизация B без изменений');
  });

  await run('2. правки в обе стороны (текст, новый шаблон, перенос, порядок, избранное)', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { st.tabs[0].items.find(i => i.id === 'a3').title = 'Заголовок A'; st.tabs[0].items.find(i => i.id === 'a1').fav = true; });
    await setSt(B, st => { const t = st.tabs[0]; t.items.find(i => i.id === 'a2').group = null; t.items.push(it('n1', 'Новый B', 'текст B', 'g2')); st.tabs[1].items.reverse(); st.tabs[1].items.push(it('n2', 'Дом2', 'x')); });
    console.log('A:', await sync(A)); console.log('B:', await sync(B)); console.log('A2:', await sync(A));
    const a = await getSt(A), b = await getSt(B);
    ok(same(a, b), 'после двух проходов A и B одинаковы');
    ok(a.tabs[0].items.find(i => i.id === 'a3').title === 'Заголовок A', 'правка A дошла');
    ok(a.tabs[0].items.find(i => i.id === 'a2').group === null && a.tabs[0].items.some(i => i.id === 'n1'), 'правки B дошли до A');
    ok(a.tabs[0].items.find(i => i.id === 'a1').fav === true && b.tabs[0].items.find(i => i.id === 'a1').fav === true, 'избранное');
    ok(/Всё уже/.test(await sync(B)) && /Всё уже/.test(await sync(A)), 'дальше изменений нет');
  });

  await run('3. конфликт: один шаблон изменён на обоих', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { st.tabs[0].items.find(i => i.id === 'a1').text = 'Версия A'; });
    await setSt(B, st => { st.tabs[0].items.find(i => i.id === 'a1').text = 'Версия B'; });
    console.log('A:', await sync(A));
    const msg = await sync(B); console.log('B:', msg.replace(/\n/g, ' '));
    ok(/Конфликтов: 1/.test(msg), 'сообщение о конфликте');
    const b = await getSt(B), texts = b.tabs[0].items.filter(i => /Версия/.test(i.text)).map(i => i.text + '|' + i.title);
    console.log(texts);
    ok(texts.length === 2 && texts.some(t => /другая версия/.test(t)), 'сохранены обе версии');
    await sync(A);
    ok(same(await getSt(A), await getSt(B)), 'A и B сошлись, ничего не потеряно');
  });

  await run('4. удаление в корзину и окончательное', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { const t = st.tabs[0]; const x = t.items.find(i => i.id === 'a2'); t.items = t.items.filter(i => i !== x); st.trash.push({ id: 'tr1', deletedAt: Date.now(), kind: 'item', tabId: 't1', tabName: 'Работа', groupId: 'g1', groupName: 'Письма', item: x }); t.items = t.items.filter(i => i.id !== 'a3'); });
    console.log('A:', await sync(A)); console.log('B:', await sync(B));
    const b = await getSt(B);
    ok(!b.tabs[0].items.some(i => i.id === 'a2' || i.id === 'a3'), 'удалённые шаблоны исчезли на B');
    ok(b.trash.some(e => e.item && e.item.id === 'a2'), 'на B удалённый шаблон лежит в корзине (страховка)');
    // восстановление из корзины на A возвращает шаблон
    await setSt(A, st => { const e = st.trash.find(x => x.id === 'tr1'); st.trash = []; st.tabs[0].items.push(e.item); });
    console.log('A restore:', await sync(A)); console.log('B:', await sync(B));
    ok((await getSt(B)).tabs[0].items.some(i => i.id === 'a2'), 'восстановленный шаблон вернулся на B');
    ok(same(await getSt(A), await getSt(B)), 'A=B');
  });

  await run('5. удаление группы и вкладки', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { const t = st.tabs[0]; t.groups = t.groups.filter(g => g.id !== 'g1'); t.items = t.items.filter(i => i.group !== 'g1'); st.tabs = st.tabs.filter(x => x.id !== 't2'); });
    console.log('A:', await sync(A)); console.log('B:', await sync(B));
    const a = await getSt(A), b = await getSt(B);
    ok(b.tabs.length === 1 && !b.tabs[0].groups.some(g => g.id === 'g1') && !b.tabs[0].items.some(i => i.group === 'g1' || ['a1', 'a2'].includes(i.id)), 'группа с шаблонами и вкладка удалены на B');
    ok(same(a, b), 'A=B'); ok(/Всё уже/.test(await sync(B)), 'тишина');
    // шаблон изменён на B в удаляемой группе — не теряется, переносится в корень
    const A2 = await newDev(br, 'A2', baseA()), B2 = await newDev(br, 'B2', empty());
    // отдельный репозиторий нужен — поэтому проверка ниже в сценарии 5b
  });

  await run('5b. группа удалена на A, а шаблон в ней изменён на B', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { const t = st.tabs[0]; t.groups = t.groups.filter(g => g.id !== 'g1'); t.items = t.items.filter(i => i.group !== 'g1'); });
    await setSt(B, st => { st.tabs[0].items.find(i => i.id === 'a1').text = 'правка B'; });
    console.log('A:', await sync(A)); console.log('B:', await sync(B)); await sync(A);
    const b = await getSt(B), a1 = b.tabs[0].items.find(i => i.id === 'a1');
    ok(a1 && a1.text === 'правка B' && a1.group === null, 'изменённый шаблон жив и перенесён в корень');
    ok(same(await getSt(A), b), 'A=B');
  });

  await run('7. одновременная синхронизация двух устройств', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', empty());
    await sync(A); await sync(B);
    await setSt(A, st => { st.tabs[0].items.push(it('x1', 'От A', 'a-text')); });
    await setSt(B, st => { st.tabs[0].items.push(it('y1', 'От B', 'b-text')); });
    const [ra, rb] = await Promise.all([sync(A), sync(B)]); console.log('A:', ra, '| B:', rb);
    await sync(A); await sync(B); await sync(A);
    const a = await getSt(A), b = await getSt(B);
    ok(a.tabs[0].items.some(i => i.id === 'x1') && a.tabs[0].items.some(i => i.id === 'y1'), 'обе правки у A');
    ok(same(a, b), 'A=B');
  });

  await run('8. index.json из репозитория восстанавливается через Импорт', async br => {
    const A = await newDev(br, 'A', baseA());
    await setSt(A, st => { st.tabs[0].items.find(i => i.id === 'a1').fav = true; st.tabs[0].groups.push({ id: 'g3', name: 'Вложенная', parent: 'g1' }); st.tabs[0].items.push({ ...it('a5', 'Во вложенной', 'вл', 'g3'), inline: true }); });
    await sync(A);
    const txt = execSync(`curl -s -H "Authorization: Bearer test-token" "${API}/repos/mrtekhnik/sync/contents/shablony/index.json"`).toString();
    fs.writeFileSync('/tmp/gm/index.json', txt);
    const j = JSON.parse(txt);
    ok(j.app === 'my-templates' && Object.keys(j.items).length === 6 && !!j.items.a1.text, 'index.json содержит записи полностью (' + Object.keys(j.items).length + ')');
    const C = await newDev(br, 'C', empty());
    await C.page.setInputFiles('#file', '/tmp/gm/index.json'); await sleep(400);
    console.log('dialog:', (await C.page.evaluate(() => document.querySelector('.sheet').innerText)).split('\n').slice(0, 3).join(' | '));
    await C.page.getByText('Заменить все данные', { exact: true }).click(); await sleep(300);
    const txt2 = await C.page.evaluate(() => document.querySelector('.sheet') && document.querySelector('.sheet').innerText); console.log('confirm:', (txt2 || '').split('\n')[0]);
    const btns = await C.page.$$('.sheet button'); for (const b of btns) { const t = await b.innerText(); if (/Заменить|Да|Продолжить/.test(t)) { await b.click(); break; } }
    await sleep(400);
    const c = await getSt(C), a = await getSt(A);
    ok(same(a, c), 'данные из index.json восстановлены полностью (структура, порядок, вложенная группа, строка)');
  });


  await run('9. оба устройства уже имели одинаковые данные (одинаковые id), первая синхронизация обоих', async br => {
    const A = await newDev(br, 'A', baseA()), B = await newDev(br, 'B', baseA());
    console.log('A:', await sync(A));
    const msgB = await sync(B); console.log('B:', msgB.replace(/\n/g, ' '));
    const b = await getSt(B);
    ok(!/Конфликт/.test(msgB), 'нет конфликтов');
    ok(!b.tabs.some(t => t.items.some(i => /другая версия/.test(i.title))), 'нет копий «(другая версия)»');
    ok(b.tabs[0].items.length === 4 && b.tabs.length === 2, 'данные не задвоились');
    ok(/Всё уже/.test(await sync(A)) && /Всё уже/.test(await sync(B)), 'дальше изменений нет');
    ok(same(await getSt(A), b), 'A=B');
  });

  await run('9b. то же, но один шаблон на устройствах отличается', async br => {
    const A = await newDev(br, 'A', baseA()); const st = baseA(); st.tabs[0].items[0].text = 'Другой текст на B';
    const B = await newDev(br, 'B', st);
    await sync(A); const msgB = await sync(B); console.log('B:', msgB.replace(/\n/g, ' '));
    ok(/Конфликтов: 1/.test(msgB), 'конфликт только по изменённому шаблону');
    const b = await getSt(B); ok(b.tabs[0].items.length === 5, 'добавилась одна копия, остальные не дублируются (' + b.tabs[0].items.length + ')');
  });

  await run('10. уборка точных копий «(другая версия)» через меню', async br => {
    const A = await newDev(br, 'A', baseA());
    await setSt(A, st => { const t = st.tabs[0]; t.items.push(it('c1', 'Привет (другая версия)', 'Здравствуйте', 'g1'), it('c2', '(другая версия)', 'корень'), it('c3', 'Пока (другая версия)', 'ДРУГОЙ текст', 'g1')); });
    await A.page.click('#menu'); await A.page.getByText('GitHub: синхронизация и обновление').click(); await A.page.getByText('Убрать точные копии', { exact: false }).click(); await sleep(200);
    console.log('dialog:', (await A.page.evaluate(() => document.querySelector('.sheet').innerText)).split('\n').slice(0, 3).join(' | '));
    await A.page.getByText('Убрать 2', { exact: true }).click(); await sleep(300);
    const a = await getSt(A), ids = a.tabs[0].items.map(i => i.id);
    ok(!ids.includes('c1') && !ids.includes('c2') && ids.includes('c3') && ids.includes('a1') && ids.includes('a3'), 'точные копии убраны, отличающаяся копия и оригиналы на месте');
    ok(a.trash.length === 2, 'копии лежат в корзине');
  });

  console.log(fails ? '\nПРОВАЛЕНО: ' + fails : '\nВСЕ ПРОВЕРКИ ПРОШЛИ');
  process.exit(fails ? 1 : 0);
})();
