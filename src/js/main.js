// Impronta Estampa — page logic (UI, lazy 3D, gallery, WhatsApp, renders)
import { createWheel, normHex } from './colorwheel.js';
const CANONICAL_ORIGIN = 'https://improntaestampa.pages.dev/';
const WA = '5492644127431';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PALETTE = [['#141414', 'Negro'], ['#f2efe9', 'Blanco'], ['#6b6b6b', 'Gris'], ['#b5141a', 'Rojo Impronta'], ['#e8742a', 'Naranja'], ['#f2c230', 'Amarillo'], ['#8fd3cf', 'Aqua'], ['#9fc8e8', 'Celeste'], ['#1e2f5c', 'Azul marino'], ['#5b2a86', 'Violeta']];
const cname = h => (PALETTE.find(p => p[0] === h) || [0, h])[1];
const SIZES = ['T4', 'T6', 'T8', 'T10', 'T12', 'T14', 'T16', 'TS', 'TM', 'TL', 'TXL', 'TXXL'];
const TELAS = { deportiva: ['Deportiva', 'Liviana, seca rápido'], modal: ['Modal', 'Suave, más caída'], frizado: ['Acrílico frizado', 'Abriga, interior suave'] };
const PRESETS_P = { galactico: 'Galáctico', splash: 'Splash', degrade: 'Degradé', rayas: 'Rayas', tiedye: 'Tie-dye', manitos: 'Manitos', camuflaje: 'Camuflaje', geometrico: 'Geométrico', liso: 'Liso' };
const PCOL = ['acento', 'acento2', 'acento3'];
const P = {
  remera: { label: 'Remera', crumb: 'Remera egresados', telas: ['deportiva', 'modal'], zones: { cuerpo: 'Cuerpo', mangas: 'Mangas', capucha: null, punos: 'Cuello y puños' }, frase: 'Más que una remera, un recuerdo para siempre' },
  campera: { label: 'Campera', crumb: 'Campera con capucha', telas: ['frizado'], zones: { cuerpo: 'Cuerpo', mangas: 'Mangas', capucha: 'Capucha', punos: 'Puños y cintura' }, frase: 'Más que una campera, un recuerdo para siempre' },
  conjunto: { label: 'Conjunto deportivo', crumb: 'Conjunto deportivo', telas: ['deportiva'], zones: { cuerpo: 'Cuerpo y short', mangas: 'Mangas', capucha: null, punos: 'Cuello y cintura' }, frase: '' },
  musculosa: { label: 'Musculosa', crumb: 'Musculosa', telas: ['deportiva', 'modal'], zones: { cuerpo: 'Cuerpo', mangas: null, capucha: null, punos: 'Vivos' }, frase: '' },
  bandera: { label: 'Bandera', crumb: 'Bandera', telas: [], fixed: 'Poliéster sublimable', zones: { cuerpo: 'Fondo', mangas: null, capucha: null, punos: null }, sizes: ['90×60 cm', '150×90 cm', '200×100 cm'], frase: '' },
  gorra: { label: 'Gorra', crumb: 'Gorra trucker', telas: [], fixed: 'Gabardina + frente sublimado', zones: { cuerpo: 'Copa', mangas: 'Visera', capucha: null, punos: 'Botón y vivos' }, sizes: ['Único ajustable'], frase: '' },
};
const ZL = { cuerpo: 'Cuerpo', mangas: 'Mangas', capucha: 'Capucha', punos: 'Puños' };
const DEFAULT = { producto: 'remera', tela: 'deportiva', colors: { cuerpo: '#141414', mangas: '#b5141a', capucha: '#141414', punos: '#f2efe9', acento: '#b5141a', acento2: '#f4f1ec', acento3: '#7a0d12' }, preset: 'splash', printAll: false, nombre: 'MELI', numero: '26', espalda: 'PROMO 26', escuela: 'ESCUELA SARMIENTO', frase: 'Más que una remera, un recuerdo para siempre', talle: 'TM', cantidad: '30' };
const PRESETS = {
  promo26: {},
  galaxia: { producto: 'campera', tela: 'frizado', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#141414', acento: '#9fc8e8', acento2: '#6a2fa6', acento3: '#1f6fd1' }, preset: 'galactico', printAll: true, frase: 'Más que una campera, un recuerdo para siempre' },
  seleccion: { producto: 'conjunto', tela: 'deportiva', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#9fc8e8', acento: '#9fc8e8', acento2: '#f4f1ec', acento3: '#1e2f5c' }, preset: 'rayas', printAll: false, nombre: 'GÓMEZ', numero: '15', espalda: 'SELECCIÓN', escuela: 'CALINGASTA', frase: '' },
  zumba: { producto: 'musculosa', tela: 'modal', colors: { cuerpo: '#f2efe9', mangas: '#f2efe9', capucha: '#f2efe9', punos: '#141414', acento: '#e8742a', acento2: '#e8742a', acento3: '#b5141a' }, preset: 'degrade', printAll: false, nombre: 'SOFI', numero: '', espalda: 'ZUMBA', escuela: 'REY PILATES', frase: '' },
  tiedye: { producto: 'remera', tela: 'deportiva', colors: { cuerpo: '#2f8fe0', mangas: '#2f8fe0', capucha: '#2f8fe0', punos: '#141414', acento: '#e8432a', acento2: '#f2c230', acento3: '#8a3fb8' }, preset: 'tiedye', printAll: true },
  colorin: { producto: 'campera', tela: 'frizado', colors: { cuerpo: '#58b8ec', mangas: '#58b8ec', capucha: '#58b8ec', punos: '#141414', acento: '#e8432a', acento2: '#f2c230', acento3: '#7a3fb4' }, preset: 'manitos', printAll: true, nombre: 'MELI', numero: '', espalda: 'PRIMER GRADO', escuela: 'COLORÍN COLORADO', frase: 'Nos vemos en primer grado · Promo 26' },
  bandera: { producto: 'bandera', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#f2efe9', acento: '#b5141a' }, preset: 'splash', espalda: 'PROMO 26', escuela: 'ESCUELA SARMIENTO', talle: '150×90 cm' },
};
const clone = value => JSON.parse(JSON.stringify(value));
const state = clone(DEFAULT);
const openedDesign = location.hash.startsWith('#d=');
if (openedDesign) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')))));
    if (Object.prototype.hasOwnProperty.call(P, data.producto)) state.producto = data.producto;
    if (Object.prototype.hasOwnProperty.call(TELAS, data.tela)) state.tela = data.tela;
    if (Object.prototype.hasOwnProperty.call(PRESETS_P, data.preset)) state.preset = data.preset;
    for (const key of Object.keys(state.colors)) state.colors[key] = normHex((data.colors || {})[key]) || state.colors[key];
    for (const [key, limit] of Object.entries({ nombre: 14, numero: 3, espalda: 18, escuela: 32, frase: 48, talle: 24, cantidad: 4 })) {
      if (typeof data[key] === 'string') state[key] = data[key].slice(0, limit);
    }
    state.printAll = data.printAll === true;
  } catch (error) { /* A malformed link opens the default design. */ }
}
state.logoImg = null;

/* ---------- toast ---------- */
let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- panel UI ---------- */
const groups = $('#groups'), tabs = $('#mtabs');
const STEPS = [
  { id: 'modelo', label: 'Modelo', sections: ['producto', 'tela'] },
  { id: 'color', label: 'Color', sections: ['colores', 'estampa'] },
  { id: 'detalles', label: 'Detalles', sections: ['texto', 'logo'] },
  { id: 'pedido', label: 'Pedido', sections: ['talle'] },
];
const SHAPES = {
  remera: '<path d="M8 3 3 5l-2 5 4 2 1-2v10h12V10l1 2 4-2-2-5-5-2a4 4 0 0 1-8 0Z"/>',
  campera: '<path d="M8 6C8 3 10 1 12 1s4 2 4 5l4 2 3 11-4 1-2-8v9H7v-9l-2 8-4-1L4 8l4-2Zm0 0 4 4 4-4m-4 4v11m-2-7-3 3m7-3 3 3"/>',
  conjunto: '<path d="m8 2-5 2-2 4 4 2 2-2v5h10V8l2 2 4-2-2-4-5-2a4 4 0 0 1-8 0Zm-1 14-1 6h5l1-3 1 3h5l-1-6Z"/>',
  musculosa: '<path d="M7 2h3c0 5 4 5 4 0h3c0 4 1 6 3 8l-2 3v8H6v-8l-2-3c2-2 3-4 3-8Z"/>',
  bandera: '<path d="M4 22V3m0 1c5-3 10 3 16 0v11c-6 3-11-3-16 0"/>',
  gorra: '<path d="M8 14a6 6 0 0 1 12 0v3H8m0-3-6 2c-1 1-1 3 2 3l8-2m1-3c0-3 1-6 3-6"/>',
};
const MQ = matchMedia('(max-width: 768px), (max-height: 500px) and (max-width: 1000px)');
let currentStep = 0;
let zone = 'cuerpo';
function btn(attrs, html) {
  const b = document.createElement('button');
  b.type = 'button';
  Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v));
  b.innerHTML = html;
  return b;
}
function buildPanel() {
  STEPS.forEach(({id, label, sections}, index) => {
    tabs.appendChild(btn({ role: 'tab', id: 'tab-' + id, 'data-index': index, 'aria-controls': 'step-' + id }, label));
    const step = document.createElement('div');
    step.className = 'studio-step';
    step.id = 'step-' + id;
    step.setAttribute('role', 'tabpanel');
    step.setAttribute('aria-labelledby', 'tab-' + id);
    sections.forEach(key => {
      const section = document.createElement('section');
      section.className = 'grp';
      section.id = 'grp-' + key;
      step.appendChild(section);
    });
    groups.appendChild(step);
  });

  $('#grp-producto').innerHTML = '<h4>Elegí el producto</h4><div class="chips" role="group" aria-label="Producto"></div>';
  Object.entries(P).forEach(([key, {label}]) => {
    const icon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${SHAPES[key]}</svg>`;
    $('#grp-producto .chips').appendChild(btn({ class: 'chip', 'data-v': key }, `${icon}<span>${label}</span>`));
  });
  $('#grp-tela').innerHTML = '<h4>Tela</h4><p class="fixed-fabric" id="fixedFabric"></p><div class="fab" role="group" aria-label="Tela"></div>';
  Object.entries(TELAS).forEach(([key, [name, description]]) => {
    $('#grp-tela .fab').appendChild(btn({ 'data-v': key }, `<span>${name}</span><small>${description}</small>`));
  });

  $('#grp-colores').innerHTML = `<h4>Color por zona</h4>
   <div class="zpills" role="group" aria-label="Zona a colorear"></div>
   <div class="palette-head"><span id="colorName"></span><button type="button" class="studio-link" id="editColor" aria-controls="slotZone" aria-expanded="false">Color personalizado</button></div>
   <div class="studio-palette" id="palette" role="group" aria-label="Colores rápidos"></div><div id="slotZone"></div>`;
  Object.keys(ZL).forEach(key => $('#grp-colores .zpills').appendChild(btn({ class: 'zp', 'data-z': key }, '<i></i><span></span>')));
  PALETTE.forEach(([hex, name]) => $('#palette').appendChild(btn({'data-hex': hex, 'aria-label': name, title: name}, `<i style="background:${hex}"></i>`)));
  $('#grp-estampa').innerHTML = `<h4>Estampado</h4><div class="prints" role="group" aria-label="Estampado"></div>
   <div id="pcols"><span class="pcl">Colores del estampado</span><div class="pchips">${PCOL.map((key, i) => `<button type="button" class="pc" data-i="${i}" aria-controls="slotPrint" aria-expanded="false"><i></i><span>Color ${i + 1}</span></button>`).join('')}</div></div>
   <div id="slotPrint"></div><label class="toggle"><input type="checkbox" id="printAll"> <span id="printAllText"></span></label>`;
  const patternClasses = { galactico: 'p-gal', splash: 'p-spl', degrade: 'p-deg', rayas: 'p-ray', tiedye: 'p-tie', manitos: 'p-man', camuflaje: 'p-cam', geometrico: 'p-geo', liso: 'p-lis' };
  ['liso', 'splash', 'degrade', 'rayas', 'galactico', 'tiedye', 'manitos', 'camuflaje', 'geometrico'].forEach(key => {
    $('#grp-estampa .prints').appendChild(btn({ 'data-v': key }, `<i class="${patternClasses[key]}"></i><span>${PRESETS_P[key]}</span>`));
  });

  $('#grp-texto').innerHTML = `<h4>Texto <button class="studio-link" id="clearText" type="button">Borrar textos</button></h4><div class="fields">
   <div class="field"><label for="fNombre">Nombre o apodo</label><input id="fNombre" maxlength="14" autocomplete="off" data-k="nombre" placeholder="Ej. Meli"></div>
   <div class="field"><label for="fNum">Número</label><input id="fNum" maxlength="3" inputmode="numeric" data-k="numero" placeholder="26"></div>
   <div class="field full"><label id="labelPrintText" for="fEsp">Texto de espalda</label><input id="fEsp" maxlength="18" data-k="espalda" placeholder="Ej. Promo 26"></div>
   <div class="field full"><label for="fEsc">Escuela, curso o club</label><input id="fEsc" maxlength="32" data-k="escuela"></div>
   <div class="field full"><label for="fFrase">Frase</label><input id="fFrase" maxlength="48" data-k="frase"></div>
   </div>`;
  $('#grp-logo').innerHTML = `<h4>Logo <em>Opcional</em></h4>
   <label class="drop" id="drop"><img class="logo-thumb" alt="" hidden><span class="dt"><b id="logoLabel">Subí tu logo</b><small id="logoHint"></small></span><span class="ac">Elegir archivo</span><input type="file" id="fLogo" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="sr"></label>
   <button type="button" id="removeLogo" class="studio-link" hidden>Quitar logo</button>`;

  $('#grp-talle').innerHTML = `<h4><span id="sizeTitle">Talle</span><a class="studio-link" id="sizeGuide" href="#talles">Ver tabla</a></h4>
   <div class="sizes" role="group" aria-label="Talle"></div>
   <div class="fields order-fields"><div class="field full"><label for="fCant">Cantidad aproximada</label><input id="fCant" inputmode="numeric" maxlength="4" data-k="cantidad"></div></div>
   <div class="order-summary"><b>Tu diseño</b><p id="sumL"></p><p id="sumR"></p></div>
   <p class="order-note">El mensaje de WhatsApp incluye un enlace a tu diseño. Si subiste un logo, adjuntalo al mensaje.</p>
   <div class="render-actions"><button type="button" class="studio-link" id="renderBtn"><span class="spin" aria-hidden="true"></span><span id="renderLabel">Crear imágenes</span></button></div>`;
  selectStep(0);
  wire();
}
function selectStep(index, focus = false) {
  const step = STEPS[index];
  if (!step) return;
  if (index !== currentStep && active) closeWheel();
  currentStep = index;
  $$('#mtabs button').forEach((button, i) => {
    button.setAttribute('aria-selected', index === i);
    button.tabIndex = index === i ? 0 : -1;
  });
  $$('.studio-step', groups).forEach(panel => { panel.hidden = panel.id !== 'step-' + step.id; });
  $('#stepInfo').textContent = `Paso ${index + 1} de ${STEPS.length}`;
  $('#prevStep').disabled = index === 0;
  $('#nextStep').hidden = index === STEPS.length - 1;
  $('#waBtn').hidden = index !== STEPS.length - 1;
  groups.scrollTop = 0;
  if (focus) $('#tab-' + step.id).focus({preventScroll: true});
}
function sizeList() { return P[state.producto].sizes || SIZES; }
function sync() {
  const pr = P[state.producto];
  if (!pr.telas.includes(state.tela) && pr.telas.length) state.tela = pr.telas[0];
  if (!sizeList().includes(state.talle)) state.talle = sizeList()[Math.min(8, sizeList().length - 1)] || sizeList()[0];
  const accessory = state.producto === 'bandera' || state.producto === 'gorra';
  $$('#grp-producto .chip').forEach(button => button.setAttribute('aria-pressed', button.dataset.v === state.producto));
  $$('#grp-tela .fab button').forEach(button => {
    button.hidden = !pr.telas.includes(button.dataset.v);
    button.setAttribute('aria-pressed', button.dataset.v === state.tela);
  });
  $('#grp-tela .fab').classList.toggle('single', pr.telas.length === 1);
  $('#fixedFabric').textContent = pr.fixed || '';
  $('#fixedFabric').hidden = !pr.fixed;

  if (!pr.zones[zone]) zone = 'cuerpo';
  const customZone = active?.kind === 'zone';
  $$('#grp-colores .zp').forEach(button => {
    const key = button.dataset.z;
    const label = pr.zones[key];
    button.hidden = !label;
    button.querySelector('span').textContent = label || '';
    button.querySelector('i').style.background = state.colors[key];
    button.setAttribute('aria-pressed', key === zone);
  });
  const color = state.colors[zone];
  $('#colorName').textContent = cname(color) === color ? color.toUpperCase() : cname(color);
  $$('#palette button').forEach(button => button.setAttribute('aria-pressed', button.dataset.hex === color));
  $('#editColor').setAttribute('aria-expanded', customZone);

  const plain = state.preset === 'liso';
  $('#pcols').hidden = plain;
  if (plain && active?.kind === 'print') closeWheel();
  $$('#pcols .pc').forEach((button, i) => {
    button.querySelector('i').style.background = state.colors[PCOL[i]];
    button.setAttribute('aria-expanded', active?.kind === 'print' && active.i === i);
  });
  $$('#grp-estampa .prints button').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.v === state.preset);
    const swatch = button.querySelector('i').style;
    swatch.setProperty('--b', state.colors.cuerpo);
    swatch.setProperty('--a', state.colors.acento);
    swatch.setProperty('--a2', state.colors.acento2);
    swatch.setProperty('--a3', state.colors.acento3);
  });
  $('#printAll').checked = state.printAll;
  $('#printAll').closest('.toggle').hidden = plain || accessory || !pr.zones.mangas;
  $('#printAllText').textContent = pr.zones.capucha ? 'Aplicar también en mangas y capucha' : 'Aplicar también en mangas';

  for (const id of ['fNombre', 'fNum', 'fFrase']) $('#' + id).closest('.field').hidden = accessory;
  $('#fEsc').closest('.field').hidden = state.producto === 'gorra';
  $('#labelPrintText').textContent = accessory ? 'Texto principal' : 'Texto de espalda';
  $('#logoHint').textContent = accessory ? 'PNG, JPG, SVG o WebP · frente' : 'PNG, JPG, SVG o WebP · en el pecho';
  $$('#groups input[data-k]').forEach(input => {
    if (document.activeElement !== input) input.value = state[input.dataset.k] ?? '';
  });
  $('#clearText').disabled = !$$('#grp-texto .field:not([hidden]) input').some(input => state[input.dataset.k]);
  const sizes = $('#grp-talle .sizes'), list = sizeList();
  const sizeLabel = state.producto === 'bandera' ? 'Medidas' : 'Talle';
  $('#sizeTitle').textContent = sizeLabel;
  sizes.setAttribute('aria-label', sizeLabel);
  $('#sizeGuide').hidden = accessory;
  if (sizes.dataset.p !== state.producto) {
    sizes.replaceChildren(...list.map(size => btn({ 'data-v': size }, size)));
    sizes.dataset.p = state.producto;
    sizes.classList.toggle('wide', list.length <= 3);
  }
  $$('.sizes button').forEach(button => button.setAttribute('aria-pressed', button.dataset.v === state.talle));

  const fabric = pr.telas.length ? TELAS[state.tela][0] : pr.fixed;
  $('#crumbT').textContent = pr.crumb;
  const fit = (accessory ? '' : 'Talle ') + state.talle;
  $('#crumbS').textContent = `${fabric} · ${fit}`;
  $('#sumL').textContent = `${pr.label} · ${fabric} · ${PRESETS_P[state.preset]}`;
  $('#sumR').textContent = [fit, state.cantidad && `${state.cantidad} unidades`].filter(Boolean).join(' · ');
  $('#waBtn').href = waLink();
  const fallback = $('#fb');
  if (fallback) {
    fallback.querySelector('button').onclick = () => selectStep(3, true);
    fallback.querySelector('img').src = FALLBACK_IMG[state.producto];
  }
  saveHash();
}
function designHash() {
  const { logoImg, ...design } = state;
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(design))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return '#d=' + encoded;
}
let hashT, hashReady = false;
function saveHash() {
  if (!hashReady) return;
  clearTimeout(hashT);
  hashT = setTimeout(() => history.replaceState(history.state, '', designHash()), 400);
}
function waLink() {
  const pr = P[state.producto], z = pr.zones;
  const hx = h => { const n = cname(h); return h.toUpperCase() + (n !== h ? ` (${n})` : ''); };
  const cols = Object.entries(z).filter(([, l]) => l).map(([k, l]) => `${l}: ${hx(state.colors[k])}`);
  const L = [
    '¡Hola Impronta! Quiero pedir presupuesto por este diseño:', '',
    `• Producto: ${pr.crumb}`, `• Tela: ${pr.telas.length ? TELAS[state.tela][0] : pr.fixed}`, `• Colores por zona: ${cols.join(' · ')}`,
    `• Estampado: ${PRESETS_P[state.preset]}${state.printAll && state.preset !== 'liso' && z.mangas && !pr.fixed ? (z.capucha ? ' (incluye mangas y capucha)' : ' (incluye mangas)') : ''}`,
    state.preset !== 'liso' && `• Colores del estampado: ${PCOL.map((k, i) => `${i + 1}) ${hx(state.colors[k])}`).join(' · ')}`,
    !pr.fixed && state.nombre && `• Nombre: ${state.nombre}`, !pr.fixed && state.numero && `• Número: ${state.numero}`,
    state.espalda && `• ${pr.fixed ? 'Texto principal' : 'Texto espalda'}: ${state.espalda}`, state.producto !== 'gorra' && state.escuela && `• Escuela / curso: ${state.escuela}`, !pr.fixed && state.frase && `• Frase: ${state.frase}`,
    state.logoImg && '• Logo: lo adjunto en este chat', `• Talle: ${state.talle}`, state.cantidad && `• Cantidad aprox.: ${state.cantidad}`, '',
    `Ver el diseño en 3D: ${location.protocol === 'file:' || /^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? CANONICAL_ORIGIN : location.href.split('#')[0]}${designHash()}`,
    '', 'Detalles extra: ',
  ].filter(Boolean);
  return `https://wa.me/${WA}?text=${encodeURIComponent(L.join('\n'))}`;
}
function wire() {
  groups.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button || button.disabled || button.closest('.cw')) return;
    const { v, z, i, hex } = button.dataset;
    if (button.matches('.chip')) setProduct(v);
    if (button.closest('.fab')) { state.tela = v; sync(); api?.repaint('fade'); }
    if (z) selectZone(z);
    if (hex) { state.colors[zone] = hex; wheel.set(hex); sync(); liveRepaint(true); }
    if (button.id === 'editColor') {
      if (active?.kind === 'zone') closeWheel();
      else openWheel({ kind: 'zone', key: zone }, $('#slotZone'), P[state.producto].zones[zone]);
    }
    if (button.matches('.pc')) {
      if (active?.kind === 'print' && active.i === Number(i)) closeWheel();
      else openWheel({ kind: 'print', key: PCOL[i], i: Number(i) }, $('#slotPrint'), `Color ${Number(i) + 1} del estampado`);
    }
    if (button.closest('.prints')) { state.preset = v; sync(); api?.repaint('wipe'); }
    if (button.closest('.sizes')) { state.talle = v; sync(); }
    if (button.id === 'clearText') {
      $$('#grp-texto .field:not([hidden]) input').forEach(input => { state[input.dataset.k] = ''; });
      sync();
      api?.repaint('fade');
    }
  });
  $('#printAll').addEventListener('change', e => { state.printAll = e.target.checked; sync(); api?.repaint('wipe'); });
  let textTimer;
  $$('#groups input[data-k]').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.k;
      if (key === 'numero' || key === 'cantidad') input.value = input.value.replace(/\D/g, '');
      state[key] = input.value;
      sync();
      if (key === 'cantidad') return;
      clearTimeout(textTimer);
      textTimer = setTimeout(() => api?.repaint('fade'), 100);
    });
    input.addEventListener('focus', () => {
      if (input.id === 'fCant') return;
      const accessory = Boolean(P[state.producto].fixed);
      const front = accessory || input.id === 'fNombre' || (input.id === 'fEsc' && state.producto !== 'campera');
      if (api) showAngle(front ? 0 : Math.PI);
    });
  });
  const drop = $('#drop'), file = $('#fLogo'), thumb = $('.logo-thumb', drop);
  let logoUrl = '';
  let logoRequest = 0;
  function takeLogo(upload) {
    if (!upload) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(upload.type)) return toast('Elegí un logo en PNG, JPG, SVG o WebP.');
    const request = ++logoRequest;
    const url = URL.createObjectURL(upload);
    const image = new Image();
    image.onload = () => {
      if (request !== logoRequest) { URL.revokeObjectURL(url); return; }
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      logoUrl = url;
      state.logoImg = image;
      thumb.src = url;
      thumb.hidden = false;
      $('#logoLabel').textContent = upload.name;
      $('#removeLogo').hidden = false;
      sync();
      showAngle(0);
      api?.repaint('fade');
      toast('Logo aplicado al diseño');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if (request === logoRequest) toast('No pudimos abrir esa imagen. Probá con otro archivo.');
    };
    image.src = url;
  }
  file.addEventListener('change', () => { takeLogo(file.files[0]); file.value = ''; });
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => takeLogo(e.dataTransfer.files[0]));
  $('#removeLogo').addEventListener('click', () => {
    logoRequest++;
    URL.revokeObjectURL(logoUrl);
    logoUrl = '';
    state.logoImg = null;
    thumb.removeAttribute('src');
    thumb.hidden = true;
    $('#removeLogo').hidden = true;
    $('#logoLabel').textContent = 'Subí tu logo';
    sync();
    api?.repaint('fade');
    file.focus();
  });
  tabs.addEventListener('click', e => {
    const pick = e.target.closest('[data-index]');
    if (pick) selectStep(Number(pick.dataset.index));
  });
  tabs.addEventListener('keydown', e => {
    const n = STEPS.length;
    const index = { ArrowLeft: (currentStep + n - 1) % n, ArrowRight: (currentStep + 1) % n, Home: 0, End: n - 1 }[e.key];
    if (index === undefined) return;
    e.preventDefault();
    selectStep(index, true);
  });
  $('#nextStep').onclick = () => selectStep(currentStep + 1, true);
  $('#prevStep').onclick = () => selectStep(currentStep - 1, true);
  $('#sizeGuide').addEventListener('click', e => {
    if (!document.body.classList.contains('dz')) return;
    e.preventDefault();
    closeDz(true);
    history.replaceState(null, '', location.href);
    $('#tdet').open = true;
    $('#talles').scrollIntoView({behavior: 'smooth'});
  });
  $('#renderBtn').onclick = doRender;
}

