// Run with the built site served at BASE (defaults to http://127.0.0.1:8080/).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

const base = process.env.BASE || 'http://127.0.0.1:8080/';
const launchOptions = {
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
    await page.locator('#configurador').scrollIntoViewIfNeeded();
    if (mobile) {
      const menuButton = page.getByRole('button', { name: 'Abrir menú' });
      await menuButton.click();
      await page.waitForFunction(() => document.activeElement.id === 'menuClose');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Pedir presupuesto');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement.id === 'menuBtn');
      await page.locator('#productos [data-product=campera]').click();
      assert.equal(await page.getByRole('dialog', { name: 'Estudio de diseño' }).isVisible(), true);
      assert.equal(await page.locator('#crumbT').textContent(), 'Campera con capucha');
    }
    await waitForStudio(page);
    assert.equal(await activeStep(page), 'Modelo');
    assert.equal(await page.locator('#autoBtn').getAttribute('aria-pressed'), 'false');

    for (const product of ['campera', 'conjunto', 'musculosa', 'bandera', 'gorra', 'remera']) {
      await page.locator(`.chip[data-v=${product}]`).click();
      assert.equal(await studioState(page, 'producto'), product);
      if (product === 'bandera') assert.equal(await page.locator('#fixedFabric').textContent(), 'Poliéster sublimable');
    }
    await page.locator('.fab [data-v=modal]').click();
    assert.equal(await studioState(page, 'tela'), 'modal');

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

    await page.locator('#clearText').click();
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
    await page.locator('.sizes [data-v=TL]').click();
    await page.locator('#fCant').fill('18');
    const quote = new URL(await page.locator('#waBtn').getAttribute('href'));
    assert.equal(quote.origin + quote.pathname, 'https://wa.me/5492644127431');
    const message = quote.searchParams.get('text');
    assert.match(message, /JUANI/);
    assert.match(message, /Número: 10/);
    assert.match(message, /Talle: TL/);
    assert.match(message, /Mangas: #3690A3/);
    assert.match(message, /3\) #F2C230/);
    assert.match(message, /Cantidad aprox\.: 18/);
    assert.match(message, /Logo: lo adjunto/);
    const fragment = message.match(/(#[\w=-]+)\nDetalles extra/)[1];
    const shared = JSON.parse(Buffer.from(fragment.slice(3), 'base64url').toString());
    assert.equal(shared.cantidad, '18', 'Quote link uses the latest change');
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
    await page.locator('#grid [data-preset=seleccion]').click();
    assert.equal(await studioState(page, 'producto'), 'conjunto');
    assert.equal(await studioState(page, 'preset'), 'rayas');
    assert.equal(await activeStep(page), 'Color');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    const sharedPage = await context.newPage();
    await sharedPage.goto(base + fragment);
    if (mobile) await sharedPage.getByRole('dialog', { name: 'Estudio de diseño' }).waitFor();
    await waitForStudio(sharedPage);
    assert.equal(await studioState(sharedPage, 'nombre'), 'JUANI');
    assert.equal(await studioState(sharedPage, 'cantidad'), '18');
    assert.equal(await studioState(sharedPage, 'logoImg'), null);
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'}: six products, fabric, direct color picking, custom colors, patterns, text, logo, quote, shared design, four PNGs and ZIP`);
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
