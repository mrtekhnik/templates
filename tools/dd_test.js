const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; let fails = 0;
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const clip = () => p.evaluate(() => navigator.clipboard.readText());
  await p.goto('http://localhost:8770/index.html'); await p.waitForTimeout(500);
  const add = async t => { await p.click('#add'); await p.fill('textarea.area', t); await p.click('text=Сохранить'); await p.waitForTimeout(200); };
  const copyCard = async t => { await p.locator('#list .card', { hasText: t }).first().click(); await p.waitForTimeout(250); };
  // 1. одно поле, 3 варианта: нажатие сразу копирует
  await add('Статус: {?Статус|В работе|*Согласовано|Отклонено}');
  await copyCard('Статус: {?Статус');
  ok(await p.locator('.sheet .thm button').count() === 3, 'три кнопки');
  ok(await p.locator('.sheet .thm button.primary').innerText() === 'Согласовано', 'звёздочка выбрана заранее');
  await p.click('.sheet .thm button:has-text("Отклонено")'); await p.waitForTimeout(250);
  ok(await clip() === 'Статус: Отклонено', 'один тап — скопировано: ' + JSON.stringify(await clip()));
  ok(await p.locator('.sheet').count() === 0, 'окно закрылось');
  // запоминание: в следующий раз выбран «Отклонено»
  await copyCard('Статус: {?Статус');
  ok(await p.locator('.sheet .thm button.primary').innerText() === 'Отклонено', 'запомнился последний выбор');
  // своё значение
  await p.fill('.sheet input[placeholder="Другое…"]', 'На паузе');
  ok(await p.locator('.sheet .thm button.primary').count() === 0, 'при вводе своего кнопки снимаются');
  await p.click('.sheet button:has-text("Копировать")'); await p.waitForTimeout(250);
  ok(await clip() === 'Статус: На паузе', 'своё значение: ' + JSON.stringify(await clip()));
  // 2. два поля: выбор + Копировать, одно поле простое
  await add('{?Кому|Иван|Пётр} — {?Тема}');
  await copyCard('{?Кому');
  ok(await p.locator('.sheet .thm button').count() === 2, 'два варианта + простое поле');
  await p.click('.sheet .thm button:has-text("Пётр")'); await p.waitForTimeout(100);
  ok(await p.locator('.sheet').count() === 1, 'при двух полях окно не закрылось от одного нажатия');
  await p.fill('.sheet input[aria-label="Тема"]', 'отчёт'); await p.click('.sheet button:has-text("Копировать")'); await p.waitForTimeout(250);
  ok(await clip() === 'Пётр — отчёт', 'два поля: ' + JSON.stringify(await clip()));
  // 3. больше 6 — выпадающий список
  await add('Цвет {?Цвет|красный|оранжевый|жёлтый|зелёный|голубой|синий|фиолетовый}');
  await copyCard('Цвет {?Цвет');
  ok(await p.locator('.sheet select').count() === 1 && await p.locator('.sheet .thm button').count() === 0, 'семь вариантов — выпадающий список');
  await p.selectOption('.sheet select', 'синий'); await p.click('.sheet button:has-text("Копировать")'); await p.waitForTimeout(250);
  ok(await clip() === 'Цвет синий', 'выбран из списка: ' + JSON.stringify(await clip()));
  // 4. экранированная черта и «=» по-старому
  await add('{?Знак|а\\|б|в}');
  await copyCard('{?Знак');
  ok(await p.locator('.sheet .thm button').first().innerText() === 'а|б', 'экранированная черта: ' + await p.locator('.sheet .thm button').first().innerText());
  await p.click('.sheet button:has-text("Отмена")');
  await add('{?Имя=Иван|Пётр}');
  await copyCard('{?Имя=Иван');
  ok(await p.locator('.sheet .thm button').count() === 0 && await p.inputValue('.sheet input[aria-label="Имя"]') === 'Иван|Пётр', 'запись с «=» работает как раньше');
  await p.click('.sheet button:has-text("Отмена")');
  // 5. длинный список (>80 символов в скобках)
  const many = Array.from({ length: 12 }, (_, i) => 'вариант номер ' + (i + 1)).join('|');
  await add('{?Длинный|' + many + '}');
  await copyCard('{?Длинный');
  ok(await p.locator('.sheet select option').count() === 13, 'длинный список распознан: ' + await p.locator('.sheet select option').count());
  console.log('errors:', errs); console.log(fails ? 'ПРОВАЛЕНО ' + fails : 'ВСЕ ПРОШЛИ');
  await b.close(); process.exit(fails ? 1 : 0);
})();