/* ---------- color editing ---------- */
let active = null, repaintTimer = 0, lastRepaint = 0;
function liveRepaint(commit) {
  if (!api) return;
  const now = performance.now(), gap = api.lowPower ? 230 : 100;
  clearTimeout(repaintTimer);
  const repaint = () => { lastRepaint = performance.now(); api.repaint('fade'); };
  if (commit || now - lastRepaint > gap) repaint();
  else repaintTimer = setTimeout(repaint, gap - (now - lastRepaint));
}
const wheel = createWheel({
  seed: PALETTE.map(([color]) => color).slice(0, 8),
  onInput(hex, commit) {
    if (!active) return;
    state.colors[active.key] = hex;
    sync();
    liveRepaint(commit);
  },
  onClose() {
    const trigger = active?.kind === 'zone' ? $('#editColor') : $('.pc[aria-expanded=true]');
    closeWheel();
    trigger?.focus({preventScroll: true});
  },
});
function closeWheel() {
  active = null;
  wheel.close();
  $('#editColor').setAttribute('aria-expanded', 'false');
  $$('.pc').forEach(button => button.setAttribute('aria-expanded', 'false'));
}
function selectZone(key, from3D = false) {
  if (!P[state.producto].zones[key]) return;
  if (from3D && STEPS[currentStep].id !== 'color') selectStep(1);
  if (active?.kind === 'print') closeWheel();
  zone = key;
  if (active?.kind === 'zone') {
    active.key = key;
    wheel.open($('#slotZone'), P[state.producto].zones[key], state.colors[key]);
  }
  sync();
  api?.highlight(key, true);
  if (from3D) groups.scrollTop = 0;
}
function openWheel(selection, slot, title) {
  active = selection;
  wheel.open(slot, title, state.colors[selection.key]);
  sync();
  requestAnimationFrame(() => {
    const bounds = slot.getBoundingClientRect();
    const container = groups.getBoundingClientRect();
    const offset = Math.max(0, bounds.bottom - container.bottom + 12);
    groups.scrollBy({ top: Math.min(offset, Math.max(0, bounds.top - container.top - 8)), behavior: 'smooth' });
  });
}
function setProduct(product) {
  if (product === state.producto) return;
  closeWheel();
  if (state.frase === P[state.producto].frase) state.frase = P[product].frase;
  state.producto = product;
  sync();
  api?.rebuild(true);
}

