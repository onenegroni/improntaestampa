// Run with the built site served at BASE (defaults to http://127.0.0.1:8080/).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

const base = process.env.BASE || 'http://127.0.0.1:8080/';
const launchOptions = {
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  args: process.env.HARDWARE_GL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};
const waitForStudio = page => page.waitForFunction(() => window.__impronta?.api, null, { timeout: 25000 });
const activeStep = page => page.locator('#mtabs [aria-selected=true]').textContent();
const studioState = (page, path) => page.evaluate(keys => keys.split('.').reduce((value, key) => value[key], window.__impronta.state), path);

async function run(browser, mobile) {
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(String(response.status()) + ' ' + response.url()); });
  try {
    await page.goto(base);
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal(await page.locator('#productos a[href="#configurador"]').count(),1);
    assert.equal(await page.locator('[data-owner-photo]').count(),11);
    await page.locator('#catalogo-inicial button[data-catalogue-photo]').click();
    await page.locator('#lb').waitFor({state:'visible'});
    assert.match(await page.locator('#lb .stage img').getAttribute('src'),/egresaditos-celeste\.webp$/);
    await page.keyboard.press('Escape');
    await page.locator('#configurador').scrollIntoViewIfNeeded();
    if (mobile) {
      const menuButton = page.getByRole('button', { name: 'Abrir menú' });
      await menuButton.click();
      await page.waitForFunction(() => document.activeElement.id === 'menuClose');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Pedir presupuesto');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement.id === 'menuBtn');
      await page.locator('#productos a[href="#configurador"]').click();
      assert.equal(await page.getByRole('dialog', { name: 'Estudio de diseño' }).isVisible(), true);
      assert.equal(await page.locator('#crumbT').textContent(), 'Remera personalizada');
    }
    await waitForStudio(page);
    assert.equal(await activeStep(page), 'Modelo');
    assert.equal(await page.locator('#autoBtn').getAttribute('aria-pressed'), 'false');

    for (const product of ['campera', 'conjunto', 'short', 'musculosa', 'bandera', 'gorra', 'remera']) {
      await page.locator(`.chip[data-v=${product}]`).click();
      assert.equal(await studioState(page, 'producto'), product);
      if (product === 'bandera') assert.equal(await page.locator('#fixedFabric').textContent(), 'Poliéster sublimable');
    }
    await page.locator('#templateCollection').selectOption('empresas');
    await page.locator('.fab [data-v=algodon]').click();
    assert.match(await page.locator('#materialTechnique').textContent(),/DTF localizado/);
    await page.locator('#templateCollection').selectOption('primaria');
    await page.locator('.fab [data-v=modal]').click();
    assert.equal(await studioState(page, 'tela'), 'modal');
    assert.match(await page.locator('#materialTechnique').textContent(), /Personalización a confirmar/);
    await page.locator('.fab [data-v=deportiva]').click();

    if (!mobile && process.env.POSTER_OUT) {
      await page.locator('.fab [data-v=deportiva]').click();
      const url = await page.evaluate(async () => (await window.__impronta.api.renderSet({
        w: 1100, h: 1100, angles: [['3-4', -0.48]], transparent: true, pitch: .075, zoom: .92,
      }))[0].url);
      await fs.writeFile(process.env.POSTER_OUT, Buffer.from(url.split(',')[1], 'base64'));
    }

    console.log('  Product and fabric controls passed');
    // The canvas can open the right color section directly. A normal drag only rotates.
    await page.locator('#viewer').scrollIntoViewIfNeeded();
    const sleeve = await (await page.waitForFunction(() => window.__impronta.api.zoneScreenPoint('mangas'))).jsonValue();
    assert.ok(sleeve, 'Sleeve appears in the viewport');
    if (mobile) await page.touchscreen.tap(sleeve.x, sleeve.y);
    else await page.mouse.click(sleeve.x, sleeve.y);
    await page.waitForFunction(() => document.querySelector('.zp[data-z=mangas]').getAttribute('aria-pressed') === 'true');
    assert.equal(await activeStep(page), 'Color');
    await page.getByRole('button', { name: 'Azul marino', exact: true }).click();
    assert.equal(await studioState(page, 'colors.mangas'), '#1e2f5c');
    await page.locator('#editColor').click();
    await page.locator('#slotZone .cw-hex').fill('#3690A3');
    await page.locator('#slotZone .cw-hex').press('Enter');
    assert.equal(await studioState(page, 'colors.mangas'), '#3690a3');
    await page.locator('#slotZone .cw-x').click();
    assert.equal(await page.locator('#slotZone .cw').isHidden(), true);

    if (!mobile) {
      const model = await page.locator('#gl canvas').boundingBox();
      await page.mouse.move(model.x + model.width * .45, model.y + model.height * .36);
      await page.mouse.down();
      await page.mouse.move(model.x + model.width * .61, model.y + model.height * .36, { steps: 6 });
      await page.mouse.up();
      assert.equal(await page.locator('#slotZone .cw').isHidden(), true);
    }

    for (const print of ['galactico', 'tiedye', 'manitos', 'camuflaje', 'geometrico', 'liso', 'rayas']) {
      await page.locator(`.prints [data-v=${print}]`).click();
      assert.equal(await studioState(page, 'preset'), print);
      if (print === 'liso') assert.equal(await page.locator('#pcols').isHidden(), true);
    }
    await page.locator('#pcols .pc[data-i="2"]').click();
    await page.locator('#slotPrint .cw-hex').fill('#F2C230');
    await page.locator('#slotPrint .cw-hex').press('Enter');
    assert.equal(await studioState(page, 'colors.acento3'), '#f2c230');
    await page.locator('#slotPrint .cw-x').click();
    console.log('  Zone and pattern controls passed');
    await page.locator('#nextStep').click();
    assert.equal(await activeStep(page), 'Detalles');

    if (await page.locator('#clearText').isEnabled()) await page.locator('#clearText').click();
    assert.equal(await page.locator('#fNombre').inputValue(), '');
    await page.locator('#fNombre').fill('JUANI');
    await page.locator('#fNum').fill('10x');
    assert.equal(await studioState(page, 'numero'), '10');
    await page.waitForFunction(() => document.querySelector('#seg button:nth-child(2)').getAttribute('aria-pressed') === 'true');
    await page.locator('#fLogo').setInputFiles('site/img/mark.svg');
    await page.waitForFunction(() => Boolean(window.__impronta.state.logoImg));
    assert.equal(await page.locator('#logoLabel').textContent(), 'mark.svg');
    await page.locator('#removeLogo').click();
    assert.equal(await studioState(page, 'logoImg'), null);
    await page.locator('#fLogo').setInputFiles('site/img/mark.svg');
    await page.waitForFunction(() => Boolean(window.__impronta.state.logoImg));

    await page.locator('#nextStep').click();
    assert.equal(await activeStep(page), 'Pedido');
    const garmentSizes = ['T4', 'T6', 'T8', 'T10', 'T12', 'T14', 'T16', 'S', 'M', 'L', 'XL', 'XXL'];
    assert.deepEqual(await page.locator('.sizes button').allTextContents(), garmentSizes);
    assert.deepEqual(await page.locator('#talles table:first-of-type tbody tr td:first-child').allTextContents(), garmentSizes);
    await page.locator('.sizes [data-v=L]').click();
    await page.locator('#fCant').fill('18');
    const quote = new URL(await page.locator('#waBtn').getAttribute('href'));
    assert.equal(quote.origin + quote.pathname, 'https://wa.me/5492644127431');
    const message = quote.searchParams.get('text');
    assert.match(message, /JUANI/);
    assert.match(message, /Número: 10/);
    assert.match(message, /Talle: L\n/);
    assert.match(message, /Mangas: #3690A3/);
    assert.match(message, /3\) #F2C230/);
    assert.match(message, /Cantidad aprox\.: 18/);
    assert.match(message, /Logo: lo adjunto/);
    const fragment = message.match(/(#[\w=-]+)\nDetalles extra/)[1];
    const shared = JSON.parse(Buffer.from(fragment.slice(3), 'base64url').toString());
    assert.equal(shared.cantidad, '18', 'Quote link uses the latest change');
    assert.equal(shared.talle, 'L');
    assert.ok(!('logoImg' in shared), 'Uploaded logo stays on the device');

    console.log('  Text, upload, and quote passed');
    await page.locator('#renderBtn').click();
    await page.waitForSelector('#lb.open', { timeout: 90000 });
    assert.equal(await page.locator('#lbS button').count(), 4);
    await page.locator('#lbS button').nth(1).click();
    assert.equal(await page.locator('#lbT').textContent(), 'Espalda');
    await page.waitForFunction(() => document.getElementById('lbImg').naturalWidth >= 1080);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#lbZip').click();
    const download = await downloadEvent;
    const archive = await fs.readFile(await download.path());
    assert.equal(archive.subarray(0, 2).toString(), 'PK');
    assert.ok(archive.length > 100000);
    assert.ok(archive.includes(Buffer.from('impronta-remera-juani-3-4.png')));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lb').evaluate(element => element.classList.contains('open')), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'renderBtn');

    if (mobile) {
      await page.locator('#sizeGuide').click();
      await page.waitForFunction(() => document.querySelector('#tdet').open && !history.state?.dz);
      assert.equal(await page.locator('#closeDz').isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement.closest('#tdet')?.id), 'tdet');
      await page.waitForFunction(() => Math.abs(document.querySelector('#talles').getBoundingClientRect().top) < 150);
    }
    const photo = page.locator('#grid [data-lb]').first();
    await photo.click();
    await page.getByRole('link', { name: 'Descargar foto' }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#lbDl').getAttribute('download'), 'egresados-galaxia.webp');
    await page.keyboard.press('Escape');
    assert.equal(await photo.evaluate(element => document.activeElement === element), true);
    await page.locator('#filters [data-f="3d"]').click();
    const total = await page.locator('#grid .card').count();
    const visible = await page.locator('#grid .card:not(.hide)').count();
    assert.equal(await page.locator('#gcount').textContent(), `Mostrando ${visible} de ${total}`);
    await page.locator('#filters [data-f="3d"]').click();
    await page.locator('#grid [data-preset=seleccion]').click();
    assert.equal(await studioState(page, 'producto'), 'conjunto');
    assert.equal(await studioState(page, 'preset'), 'rayas');
    assert.equal(await activeStep(page), 'Color');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    await page.locator('#viewer').scrollIntoViewIfNeeded();
    const shorts = await (await page.waitForFunction(() => {
      const { api } = window.__impronta;
      const point = api.zoneScreenPoint('short');
      return point && document.elementFromPoint(point.x, point.y) === api.renderer.domElement && point;
    })).jsonValue();
    if (mobile) await page.touchscreen.tap(shorts.x, shorts.y);
    else await page.mouse.click(shorts.x, shorts.y);
    await page.waitForFunction(() => document.querySelector('.zp[data-z=short]').getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: 'Azul marino', exact: true }).click();
    assert.equal(await studioState(page, 'colors.short'), '#1e2f5c');
    assert.equal(await studioState(page, 'colors.cuerpo'), '#141414');
    await page.locator('#editColor').click();
    await page.locator('#slotZone .cw-hex').fill('#3690A3');
    await page.locator('#slotZone .cw-hex').press('Enter');
    await page.locator('#slotZone .cw-x').click();
    await page.getByRole('button', { name: 'Remera', exact: true }).click();
    await page.getByRole('button', { name: 'Blanco', exact: true }).click();
    assert.equal(await studioState(page, 'colors.cuerpo'), '#f2efe9');
    assert.equal(await studioState(page, 'colors.short'), '#3690a3');
    const kitQuote = new URL(await page.locator('#waBtn').getAttribute('href')).searchParams.get('text');
    assert.ok(kitQuote.includes('Remera: #F2EFE9 (Blanco) · Short: #3690A3'));
    const kitFragment = kitQuote.match(/(#[\w=-]+)\nDetalles extra/)[1];
    const legacyKit = JSON.parse(Buffer.from(kitFragment.slice(3), 'base64url').toString());
    assert.equal(legacyKit.colors.short, '#3690a3');
    delete legacyKit.colors.short;
    legacyKit.talle = 'TXXL';

    const sharedPage = await context.newPage();
    await sharedPage.goto(base + fragment);
    if (mobile) await sharedPage.getByRole('dialog', { name: 'Estudio de diseño' }).waitFor();
    await waitForStudio(sharedPage);
    assert.equal(await studioState(sharedPage, 'nombre'), 'JUANI');
    assert.equal(await studioState(sharedPage, 'cantidad'), '18');
    assert.equal(await studioState(sharedPage, 'logoImg'), null);
    const legacyPage = await context.newPage();
    await legacyPage.goto(base + '#d=' + Buffer.from(JSON.stringify(legacyKit)).toString('base64url'));
    const legacyQuote = new URL(await legacyPage.locator('#waBtn').getAttribute('href')).searchParams.get('text');
    assert.match(legacyQuote, /Short: #F2EFE9/);
    assert.match(legacyQuote, /Talle: XXL\n/);
    await sharedPage.close();
    await legacyPage.close();

    await page.getByRole('tab',{name:'Modelo',exact:true}).click();
    await page.locator('.chip[data-v=campera]').click();
    await page.locator('[data-start=library]').click();
    await page.locator('#templateCollection').selectOption('inicial');
    const heroes=page.locator('[data-template=heroes]');
    const heroesImage=heroes.locator('img');
    assert.match(await heroesImage.getAttribute('src'),/heroes-campera\.webp$/);
    await heroesImage.evaluate(image=>image.decode());
    await page.locator('#templateCollection').selectOption('primaria');
    const tricolor=page.locator('[data-template=tricolor]');
    await tricolor.click();
    assert.equal(await tricolor.getAttribute('aria-pressed'),'true');
    assert.equal(await studioState(page,'preset'),'tricolor');
    await tricolor.locator('img').evaluate(image=>image.decode());
    await page.getByRole('tab',{name:'Color',exact:true}).click();
    assert.deepEqual(await page.locator('#pcols .pc span').allTextContents(),['Superior','Central','Inferior']);
    await page.locator('#pcols [data-i="1"]').click();
    await page.locator('#slotPrint .cw-hex').fill('#EFC087');
    await page.locator('#slotPrint .cw-hex').press('Enter');
    assert.equal(await studioState(page,'colors.acento2'),'#efc087');
    await page.getByRole('tab',{name:'Detalles',exact:true}).click();
    await page.locator('#fNombre').fill('ALDI');
    await page.locator('#sleeveLeft').fill('AM');
    await page.locator('#sleeveRight').fill('6° B');
    await page.locator('#printPlacements summary').click();
    await page.locator('#nombreLugar').selectOption('pecho-izq');
    await page.locator('#numeroLugar').selectOption('espalda-centro');
    await page.locator('#tipografia').selectOption('college');
    assert.equal(await page.locator('#nombreLugar option[value=pecho-centro]').count(),0);
    const templateQuote=new URL(await page.locator('#waBtn').getAttribute('href')).searchParams.get('text');
    assert.match(templateQuote,/Diseño base: Tricolor/);
    assert.match(templateQuote,/Nombre: ALDI · pecho izquierdo/);
    assert.match(templateQuote,/Manga izquierda: AM/);
    assert.match(templateQuote,/Manga derecha: 6° B/);
    const templateData=JSON.parse(Buffer.from(templateQuote.match(/#d=([\w=-]+)/)[1],'base64url'));
    assert.equal(templateData.tipografia,'college');
    assert.equal(templateData.numeroLugar,'espalda-centro');
    assert.equal(templateData.plantilla,'tricolor');
    await page.getByRole('tab',{name:'Modelo',exact:true}).click();
    await page.locator('[data-start=blank]').click();
    assert.equal(await studioState(page,'preset'),'liso');
    assert.equal(await studioState(page,'nombre'),'');
    assert.equal(await studioState(page,'plantilla'),'');
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: seven products, fabric, kit colors, patterns, text, logo, compatible placements, templates, quote, shared and legacy designs, four PNGs and ZIP`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    await run(browser, false);
    await run(browser, true);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
