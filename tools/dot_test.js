const { chromium } = require('playwright');
const { spawn } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const mock = spawn('python3', ['/tmp/gm/ghmock.py', '8771'], { stdio: 'ignore' }); await sleep(700);
  const br = await chromium.launch(); const ctx = await br.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('mrtekhnik.sync')) { localStorage.setItem('mrtekhnik.sync', JSON.stringify({ repo: 'x/sync', token: 'test-token' })); localStorage.setItem('mrtekhnik.sync.api', 'http://127.0.0.1:8771'); localStorage.setItem('my-templates-v1', JSON.stringify({ active: 't1', trash: [], tabs: [{ id: 't1', name: 'Работа', groups: [{ id: 'g1', name: 'Письма' }], items: [{ id: 'a1', title: 'Привет', text: 'Здравствуйте', group: 'g1' }, { id: 'a2', title: 'Пока', text: 'Пока', group: null }] }] })); } } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8770/index.html'); await sleep(500);
  const dot = () => p.evaluate(() => document.getElementById('syncBtn').classList.contains('has'));
  const title = () => p.evaluate(() => document.getElementById('syncBtn').title);
  const sst = () => p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:sync') || '{}'));
  const setMeta = (o) => p.evaluate(o => { const m = JSON.parse(localStorage.getItem('my-templates-v1:meta') || '{}'); Object.assign(m, o); localStorage.setItem('my-templates-v1:meta', JSON.stringify(m)); }, o);
  const sync = async () => { await p.click('#syncBtn'); await p.waitForFunction(() => !document.querySelector('#syncProg'), null, { timeout: 15000 }); await sleep(700); };
  ok(await dot(), 'синхронизации ещё не было → точка сразу'); console.log('  подсказка:', await title());
  await sync(); ok(!(await dot()), 'после синхронизации точки нет'); console.log('  подсказка:', await title());
  await p.click('.gtoggle'); await sleep(700);
  ok(!(await dot()) && !(await sst()).dirtySince, 'сворачивание группы точку не включает');
  await p.click('.card >> nth=0'); await sleep(700);
  ok(!(await dot()) && !(await sst()).dirtySince, 'копирование (просмотр) точку не включает');
  // правка → задержка 1 ч по умолчанию
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1')); s.tabs[0].items[1].text = 'правка'; localStorage.setItem('my-templates-v1', JSON.stringify(s)); }); await p.reload(); await sleep(700);
  const d1 = (await sst()).dirtySince; ok(!(await dot()) && d1 > 0, 'правка есть, но 1 ч ещё не прошёл → точки нет, отсчёт начат');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1:sync')); s.dirtySince = Date.now() - 2 * 3600000; localStorage.setItem('my-templates-v1:sync', JSON.stringify(s)); }); await p.reload(); await sleep(700);
  ok(await dot(), 'прошло больше 1 ч → точка'); console.log('  подсказка:', await title());
  await sync(); ok(!(await dot()) && !(await sst()).dirtySince, 'синхронизация гасит точку и сбрасывает отсчёт');
  // таймер: точка появляется сама
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1')); s.tabs[0].items[0].title = 'Новое имя'; localStorage.setItem('my-templates-v1', JSON.stringify(s)); }); await p.reload(); await sleep(600);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1:sync')); s.dirtySince = Date.now() - 3600000 + 1500; localStorage.setItem('my-templates-v1:sync', JSON.stringify(s)); }); await p.reload(); await sleep(500);
  const before = await dot(); await sleep(2500); const afterT = await dot();
  ok(!before && afterT, 'таймер: точка появилась сама (без перезагрузки)');
  await sync();
  // Сразу + правка через интерфейс
  await setMeta({ syncDelay: 0 }); await p.reload(); await sleep(500);
  await p.click('#add'); await p.fill('textarea.area', 'новый текст из интерфейса'); await p.getByText('Сохранить', { exact: true }).first().click(); await sleep(900);
  ok(await dot(), 'задержка «Сразу»: новый шаблон из интерфейса → точка'); await sync();
  // удаление в корзину и перенос (порядок)
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1')); const x = s.tabs[0].items.pop(); s.trash.push({ id: 'z', deletedAt: Date.now(), kind: 'item', tabId: 't1', tabName: 'Работа', groupId: '', groupName: '', item: x }); localStorage.setItem('my-templates-v1', JSON.stringify(s)); }); await p.reload(); await sleep(600);
  ok(await dot(), 'удаление в корзину → точка'); await sync();
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('my-templates-v1')); s.tabs[0].items.reverse(); localStorage.setItem('my-templates-v1', JSON.stringify(s)); }); await p.reload(); await sleep(600);
  ok(await dot(), 'изменение порядка → точка'); await sync();
  // настройка в окне
  await p.click('#menu'); await p.getByText('GitHub: синхронизация и обновление').click(); await p.getByText('Настройка синхронизации…').click(); await sleep(200);
  const on = await p.evaluate(() => [...document.querySelectorAll('.sheet .thm .btn')].map(b => b.textContent + (b.classList.contains('primary') ? '*' : '')));
  console.log('  настройки задержки:', on);
  await p.getByText('Через 3 ч', { exact: true }).click(); await sleep(100);
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('my-templates-v1:meta')).syncDelay)) === 10800000, 'выбор задержки сохраняется');
  console.log(fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЕ ПРОВЕРКИ ПРОШЛИ');
  await br.close(); mock.kill(); process.exit(fails ? 1 : 0);
})();