/* ---------- lazy 3D ---------- */
// The 3D studio ships as a classic script (js/studio.js) so the site also works when opened from file://.
let api = null, loading = null, failed = false;
const FALLBACK_IMG = { remera: 'img/hero-render.webp', campera: 'img/show-egresados.webp', conjunto: 'img/show-deportivos.webp', musculosa: 'img/preset-zumba.webp', bandera: 'img/show-banderas.webp', gorra: 'img/show-gorras.webp' };
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); }); }
function webglOK() { try { const c = document.createElement('canvas'); const gl = window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')); if (!gl) return false; const x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); return true; } catch (e) { return false; } }
function showFallback(reason) {
  if (failed || $('#viewer').classList.contains('ready')) return; failed = true;
  console.warn('[impronta] 3D no disponible:', reason);
  const v = $('#viewer'); v.classList.add('fallback'); v.setAttribute('aria-busy', 'false');
  const l = $('#loader'); if (l) l.remove();
  const f = document.createElement('div'); f.className = 'fb'; f.id = 'fb';
  f.innerHTML = `<img src="${FALLBACK_IMG[state.producto] || 'img/poster.webp'}" alt="Ejemplo de diseño de ${P[state.producto].label.toLowerCase()}"><div class="fbx"><b>El estudio 3D no pudo abrirse en este dispositivo</b><p>No pasa nada: elegí tus opciones en el panel y mandanos el pedido por WhatsApp. Te armamos la propuesta en 3D nosotros.</p><button class="btn btn-red" type="button">Ir al pedido</button></div>`;
  v.appendChild(f);
  sync();
}
function load3D() {
  if (loading) return loading;
  const t0 = performance.now();
  const timer = setTimeout(() => showFallback('timeout'), 10000);
  loading = (async () => {
    if (!webglOK()) throw new Error('WebGL no disponible');
    if (!window.ImprontaStudio) await loadScript('js/studio.js');
    try { await Promise.race([Promise.all(['10px Anton', '600 10px "Barlow Condensed"', 'italic 10px "DM Serif Display"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
    await new Promise((res, rej) => {
      api = window.ImprontaStudio.createConfigurator($('#gl'), state, { onReady: () => {
        clearTimeout(timer);
        const v = $('#viewer'); v.classList.remove('fallback'); v.classList.add('ready'); v.setAttribute('aria-busy', 'false');
        const fb = $('#fb'); if (fb) fb.remove(); failed = false;
        const l = $('#loader'); if (l) { l.setAttribute('aria-hidden', 'true'); setTimeout(() => l.remove(), 700); }
        res();
      }, onError: rej, onLost: () => { const v = $('#viewer'); v.classList.remove('ready'); failed = false; showFallback('se perdió el contexto WebGL'); } });
    });
    window.__impronta = { api, state, applyPreset, sync, loadMs: Math.round(performance.now() - t0) };
    applyFit();
    api.onZonePick(z => selectZone(z, true));
    api.setZones(() => Object.keys(P[state.producto].zones).filter(z => P[state.producto].zones[z]));
    api.onView(view => {
      $('#autoBtn').setAttribute('aria-pressed', view.auto);
      const angles = segment.querySelectorAll('button');
      angles.forEach(button => {
        const offset = view.targetYaw - Number(button.dataset.yaw);
        button.setAttribute('aria-pressed', !view.auto && Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset))) < 0.018);
      });
    });
    return api;
  })().catch(err => { clearTimeout(timer); api = null; showFallback(err && err.message || err); return null; });
  return loading;
}
window.__improntaFallback = showFallback;
// start the 3D only when the designer is near and the browser is idle (never while the hero is being scrolled hard)
const idle = cb => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1200 }) : setTimeout(cb, 200));
const vio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { vio.disconnect(); idle(() => load3D()); } }, { rootMargin: '350px 0px' });
vio.observe($('#viewer'));

/* viewer controls */
const segment = $('#seg');
function showAngle(angle) {
  load3D().then(studio => studio?.setYaw(angle));
}
segment.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) showAngle(Number(button.dataset.yaw));
});
$('#zIn').onclick = () => api?.zoomBy(1.18);
$('#zOut').onclick = () => api?.zoomBy(1 / 1.18);
$('#autoBtn').onclick = () => api?.toggleAuto();
$('#resetBtn').onclick = () => api?.resetView();

/* ---------- renders ---------- */
let shots = [], shotKey = '', shotLogo = null;
function discardShots() {
  shots.forEach(shot => URL.revokeObjectURL(shot.obj));
  shots = [];
}
async function doRender() {
  const button = $('#renderBtn');
  if (button.disabled) return;
  button.classList.add('busy');
  button.disabled = true;
  $('#renderLabel').textContent = 'Creando imágenes…';
  try {
    const studio = await load3D();
    if (!studio || $('#viewer').classList.contains('fallback')) {
      toast('La vista 3D no está disponible. Podés pedir las imágenes por WhatsApp.');
      return;
    }
    const key = designHash(), logo = state.logoImg;
    if (!shots.length || key !== shotKey || logo !== shotLogo) {
      const editor = $('#cfg');
      editor.inert = true;
      let result;
      try { result = await studio.renderSet(); }
      finally { editor.inert = false; }
      if (key !== designHash() || logo !== state.logoImg) {
        toast('El diseño cambió. Volvé a crear las imágenes.');
        return;
      }
      discardShots();
      shots = result.map(shot => {
        const blob = dataURLtoBlob(shot.url);
        return { name: shot.name, blob, obj: URL.createObjectURL(blob) };
      });
      shotKey = key;
      shotLogo = logo;
    }
    openLb(shots.map(shot => ({
      src: shot.obj,
      name: { frente: 'Frente', espalda: 'Espalda', perfil: 'Perfil', '3-4': '3/4' }[shot.name],
      dl: `${fileBase()}-${shot.name}.png`,
    })), 0);
  } catch (error) {
    console.error(error);
    toast('No se pudieron crear las imágenes. Volvé a intentarlo.');
  } finally {
    button.classList.remove('busy');
    button.disabled = false;
    $('#renderLabel').textContent = 'Crear imágenes';
  }
}
function dataURLtoBlob(u) { const [h, d] = u.split(','); const bin = atob(d); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: h.match(/:(.*?);/)[1] }); }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h, name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cen.push(c, name); off += 30 + name.length + data.length;
  }
  const csize = cen.reduce((s, x) => s + x.byteLength, 0); const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e], { type: 'application/zip' });
}
function fileBase() { return `impronta-${state.producto}-${(state.nombre || 'diseno').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
async function downloadZip() {
  if (!shots.length) return;
  const z = await makeZip(shots.map(s => ({ name: `${fileBase()}-${s.name}.png`, blob: s.blob })));
  const url = URL.createObjectURL(z);
  const a = document.createElement('a'); a.href = url; a.download = fileBase() + '-renders.zip'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Descargando renders. Adjuntalos en WhatsApp.');
}
$('#lbZip').onclick = downloadZip;

/* ---------- lightbox ---------- */
let lbItems = [], lbI = 0, lastFocus;
function openLb(items, i) { lbItems = items; lastFocus = document.activeElement; $('#lbS').innerHTML = ''; items.forEach((it, k) => { const b = btn({ 'aria-label': it.name }, `<img src="${it.src}" alt="">`); b.onclick = () => showLb(k); $('#lbS').appendChild(b); }); $('#lbS').style.display = items.length > 1 ? '' : 'none'; $('#lbZip').style.display = items[0].dl ? '' : 'none'; $('#lbP').style.display = $('#lbN').style.display = items.length > 1 ? '' : 'none'; showLb(i); $('#lb').classList.add('open'); document.body.style.overflow = 'hidden'; $('#lbX').focus(); }
function showLb(i) { lbI = (i + lbItems.length) % lbItems.length; const it = lbItems[lbI]; const im = $('#lbImg'); im.style.opacity = 0; setTimeout(() => { im.src = it.src; im.alt = it.name; im.style.opacity = 1; }, 120); $('#lbT').textContent = it.name.replace('3-4', '3/4'); const dl = $('#lbDl'); dl.href = it.src; dl.download = it.dl || it.src.split('/').pop(); $$('#lbS button').forEach((b, k) => b.classList.toggle('on', k === lbI)); }
function closeLb() { $('#lb').classList.remove('open'); document.body.style.overflow = ''; lastFocus && lastFocus.focus(); }
$('#lbX').onclick = closeLb; $('#lbP').onclick = () => showLb(lbI - 1); $('#lbN').onclick = () => showLb(lbI + 1);
$('#lb').addEventListener('click', e => { if (e.target.classList.contains('stage')) closeLb(); });
document.addEventListener('keydown', e => { if (!$('#lb').classList.contains('open')) { if (e.key === 'Escape') closeMenu(); return; } if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') showLb(lbI - 1); if (e.key === 'ArrowRight') showLb(lbI + 1); });
let tx0 = null; $('#lb .stage').addEventListener('touchstart', e => (tx0 = e.touches[0].clientX), { passive: true }); $('#lb .stage').addEventListener('touchend', e => { if (tx0 == null) return; const d = e.changedTouches[0].clientX - tx0; if (Math.abs(d) > 50) showLb(lbI + (d < 0 ? 1 : -1)); tx0 = null; });

/* ---------- gallery ---------- */
function applyPreset(key) {
  const preset = clone(PRESETS[key] || {});
  const base = clone(DEFAULT);
  const logo = state.logoImg;
  Object.assign(state, base, preset, { colors: { ...base.colors, ...preset.colors }, logoImg: logo });
  closeWheel();
  sync();
  selectStep(1);
  api?.rebuild(true);
}
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('button.ph2'); if (!b) return;
  if (b.dataset.preset) { applyPreset(b.dataset.preset); load3D(); if (MQ.matches) { openDz(); return; } $('#cfg').scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('Diseño cargado en el diseñador 3D. Personalizalo a tu gusto.'); }
  else if (b.dataset.lb) { const all = $$('#grid .card:not(.hide) button[data-lb]'); openLb(all.map(x => ({ src: x.dataset.lb, name: x.closest('.card').querySelector('.cap b').textContent })), all.indexOf(b)); }
});
function setFilter(f) { $$('#filters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); let n = 0; $$('#grid .card').forEach(c => { const show = f === 'all' || c.dataset.cat === f; c.classList.toggle('hide', !show); if (show) { n++; c.classList.add('in'); } }); $('#gcount').textContent = `Mostrando ${n} de 211`; }
$('#filters').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFilter(b.dataset.f); });
$$('[data-product]').forEach(a => a.addEventListener('click', () => { load3D(); setProduct(a.dataset.product); selectStep(0); }));

/* ---------- nav, menu, reveal, parallax ---------- */
const nav = $('#nav'), fab = $('#fabWa'), heroEl = $('#hero'); const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// sticky product showcase: the item crossing the middle of the viewport drives the image on the left
{ const imgs = $$('.show-media img'), items = $$('.pitem'); let cur = -1;
  const setI = i => { if (i === cur) return; cur = i; items.forEach(it => it.classList.toggle('on', +it.dataset.i === i)); imgs.forEach(im => im.classList.toggle('on', +im.dataset.i === i)); };
  const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setI(+e.target.dataset.i); }), { rootMargin: '-45% 0px -45% 0px' });
  items.forEach(it => sio.observe(it)); setI(0); }
const fabHide = new Set();
new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? fabHide.add(e.target) : fabHide.delete(e.target)); fab.classList.toggle('show', scrollY > innerHeight * 0.9 && !fabHide.size); }, { rootMargin: '-15% 0px -15% 0px' }).observe($('#contacto'));
document.querySelectorAll('.config .panel, footer').forEach(el => fabHide && new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? fabHide.add(e.target) : fabHide.delete(e.target)); fab.classList.toggle('show', scrollY > innerHeight * 0.9 && !fabHide.size); }).observe(el));
let ticking = false;
addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { const y = scrollY; nav.classList.toggle('scrolled', y > 40); fab.classList.toggle('show', y > innerHeight * 0.9 && !fabHide.size); if (y < innerHeight * 1.5 && !reduceMotion) heroEl.style.setProperty('--hp', Math.min(1, y / (innerHeight * 0.9)).toFixed(4)); ticking = false; }); }, { passive: true });
const menu = $('#menu');
function openMenu() { menu.classList.add('open'); $('#menuBtn').setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; $('#menuClose').focus(); }
function closeMenu() { if (!menu.classList.contains('open')) return; menu.classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
$('#menuBtn').onclick = openMenu; $('#menuClose').onclick = closeMenu; $$('#menu nav a').forEach(a => a.addEventListener('click', closeMenu));
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
$$('.rv,.split').forEach(el => rio.observe(el));
window.__appOK = true; // the inline failsafe in <head> reveals everything if we never get here
/* scroll-spy: the active link is the section that contains a probe line 35% down the viewport (position-based, no IO ordering issues) */
const spyIds = ['configurador', 'trabajos', 'productos', 'talles', 'contacto'].filter(id => document.querySelector(`.nav ul a[href="#${id}"]`));
const spyLinks = $$('.nav ul a'); let spyCur = null, spyT = false;
function spy() {
  spyT = false; const probe = innerHeight * 0.35; let cur = null;
  for (const id of spyIds) { const r = document.getElementById(id).getBoundingClientRect(); if (r.top <= probe && r.bottom > probe) { cur = id; break; } }
  if (!cur && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = 'contacto';
  if (cur === spyCur) return; spyCur = cur;
  spyLinks.forEach(a => { const on = a.getAttribute('href') === '#' + cur; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'); });
}
addEventListener('scroll', () => { if (!spyT) { spyT = true; requestAnimationFrame(spy); } }, { passive: true });
addEventListener('resize', spy); spy();

buildPanel(); sync(); hashReady = true; setFilter('all');
document.fonts?.ready.then(() => api?.repaint());
if (openedDesign) requestAnimationFrame(() => {
  $('#configurador').scrollIntoView({behavior: 'instant'});
  if (MQ.matches) openDz();
});

/* ---------- mobile: full-screen app-like designer ---------- */
let designerTrigger;
function openDz() {
  if (!MQ.matches) { document.getElementById('configurador').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (document.body.classList.contains('dz')) return;
  designerTrigger = document.activeElement;
  document.body.classList.add('dz');
  document.documentElement.classList.add('dz-lock');
  const editor = $('#cfg');
  editor.setAttribute('role', 'dialog');
  editor.setAttribute('aria-modal', 'true');
  editor.setAttribute('aria-label', 'Estudio de diseño');
  fitViewport();
  try { history.pushState({ dz: 1 }, '', location.href); } catch (e) { }
  load3D(); requestAnimationFrame(() => { applyFit(); $('#closeDz').focus({ preventScroll: true }); });
}
function closeDz(fromPop) {
  if (!document.body.classList.contains('dz')) return;
  document.body.classList.remove('dz', 'dz-keyboard');
  document.documentElement.classList.remove('dz-lock');
  const editor = $('#cfg');
  ['role', 'aria-modal', 'aria-label'].forEach(attribute => editor.removeAttribute(attribute));
  editor.style.removeProperty('--studio-height');
  applyFit();
  if (!fromPop && history.state && history.state.dz) { try { history.back(); } catch (e) { } }
  const returnTarget = designerTrigger?.getClientRects().length ? designerTrigger : $('#openDz');
  returnTarget.focus({ preventScroll: true });
}
$('#openDz').addEventListener('click', openDz);
$('#closeDz').addEventListener('click', () => closeDz(false));
addEventListener('popstate', () => closeDz(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('dz') && !$('#lb').classList.contains('open') && !menu.classList.contains('open')) closeDz(false); }, true); // capture: runs before the lightbox's own Esc handler
(MQ.addEventListener ? MQ.addEventListener('change', () => { if (!MQ.matches) closeDz(false); }) : MQ.addListener(() => { if (!MQ.matches) closeDz(false); }));
// on phones every "design it" link opens the full-screen designer
document.addEventListener('click', e => { const a = e.target.closest('a[href="#configurador"]'); if (!a || !MQ.matches) return; e.preventDefault(); closeMenu(); openDz(); });
// size tables: collapsed on phones, always open on desktop
{ const td = document.getElementById('tdet'); if (td && MQ.matches) td.open = false; }
// Keep keyboard focus inside the designer while it is open as a mobile dialog.
$('#cfg').addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !document.body.classList.contains('dz')) return;
  const available = $$('button:not(:disabled), a[href], input, [tabindex]', $('#cfg'))
    .filter(element => element.tabIndex >= 0 && element.getClientRects().length);
  const boundary = e.shiftKey ? available[0] : available[available.length - 1];
  if (e.target !== boundary) return;
  e.preventDefault();
  (e.shiftKey ? available[available.length - 1] : available[0]).focus();
});
function fitViewport() {
  const viewport = window.visualViewport;
  if (!viewport || !document.body.classList.contains('dz')) return;
  $('#cfg').style.setProperty('--studio-height', `${Math.round(viewport.height)}px`);
  document.body.classList.toggle('dz-keyboard', innerHeight - viewport.height > 140);
}
window.visualViewport?.addEventListener('resize', fitViewport);

// Fit the product between the viewer header and the angle controls.
function applyFit() {
  if (!api) return;
  const viewer = $('#viewer').getBoundingClientRect();
  if (viewer.width < 1 || viewer.height < 1) return;
  const header = $('.vtop').getBoundingClientRect();
  const controls = $('.view-bottom').getBoundingClientRect();
  api.setFit({
    top: Math.max(0, header.bottom - viewer.top) + 6,
    bottom: Math.max(0, viewer.bottom - controls.top) + 8,
    fill: 0.93,
    touch: document.body.classList.contains('dz'),
  });
}
new ResizeObserver(applyFit).observe($('#viewer'));
