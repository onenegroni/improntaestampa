// Impronta Estampa — page logic (UI, lazy 3D, gallery, WhatsApp, renders)
import { createWheel, normHex } from './colorwheel.js';
import { segments } from '../data/catalogue.json';
import { PRODUCTS as P, MATERIALS, TECHNIQUES, LOCAL_DTF, CONSULT, optionsFor, compatiblePrint } from './product-data.js';
import { ARTWORK, DESIGN_LIBRARY, MOTIF_SIZES, PATTERNS, PERSONALIZATION, PLACEMENTS, TRICOLOR_BANDS, TYPEFACES, availableTemplates, hasMotifSizes, placementChoices } from './design-library.js';
import { drawIllustration } from './illustrations.js';
const CANONICAL_ORIGIN = 'https://improntaestampa.pages.dev/';
const WA = '5492644127431';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PALETTE = [['#141414', 'Negro'], ['#f2efe9', 'Blanco'], ['#6b6b6b', 'Gris'], ['#b5141a', 'Rojo Impronta'], ['#e8742a', 'Naranja'], ['#f2c230', 'Amarillo'], ['#8fd3cf', 'Aqua'], ['#9fc8e8', 'Celeste'], ['#1e2f5c', 'Azul marino'], ['#5b2a86', 'Violeta']];
const cname = h => (PALETTE.find(p => p[0] === h) || [0, h])[1];
const PRESETS_P = Object.fromEntries(Object.entries(PATTERNS).map(([id,[label]])=>[id,label]));
const PCOL = TRICOLOR_BANDS.map(([key]) => key);
const ZONES = ['cuerpo', 'short', 'mangas', 'capucha', 'punos', 'malla'];
const DEFAULT = { segmento: 'primaria', producto: 'remera', tela: 'deportiva', colors: { cuerpo: '#141414', short: '#141414', malla: '#141414', mangas: '#b5141a', capucha: '#141414', punos: '#f2efe9', acento: '#b5141a', acento2: '#f4f1ec', acento3: '#7a0d12' }, preset: 'splash', printAll: false, nombre: 'MELI', numero: '26', espalda: 'PROMO 26', escuela: 'ESCUELA SARMIENTO', frase: 'Más que una remera, un recuerdo para siempre', talle: 'M', cantidad: '30' };
const PRESETS = {
  promo26: {},
  galaxia: { producto: 'campera', tela: 'frizado', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#141414', acento: '#9fc8e8', acento2: '#6a2fa6', acento3: '#1f6fd1' }, preset: 'galactico', printAll: true, frase: 'Más que una campera, un recuerdo para siempre' },
  seleccion: { producto: 'conjunto', tela: 'deportiva', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#9fc8e8', acento: '#9fc8e8', acento2: '#f4f1ec', acento3: '#1e2f5c' }, preset: 'rayas', printAll: false, nombre: 'GÓMEZ', numero: '15', espalda: 'SELECCIÓN', escuela: 'CALINGASTA', frase: '' },
  zumba: { producto: 'musculosa', tela: 'deportiva', colors: { cuerpo: '#f2efe9', mangas: '#f2efe9', capucha: '#f2efe9', punos: '#141414', acento: '#e8742a', acento2: '#e8742a', acento3: '#b5141a' }, preset: 'degrade', printAll: false, nombre: 'SOFI', numero: '', espalda: 'ZUMBA', escuela: 'REY PILATES', frase: '' },
  tiedye: { producto: 'remera', tela: 'deportiva', colors: { cuerpo: '#2f8fe0', mangas: '#2f8fe0', capucha: '#2f8fe0', punos: '#141414', acento: '#e8432a', acento2: '#f2c230', acento3: '#8a3fb8' }, preset: 'tiedye', printAll: true },
  colorin: { producto: 'campera', tela: 'frizado', colors: { cuerpo: '#58b8ec', mangas: '#58b8ec', capucha: '#58b8ec', punos: '#141414', acento: '#e8432a', acento2: '#f2c230', acento3: '#7a3fb4' }, preset: 'manitos', printAll: true, nombre: 'MELI', numero: '', espalda: 'PRIMER GRADO', escuela: 'COLORÍN COLORADO', frase: 'Nos vemos en primer grado · Promo 26' },
  bandera: { producto: 'bandera', colors: { cuerpo: '#141414', mangas: '#141414', capucha: '#141414', punos: '#f2efe9', acento: '#b5141a' }, preset: 'splash', espalda: 'PROMO 26', escuela: 'ESCUELA SARMIENTO', talle: '150×90 cm' },
};
const clone = value => JSON.parse(JSON.stringify(value));
const state = clone(DEFAULT);
const cleanPersonalization = { nombre:'', numero:'', espalda:'', escuela:'', frase:'', mangaDer:'', mangaIzq:'',
  nombreLugar:'', numeroLugar:'', espaldaLugar:'', logoLugar:'', arteLugar:'', tipografia:'', arte:'', plantilla:'', escalaMotivo:'mediano' };
state.escalaMotivo = cleanPersonalization.escalaMotivo;
const openedDesign = location.hash.startsWith('#d=');
if (!openedDesign) {
  Object.assign(state, cleanPersonalization, { preset:'liso', tipografia:'moderna', cantidad:'' });
  Object.assign(state.colors, { cuerpo:'#174789', mangas:'#174789', punos:'#133368', capucha:'#174789' });
}
if (openedDesign) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')))));
    if (Object.prototype.hasOwnProperty.call(P, data.producto)) state.producto = data.producto;
    if (Object.prototype.hasOwnProperty.call(MATERIALS, data.tela)) state.tela = data.tela;
    if (Object.prototype.hasOwnProperty.call(segments, data.segmento)) state.segmento = data.segmento;
    if (Object.prototype.hasOwnProperty.call(PRESETS_P, data.preset)) state.preset = data.preset;
    const savedColors = data.colors || {};
    for (const key of Object.keys(state.colors)) state.colors[key] = normHex(savedColors[key]) || state.colors[key];
    // Older kits used the shirt color for both garments.
    if (state.producto === 'conjunto' && !normHex(savedColors.short)) state.colors.short = state.colors.cuerpo;
    for (const [key, limit] of Object.entries({ nombre: 14, numero: 3, espalda: 18, escuela: 32, frase: 48, mangaDer:9, mangaIzq:9, talle: 24, cantidad: 4 })) {
      if (typeof data[key] === 'string') state[key] = data[key].slice(0, limit);
    }
    for (const key of Object.keys(PERSONALIZATION)) if (Object.prototype.hasOwnProperty.call(PLACEMENTS,data[key])) state[key]=data[key];
    if (Object.prototype.hasOwnProperty.call(TYPEFACES,data.tipografia)) state.tipografia=data.tipografia;
    if (Object.prototype.hasOwnProperty.call(ARTWORK,data.arte)) state.arte=data.arte;
    if (Object.prototype.hasOwnProperty.call(MOTIF_SIZES,data.escalaMotivo)) state.escalaMotivo=data.escalaMotivo;
    if (DESIGN_LIBRARY.some(template=>template.id===data.plantilla)) state.plantilla=data.plantilla;
    if (state.producto === 'gorra' && state.talle === 'Único ajustable') state.talle = 'Adulto ajustable';
    if (/^T(?:S|M|L|XL|XXL)$/.test(state.talle)) state.talle = state.talle.slice(1);
    state.printAll = data.printAll === true;
  } catch (error) { /* A malformed link opens the default design. */ }
}
state.logoImg = null;
let startMode = state.plantilla ? 'library' : '';
let clearUploadedLogo;

/* ---------- toast ---------- */
let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- panel UI ---------- */
const groups = $('#groups'), tabs = $('#mtabs');
const STEPS = [
  { id: 'modelo', label: 'Modelo', sections: ['producto','inicio','tela'] },
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
  short: '<path d="M6 4h12l3 15-7 1-2-6-2 6-7-1L6 4Zm0 4h12"/>',
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

  $('#grp-inicio').innerHTML = `<h4>Diseño base</h4><div class="design-start" role="group" aria-label="Punto de partida">
    <button type="button" data-start="blank" aria-pressed="false">Desde cero</button>
    <button type="button" data-start="library" aria-pressed="false">Diseños editables</button>
    </div><div class="template-shelf" id="templateShelf" hidden>
    <div class="template-cards" id="templateCards" role="group" aria-label="Diseños editables"></div><p id="noTemplates" class="material-technique" hidden>Consultanos las opciones compatibles con esta tela o elegí otra tela para ver diseños.</p>
    <details class="template-pair" id="templatePair" hidden><summary>Prendas a juego</summary><div><button type="button" class="studio-link" id="pairGarment"></button><button type="button" class="studio-link" id="pairCap">Gorra</button></div></details></div>`;
  $('#grp-producto').innerHTML = '<div class="product-controls"><h4>Producto</h4><div class="collection-control"><label for="templateCollection">Colección</label><select id="templateCollection"></select></div></div><div class="chips" role="group" aria-label="Producto"></div>';
  Object.entries(P).forEach(([key, {label}]) => {
    const icon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${SHAPES[key]}</svg>`;
    $('#grp-producto .chips').appendChild(btn({ class: 'chip', 'data-v': key }, `${icon}<span>${label}</span>`));
  });
  $('#grp-tela').innerHTML = '<h4>Tela</h4><p class="fixed-fabric" id="fixedFabric"></p><div class="fab" role="group" aria-label="Tela"></div><p class="material-technique" id="materialTechnique"></p>';
  Object.entries(MATERIALS).filter(([,material])=>material.status === 'disponible').forEach(([key, {label,detail}]) => {
    $('#grp-tela .fab').appendChild(btn({ 'data-v': key }, `<span>${label}</span><small>${detail}</small>`));
  });

  $('#grp-colores').innerHTML = `<h4 id="colorZoneTitle">Color por zona</h4>
   <div class="zpills" role="group" aria-label="Zona a colorear"></div>
   <p class="band-tip" id="bandTip" hidden>Tocá una franja en la prenda para seleccionarla.</p>
   <div class="palette-head"><span id="colorName"></span><button type="button" class="studio-link" id="editColor" aria-controls="slotZone" aria-expanded="false">Color personalizado</button></div>
   <div class="studio-palette" id="palette" role="group" aria-label="Colores rápidos"></div><div id="slotZone"></div>`;
  $('#grp-colores').insertAdjacentHTML('beforeend','<p class="material-technique" id="colourAvailability" hidden>Tonos orientativos. Consultá colores y disponibilidad para tu pedido.</p>');
  [...PCOL,...ZONES].forEach(key => $('#grp-colores .zpills').appendChild(btn({ class: 'zp', 'data-z': key }, '<i></i><span></span>')));
  PALETTE.forEach(([hex, name]) => $('#palette').appendChild(btn({'data-hex': hex, 'aria-label': name, title: name}, `<i style="background:${hex}"></i>`)));
  $('#grp-estampa').innerHTML = `<h4>Estampado</h4><div class="prints" role="group" aria-label="Estampado"></div>
   <div id="pcols"><span class="pcl">Colores del estampado</span><div class="pchips">${PCOL.map((key, i) => `<button type="button" class="pc" data-i="${i}" aria-controls="slotPrint" aria-expanded="false"><i></i><span>Color ${i + 1}</span></button>`).join('')}</div></div>
   <div id="slotPrint"></div><div id="motifOptions" class="motif-options" hidden>
    <span class="pcl" id="motifScaleLabel">Tamaño del motivo</span>
    <div class="design-start" role="group" aria-labelledby="motifScaleLabel">${Object.entries(MOTIF_SIZES).map(([id,label]) => `<button type="button" data-motif-size="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
   </div><label class="toggle"><input type="checkbox" id="printAll"> <span id="printAllText"></span></label>`;
  Object.entries(PATTERNS).forEach(([key,[label,style]]) => {
    const swatch = style === 'p-mot' ? '<canvas width="140" height="60" aria-hidden="true"></canvas>' : `<i class="${style}"></i>`;
    $('#grp-estampa .prints').appendChild(btn({ 'data-v': key }, `${swatch}<span>${label}</span>`));
  });

  $('#grp-texto').innerHTML = `<h4>Texto <button class="studio-link" id="clearText" type="button">Borrar textos</button></h4><p class="material-technique" id="detailNote" hidden>Consultanos qué personalización es compatible con esta tela.</p><div class="fields">
   <div class="field"><label for="fNombre">Nombre o apodo</label><input id="fNombre" maxlength="14" autocomplete="off" data-k="nombre" placeholder="Ej. Meli"></div>
   <div class="field"><label for="fNum">Número</label><input id="fNum" maxlength="3" inputmode="numeric" data-k="numero" placeholder="26"></div>
   <div class="field full"><label id="labelPrintText" for="fEsp">Texto de espalda</label><input id="fEsp" maxlength="18" data-k="espalda" placeholder="Ej. Promo 26"></div>
   <div class="field full"><label for="fEsc">Escuela, curso o club</label><input id="fEsc" maxlength="32" data-k="escuela"></div>
   <div class="field full"><label for="fFrase">Frase</label><input id="fFrase" maxlength="48" data-k="frase"></div>
   <div class="field"><label for="sleeveLeft">Iniciales · manga izquierda</label><input id="sleeveLeft" maxlength="9" data-k="mangaIzq" placeholder="Ej. A. M."></div>
   <div class="field"><label for="sleeveRight">Iniciales · manga derecha</label><input id="sleeveRight" maxlength="9" data-k="mangaDer" placeholder="Ej. 6° A"></div>
   </div>`;
  $('#grp-texto').insertAdjacentHTML('beforeend',`<details id="printPlacements" class="print-placements"><summary>Ubicaciones, tipografía y motivos</summary><div class="fields">
    <div class="field"><label for="tipografia">Tipografía</label><select id="tipografia" data-design-field="tipografia"></select></div>
    <div class="field"><label for="arte">Motivo gráfico</label><select id="arte" data-design-field="arte"></select></div>
    ${Object.entries(PERSONALIZATION).map(([field,[label]])=>`<div class="field"><label for="${field}">${label}</label><select id="${field}" data-design-field="${field}"></select></div>`).join('')}</div></details>`);
  $('#grp-logo').innerHTML = `<h4>Logo o gráfica <em>Opcional</em></h4>
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
  $('#prevStep').hidden = index === 0;
  $('#nextStep').textContent = ['Editar colores','Agregar detalles','Ver pedido'][index] || '';
  $('#nextStep').hidden = index === STEPS.length - 1;
  $('#waBtn').hidden = index !== STEPS.length - 1;
  groups.scrollTop = 0;
  if (focus) $('#tab-' + step.id).focus({preventScroll: true});
}
function sizeList() { return P[state.producto].sizes; }
function setSelect(select, entries, value) {
  const key = JSON.stringify(entries);
  if (select.dataset.options !== key) {
    select.replaceChildren(...entries.map(([id,label])=>new Option(label,id)));
    select.dataset.options = key;
  }
  select.value = entries.some(([id])=>id === value) ? value : entries[0]?.[0] || '';
}
function syncTemplateShelf(settings) {
  const shown = startMode === 'library';
  $('#templateShelf').hidden = !shown;
  $$('[data-start]',groups).forEach(button=>button.setAttribute('aria-pressed',button.dataset.start === (startMode || 'blank')));
  const collection = $('#templateCollection');
  const entries = settings.product.segments.map(segment=>[segment,segments[segment]]);
  setSelect(collection,entries,settings.segment);
  collection.closest('.collection-control').hidden = entries.length < 2;
  if (!shown) return;
  const templates = availableTemplates(state);
  const cards = $('#templateCards');
  const filter = `${state.producto}/${settings.segment}/${settings.technique}`;
  if (cards.dataset.filter !== filter) {
    cards.replaceChildren(...templates.map(template=>{
      const variant = state.producto === template.photoModel ? '' : '-' + state.producto;
      return btn({ 'data-template':template.id },`<img src="img/plantillas/${template.id}${variant}.webp" alt="" width="300" height="294" loading="lazy" decoding="async"><span>${template.label}</span>`);
    }));
    cards.dataset.filter = filter;
    cards.scrollLeft=0;
  }
  $$('#templateCards button').forEach(button=>button.setAttribute('aria-pressed',button.dataset.template===state.plantilla));
  $('#noTemplates').hidden = templates.length > 0;
  $('#noTemplates').textContent = settings.technique===CONSULT ? 'Consultanos qué diseños son compatibles con esta tela.' : 'Para este producto podés diseñar desde cero.';
  const selected = templates.find(template=>template.id===state.plantilla);
  const pair = selected?.products.includes('campera') && selected?.products.includes('remera') && settings.segment!=='empresas';
  const next = state.producto==='campera'?'remera':'campera';
  $('#templatePair').hidden = !pair;
  $('#pairGarment').textContent = P[next].label;
  $('#pairGarment').dataset.pair = next;
  $('#pairCap').hidden = !selected || !['tricolor','varsity','argentina'].includes(selected.id);
}
function syncPrintDetails(settings) {
  const { fields, regions } = settings;
  const atlasPlacements = regions.some(region=>region.startsWith('pecho'));
  const hasType = fields.includes('espalda') || fields.includes('nombre') || fields.includes('numero');
  $('#printPlacements').hidden = !hasType || (!atlasPlacements && state.producto !== 'gorra');
  $('#arte').closest('.field').hidden = !atlasPlacements;
  setSelect($('#tipografia'),Object.entries(TYPEFACES),state.tipografia);
  setSelect($('#arte'),Object.entries(ARTWORK),state.arte);
  for (const [field,[,base]] of Object.entries(PERSONALIZATION)) {
    const select = $('#'+field);
    const target = field.replace('Lugar','');
    const choices = placementChoices(settings,field);
    select.closest('.field').hidden = !choices.length || (field==='arteLugar' ? !state.arte || state.arte==='ninguno' : !fields.includes(target));
    if (!choices.length) continue;
    const label = PLACEMENTS[choices.includes(base) ? base : choices[0]];
    setSelect(select,[['',`Habitual · ${label}`],...choices.map(choice=>[choice,PLACEMENTS[choice]])],state[field]);
  }
}
function editableColors(settings, preset = compatiblePrint(state).preset) {
  if (preset !== 'tricolor') return settings.zones;
  const physical = {...settings.zones};
  delete physical[state.producto === 'short' ? 'short' : 'cuerpo'];
  if (state.printAll && !settings.product.fixed) {
    delete physical.mangas;
    if (physical.capucha) physical.capucha = 'Forro de capucha';
  }
  return Object.assign(Object.fromEntries(TRICOLOR_BANDS.map(([key,label]) => [key,label])), physical);
}
function sync() {
  const settings = optionsFor(state);
  const { product:pr, segment, materialId, material, technique, zones, patterns, fields, materials } = settings;
  state.segmento = segment;
  if (materialId) state.tela = materialId;
  const display = compatiblePrint(state);
  if (technique === LOCAL_DTF) state.colors.cuerpo = display.colors.cuerpo;
  if (!sizeList().includes(state.talle)) state.talle = sizeList()[Math.min(8, sizeList().length - 1)] || sizeList()[0];
  const accessory = state.producto === 'bandera' || state.producto === 'gorra';
  $$('#grp-producto .chip').forEach(button => button.setAttribute('aria-pressed', button.dataset.v === state.producto));
  $$('#grp-tela .fab button').forEach(button => {
    button.hidden = !materials.includes(button.dataset.v);
    button.setAttribute('aria-pressed', button.dataset.v === state.tela);
  });
  $('#grp-tela .fab').classList.toggle('single', materials.length === 1);
  $('#fixedFabric').textContent = pr.fixed || (materials.length === 1 ? material.label : '');
  $('#fixedFabric').hidden = !$('#fixedFabric').textContent;
  $('#grp-tela .fab').hidden = materials.length < 2;
  const method = TECHNIQUES[technique];
  $('#materialTechnique').textContent = `${method.label} · ${method.description}`;
  syncTemplateShelf(settings);

  const choices = editableColors(settings, display.preset);
  if (!choices[zone]) {
    if (active?.kind === 'zone') closeWheel();
    zone = Object.keys(choices)[0];
  }
  $('#colorZoneTitle').textContent = display.preset === 'tricolor' ? 'Franjas y zonas' : 'Color por zona';
  $('#bandTip').hidden = display.preset !== 'tricolor';
  const customZone = active?.kind === 'zone';
  $$('#grp-colores .zp').forEach(button => {
    const key = button.dataset.z;
    const label = choices[key];
    button.hidden = !label;
    button.querySelector('span').textContent = label || '';
    button.querySelector('i').style.background = state.colors[key];
    button.setAttribute('aria-pressed', key === zone);
  });
  const color = state.colors[zone];
  const colorName = cname(color) === color ? color.toUpperCase() : cname(color);
  $('#colorName').textContent = PCOL.includes(zone) ? `${choices[zone]} · ${colorName}` : colorName;
  $$('#palette button').forEach(button => {
    button.hidden = Boolean(material?.previewColors && !material.previewColors.includes(button.dataset.hex));
    button.setAttribute('aria-pressed', button.dataset.hex === color);
  });
  $('#editColor').hidden = Boolean(material?.previewColors);
  $('#colourAvailability').hidden = technique !== LOCAL_DTF && state.producto !== 'gorra';
  $('#editColor').setAttribute('aria-expanded', customZone);

  const plain = display.preset === 'liso';
  $('#grp-estampa').hidden = !patterns;
  $('#pcols').hidden = plain || display.preset === 'tricolor';
  if ($('#pcols').hidden && active?.kind === 'print') closeWheel();
  $$('#pcols .pc').forEach((button, i) => {
    button.querySelector('i').style.background = state.colors[PCOL[i]];
    button.setAttribute('aria-expanded', active?.kind === 'print' && active.i === i);
  });
  $('#motifOptions').hidden = !hasMotifSizes(display.preset);
  $$('[data-motif-size]').forEach(button => button.setAttribute('aria-pressed',button.dataset.motifSize === state.escalaMotivo));
  $$('#grp-estampa .prints button').forEach(button => {
    const canvas = button.querySelector('canvas');
    const illustrated = Boolean(canvas);
    button.hidden = illustrated && button.dataset.v !== state.preset && !['inicial','primaria'].includes(segment);
    button.setAttribute('aria-pressed', button.dataset.v === state.preset);
    if (illustrated) {
      const {cuerpo,acento,acento2,acento3}=state.colors;
      const key=[cuerpo,acento,acento2,acento3].join('');
      if (button.hidden || canvas.dataset.palette === key) return;
      canvas.dataset.palette=key;
      const g=canvas.getContext('2d');
      g.fillStyle=cuerpo;g.fillRect(0,0,140,60);
      const n=Number.parseInt(acento3.slice(1),16);
      const brightness=((n>>16)*299+((n>>8)&255)*587+(n&255)*114)/1000;
      const inks={ink:brightness>130?'#242228':'#fff5e6',a:acento,b:acento2,c:acento3};
      drawIllustration(g,button.dataset.v,28,35,35,inks);
      drawIllustration(g,button.dataset.v,70,26,46,inks);
      drawIllustration(g,button.dataset.v,112,35,35,inks);
      return;
    }
    const swatch = button.querySelector('i').style;
    swatch.setProperty('--b', state.colors.cuerpo);
    swatch.setProperty('--a', state.colors.acento);
    swatch.setProperty('--a2', state.colors.acento2);
    swatch.setProperty('--a3', state.colors.acento3);
  });
  $('#printAll').checked = state.printAll;
  $('#printAll').closest('.toggle').hidden = plain || accessory || !zones.mangas;
  $('#printAllText').textContent = zones.capucha ? 'Aplicar también en mangas y capucha' : 'Aplicar también en mangas';

  $$('#grp-texto input[data-k]').forEach(input => { input.closest('.field').hidden = !fields.includes(input.dataset.k); });
  $('#detailNote').hidden = technique !== CONSULT;
  $('#grp-logo').hidden = !fields.includes('logo');
  $('#clearText').hidden = technique === CONSULT;
  syncPrintDetails(settings);
  $('#labelPrintText').textContent = accessory ? 'Texto principal' : 'Texto de espalda';
  $('#logoHint').textContent = accessory ? 'PNG, JPG, SVG o WebP · frente' : 'PNG, JPG, SVG o WebP · ubicación editable';
  $$('#groups input[data-k]').forEach(input => {
    if (document.activeElement !== input) input.value = state[input.dataset.k] ?? '';
  });
  $('#clearText').disabled = !$$('#grp-texto .field:not([hidden]) input').some(input => state[input.dataset.k]);
  const sizes = $('#grp-talle .sizes'), list = sizeList();
  const sizeLabel = state.producto === 'bandera' ? 'Medidas' : 'Talle';
  $('#sizeTitle').textContent = sizeLabel;
  sizes.setAttribute('aria-label', sizeLabel);
  $('#sizeGuide').hidden = accessory || state.producto === 'short';
  if (sizes.dataset.p !== state.producto) {
    sizes.replaceChildren(...list.map(size => btn({ 'data-v': size }, size)));
    sizes.dataset.p = state.producto;
    sizes.classList.toggle('wide', list.length <= 3);
  }
  $$('.sizes button').forEach(button => button.setAttribute('aria-pressed', button.dataset.v === state.talle));

  const fabric = material?.label || pr.fixed;
  $('#crumbT').textContent = pr.crumb;
  const fit = (accessory ? '' : 'Talle ') + state.talle;
  $('#crumbS').textContent = `${fabric} · ${fit}`;
  $('#sumL').textContent = `${pr.label} · ${fabric} · ${patterns ? PRESETS_P[display.preset] : TECHNIQUES[technique].label}`;
  $('#sumR').textContent = [fit, state.cantidad && `${state.cantidad} unidades`].filter(Boolean).join(' · ');
  $('#waBtn').href = waLink();
  const fallback = $('#fb');
  if (fallback) {
    const preview = fallback.querySelector('img');
    preview.src = P[state.producto].image;
    preview.alt = `Ejemplo de diseño de ${pr.label.toLowerCase()}`;
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
  const currentHash = location.hash;
  hashT = setTimeout(() => {
    if (location.hash === currentHash) history.replaceState(history.state, '', designHash());
  }, 400);
}
function waLink() {
  const settings = optionsFor(state);
  const {product:pr,segment, zones:z, material, technique, fields, patterns} = settings;
  const design = compatiblePrint(state);
  const hx = h => { const n = cname(h); return h.toUpperCase() + (n !== h ? ` (${n})` : ''); };
  const cols = Object.entries(editableColors(settings,design.preset)).map(([k,l]) => `${PCOL.includes(k) ? 'Franja ' + l.toLowerCase() : l}: ${hx(design.colors[k])}`);
  const template = availableTemplates(state).find(value=>value.id===state.plantilla);
  const place = key => placementChoices(settings,key).includes(design[key]) ? ` · ${PLACEMENTS[design[key]].toLowerCase()}` : '';
  const L = [
    '¡Hola Impronta! Quiero pedir presupuesto por este diseño:', '',
    `• Producto: ${pr.crumb}`, `• Categoría: ${segments[segment]}`, `• Tela: ${material?.label || pr.fixed}`,
    `• Técnica: ${TECHNIQUES[technique].label}`, `• Colores por zona: ${cols.join(' · ')}`,
    template && `• Diseño base: ${template.label}`,
    patterns && `• Estampado: ${PRESETS_P[design.preset]}${design.printAll && design.preset !== 'liso' && z.mangas && !pr.fixed ? (z.capucha ? ' (incluye mangas y capucha)' : ' (incluye mangas)') : ''}`,
    design.preset !== 'liso' && design.preset !== 'tricolor' && `• Colores del estampado: ${PCOL.map((k, i) => `${i + 1}) ${hx(design.colors[k])}`).join(' · ')}`,
    hasMotifSizes(design.preset) && `• Tamaño del motivo: ${MOTIF_SIZES[design.escalaMotivo]}`,
    fields.includes('nombre') && design.nombre && `• Nombre: ${design.nombre}${place('nombreLugar')}`, fields.includes('numero') && design.numero && `• Número: ${design.numero}${place('numeroLugar')}`,
    fields.includes('espalda') && design.espalda && `• ${pr.fixed ? 'Texto principal' : 'Texto espalda'}: ${design.espalda}${place('espaldaLugar')}`,
    fields.includes('escuela') && design.escuela && `• Escuela / curso: ${design.escuela}`, fields.includes('frase') && design.frase && `• Frase: ${design.frase}`,
    fields.includes('mangaIzq') && design.mangaIzq && `• Manga izquierda: ${design.mangaIzq}`,
    fields.includes('mangaDer') && design.mangaDer && `• Manga derecha: ${design.mangaDer}`,
    fields.includes('logo') && design.logoImg && `• Logo: lo adjunto en este chat${place('logoLugar')}`,
    design.arte && design.arte !== 'ninguno' && settings.regions.some(region=>region.startsWith('pecho')) && `• Motivo: ${ARTWORK[design.arte]}${place('arteLugar')}`,
    technique === LOCAL_DTF && '• Confirmame los colores de remera disponibles.', `• Talle: ${state.talle}`, state.cantidad && `• Cantidad aprox.: ${state.cantidad}`, '',
    `Ver el diseño en 3D: ${location.protocol === 'file:' || /^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? CANONICAL_ORIGIN : location.href.split('#')[0]}${designHash()}`,
    '', 'Detalles extra: ',
  ].filter(Boolean);
  return `https://wa.me/${WA}?text=${encodeURIComponent(L.join('\n'))}`;
}
function wire() {
  groups.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button || button.disabled || button.hidden || button.closest('.cw')) return;
    const { v, z, i, hex } = button.dataset;
    if (button.dataset.start) {
      startMode=button.dataset.start;
      if (startMode==='blank') {
        Object.assign(state,cleanPersonalization,{preset:'liso',printAll:false,tipografia:'moderna'});
        clearUploadedLogo(false);
        api?.repaint();
      }
      sync();
      return;
    }
    if (button.dataset.template) { applyTemplate(button.dataset.template); return; }
    if (button.dataset.pair) { setProduct(button.dataset.pair, state.segmento); return; }
    if (button.id==='pairCap') {
      const band=state.colors.acento3;
      const caption=state.nombre || state.espalda || 'PROMO 26';
      Object.assign(state.colors,{cuerpo:'#f2efe9',mangas:band,malla:band,punos:band});
      Object.assign(state,{preset:'liso',printAll:false,plantilla:'gorra-promo',espalda:caption});
      setProduct('gorra','accesorios');
      return;
    }
    if (button.matches('.chip')) setProduct(v);
    if (button.closest('.fab') && optionsFor(state).materials.includes(v)) { closeWheel(); state.tela = v; sync(); api?.repaint(); }
    if (z) selectZone(z);
    if (hex) { state.colors[zone] = hex; wheel.set(hex); sync(); liveRepaint(true); }
    if (button.id === 'editColor') {
      if (active?.kind === 'zone') closeWheel();
      else openWheel({ kind: 'zone', key: zone }, $('#slotZone'), editableColors(optionsFor(state))[zone]);
    }
    if (button.matches('.pc')) {
      if (active?.kind === 'print' && active.i === Number(i)) closeWheel();
      else openWheel({ kind: 'print', key: PCOL[i], i: Number(i) }, $('#slotPrint'), button.textContent.trim());
    }
    if (button.dataset.motifSize) {
      state.escalaMotivo = button.dataset.motifSize;
      sync();
      api?.repaint();
    }
    if (button.closest('.prints') && optionsFor(state).patterns) {
      closeWheel();
      state.preset = v;
      if (v === 'tricolor') zone = PCOL[0];
      sync();
      api?.repaint();
      if (v === 'tricolor') groups.scrollTop = 0;
    }
    if (button.closest('.sizes')) { state.talle = v; sync(); if (state.producto === 'bandera' || state.producto === 'gorra') api?.rebuild(false); }
    if (button.id === 'clearText') {
      $$('#grp-texto .field:not([hidden]) input').forEach(input => { state[input.dataset.k] = ''; });
      sync();
      api?.repaint();
    }
  });
  $('#templateCollection').addEventListener('change',event=>{
    state.segmento=event.target.value;
    sync();
    api?.repaint();
  });
  $('#printPlacements').addEventListener('change',event=>{
    const {designField}=event.target.dataset;
    if(!designField) return;
    state[designField]=event.target.value;
    focusPlacement(event.target.value);
    sync();
    api?.repaint();
  });
  $('#printAll').addEventListener('change', e => { state.printAll = e.target.checked; sync(); api?.repaint(); });
  let textTimer;
  $$('#groups input[data-k]').forEach(input => {
    input.addEventListener('input', () => {
      const key = input.dataset.k;
      if (key === 'numero' || key === 'cantidad') input.value = input.value.replace(/\D/g, '');
      state[key] = input.value;
      sync();
      if (key === 'cantidad') return;
      clearTimeout(textTimer);
      textTimer = setTimeout(() => api?.repaint(), 100);
    });
    input.addEventListener('focus', () => {
      if (input.id === 'fCant') return;
      const key=input.dataset.k;
      if (key==='mangaIzq' || key==='mangaDer') {focusPlacement(key==='mangaIzq'?'manga-izq':'manga-der');return;}
      if (state[key+'Lugar']) {focusPlacement(state[key+'Lugar']);return;}
      const accessory = Boolean(P[state.producto].fixed);
      const front = accessory || state.producto === 'short' || input.id === 'fNombre' || (input.id === 'fEsc' && state.producto !== 'campera');
      if (api) showAngle(front ? 0 : Math.PI);
    });
  });
  const drop = $('#drop'), file = $('#fLogo'), thumb = $('.logo-thumb', drop);
  let logoUrl = '';
  let logoRequest = 0;
  function takeLogo(upload) {
    if (!upload) return;
    if (!optionsFor(state).fields.includes('logo')) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(upload.type)) return toast('Elegí una gráfica en PNG, JPG, SVG o WebP.');
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
      focusPlacement(state.logoLugar || 'pecho-izq');
      api?.repaint();
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
  clearUploadedLogo = (focus = true) => {
    logoRequest++;
    URL.revokeObjectURL(logoUrl);
    logoUrl = '';
    state.logoImg = null;
    thumb.removeAttribute('src');
    thumb.hidden = true;
    $('#removeLogo').hidden = true;
    $('#logoLabel').textContent = 'Subí tu logo';
    sync();
    api?.repaint();
    if (focus) file.focus();
  };
  $('#removeLogo').addEventListener('click', () => clearUploadedLogo());
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
    const showSizes = () => {
      $('#tdet').open = true;
      $('#tdet summary').focus({ preventScroll: true });
      requestAnimationFrame(() => $('#talles').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' }));
    };
    const studioInHistory = history.state?.dz === 1;
    if (studioInHistory) addEventListener('popstate', showSizes, { once: true });
    closeDz(false);
    if (!studioInHistory) showSizes();
  });
  $('#renderBtn').onclick = doRender;
}

/* ---------- color editing ---------- */
let active = null, repaintTimer = 0, lastRepaint = 0;
function liveRepaint(commit) {
  if (!api) return;
  const now = performance.now(), gap = api.lowPower ? 230 : 100;
  clearTimeout(repaintTimer);
  const repaint = () => { lastRepaint = performance.now(); api.repaint(); };
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
  const label = editableColors(optionsFor(state))[key];
  if (!label) return;
  if (from3D && STEPS[currentStep].id !== 'color') selectStep(1);
  if (active?.kind === 'print') closeWheel();
  zone = key;
  if (active?.kind === 'zone') {
    active.key = key;
    wheel.open($('#slotZone'), label, state.colors[key]);
  }
  sync();
  api?.highlight(PCOL.includes(key) ? null : key, true);
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
function setProduct(product, segment) {
  if (!P[product] || (product === state.producto && !segment)) return;
  closeWheel();
  if (state.frase && state.frase === P[state.producto].frase) state.frase = P[product].frase;
  state.producto = product;
  if (segment === 'empresas' && state.segmento !== segment) {
    Object.assign(state, cleanPersonalization, {preset:'liso', printAll:false});
  }
  if (segment && segments[segment]) state.segmento = segment;
  if (segment === 'empresas' && product === 'remera') state.tela = 'algodon';
  sync();
  api?.rebuild(true);
}

/* ---------- lazy 3D ---------- */
// The 3D studio ships as a classic script (js/studio.js) so the site also works when opened from file://.
let api = null, loading = null, failed = false;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); }); }
function webglOK() { try { const c = document.createElement('canvas'); const gl = window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')); if (!gl) return false; const x = gl.getExtension('WEBGL_lose_context'); x && x.loseContext(); return true; } catch (e) { return false; } }
function showFallback(reason) {
  if (failed || $('#viewer').classList.contains('ready')) return; failed = true;
  console.warn('[impronta] 3D no disponible:', reason);
  const v = $('#viewer'); v.classList.add('fallback'); v.setAttribute('aria-busy', 'false');
  const l = $('#loader'); if (l) l.remove();
  const f = document.createElement('div'); f.className = 'fb'; f.id = 'fb';
  f.innerHTML = `<img src="${P[state.producto].image || 'img/poster.webp'}" alt=""><div class="fbx"><b>El estudio 3D no pudo abrirse en este dispositivo</b><p>No pasa nada: elegí tus opciones en el panel y mandanos el pedido por WhatsApp. Te armamos la propuesta en 3D nosotros.</p><button class="btn btn-red" type="button">Ir al pedido</button></div>`;
  v.appendChild(f);
  f.querySelector('button').onclick = () => selectStep(3, true);
  sync();
}
function load3D() {
  if (loading) return loading;
  const t0 = performance.now();
  const timer = setTimeout(() => showFallback('timeout'), 10000);
  loading = (async () => {
    if (!webglOK()) throw new Error('WebGL no disponible');
    if (!window.ImprontaStudio) await loadScript('js/studio.js');
    const fontSpecs = ['14px Anton', '600 14px "Barlow Condensed"', 'italic 14px "DM Serif Display"', '700 14px "Inter Tight"'];
    let fontsLoaded = false;
    const printFontsReady = Promise.all(fontSpecs.map(spec =>
      Promise.resolve().then(() => document.fonts.load(spec)).catch(() => [])
    )).then(() => { fontsLoaded = true; });
    await Promise.race([printFontsReady, new Promise(resolve => setTimeout(resolve, 1500))]);
    const fontsLoadedAtStart = fontsLoaded;
    await new Promise((res, rej) => {
      api = window.ImprontaStudio.createConfigurator($('#gl'), state, { printFontsReady, onReady: () => {
        clearTimeout(timer);
        const v = $('#viewer'); v.classList.remove('fallback'); v.classList.add('ready'); v.setAttribute('aria-busy', 'false');
        const fb = $('#fb'); if (fb) fb.remove(); failed = false;
        const l = $('#loader'); if (l) { l.setAttribute('aria-hidden', 'true'); setTimeout(() => l.remove(), 700); }
        res();
      }, onError: rej, onLost: () => {
        $('#viewer').classList.remove('ready');
        api = null;
        loading = Promise.resolve(null);
        failed = false;
        showFallback('se perdió el contexto WebGL');
      } });
    });
    if (!fontsLoadedAtStart) printFontsReady.then(() => api?.refreshPrintFonts());
    window.__impronta = { api, state, applyPreset, applyTemplate, templates:DESIGN_LIBRARY, sync, loadMs: Math.round(performance.now() - t0) };
    applyFit();
    api.onZonePick(z => selectZone(z, true));
    api.setZones(() => Object.keys(optionsFor(state).zones));
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
  load3D().then(studio => { if (studio === api) studio?.setYaw(angle); });
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
    })), 0, button);
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
function openLb(items, i, trigger = document.activeElement) { lbItems = items; lastFocus = trigger; $('#lbS').innerHTML = ''; items.forEach((it, k) => { const b = btn({ 'aria-label': it.name }, `<img src="${it.src}" alt="">`); b.onclick = () => showLb(k); $('#lbS').appendChild(b); }); $('#lbS').style.display = items.length > 1 ? '' : 'none'; $('#lbZip').style.display = items[0].dl ? '' : 'none'; $('#lbP').style.display = $('#lbN').style.display = items.length > 1 ? '' : 'none'; showLb(i); $('#lb').classList.add('open'); document.body.style.overflow = 'hidden'; $('#lbX').focus({ preventScroll: true }); }
function showLb(i) {
  lbI = (i + lbItems.length) % lbItems.length;
  const item = lbItems[lbI], image = $('#lbImg'), download = $('#lbDl');
  image.src = item.src;
  image.alt = item.name;
  $('#lbT').textContent = item.name.replace('3-4', '3/4');
  download.href = item.src;
  download.download = item.dl || item.src.split('/').pop();
  download.textContent = item.dl ? 'Descargar PNG' : 'Descargar foto';
  $$('#lbS button').forEach((button, index) => {
    button.classList.toggle('on', index === lbI);
    button.setAttribute('aria-pressed', index === lbI);
  });
}
function closeLb() {
  $('#lb').classList.remove('open');
  document.body.style.overflow = '';
  lastFocus?.focus({ preventScroll: true });
}
$('#lbX').onclick = closeLb; $('#lbP').onclick = () => showLb(lbI - 1); $('#lbN').onclick = () => showLb(lbI + 1);
$('#lb').addEventListener('click', e => { if (e.target.classList.contains('stage')) closeLb(); });
document.addEventListener('keydown', e => { if (!$('#lb').classList.contains('open')) { if (e.key === 'Escape') closeMenu(); return; } if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') showLb(lbI - 1); if (e.key === 'ArrowRight') showLb(lbI + 1); });
let tx0 = null; $('#lb .stage').addEventListener('touchstart', e => (tx0 = e.touches[0].clientX), { passive: true }); $('#lb .stage').addEventListener('touchend', e => { if (tx0 == null) return; const d = e.changedTouches[0].clientX - tx0; if (Math.abs(d) > 50) showLb(lbI + (d < 0 ? 1 : -1)); tx0 = null; });

/* ---------- gallery ---------- */
function focusPlacement(place) {
  if (!api || !PLACEMENTS[place]) return;
  const side = place==='manga-izq' ? -1 : 1;
  const yaw = place.startsWith('manga') ? side*Math.PI*.36 : place.startsWith('espalda') ? Math.PI : 0;
  showAngle(yaw);
}
function applyTemplate(id) {
  const template=availableTemplates(state).find(value=>value.id===id);
  if (!template) return false;
  const previous=DESIGN_LIBRARY.find(value=>value.id===state.plantilla)?.design || DEFAULT;
  const edits=Object.fromEntries(['nombre','numero','espalda','escuela','frase','mangaIzq','mangaDer']
    .filter(key=>state[key] && state[key]!==previous[key] && (key!=='frase'||state.frase!==P[state.producto].frase))
    .map(key=>[key,state[key]]));
  const colors={...state.colors,...template.design.colors};
  if (state.producto==='short' || state.producto==='conjunto') colors.short=template.design.colors.cuerpo;
  closeWheel();
  Object.assign(state,cleanPersonalization,template.design,edits,{ colors,plantilla:id });
  sync();
  api?.repaint();
  return true;
}
function applyPreset(key) {
  const preset = clone(PRESETS[key] || {});
  const base = clone(DEFAULT);
  const logo = state.logoImg;
  Object.assign(state, cleanPersonalization, base, preset, { colors: { ...base.colors, ...preset.colors }, logoImg: logo });
  startMode='';
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
function setFilter(filter) {
  const cards = $$('#grid .card');
  let visible = 0;
  $$('#filters button').forEach(button => button.setAttribute('aria-pressed', button.dataset.f === filter));
  for (const card of cards) {
    const show = (filter === 'all' && card.dataset.cat !== '3d') || card.dataset.cat === filter ||
      (filter === 'egresados' && ['inicial','primaria','secundaria'].includes(card.dataset.cat));
    card.classList.toggle('hide', !show);
    if (show) {
      card.classList.add('in');
      visible++;
    }
  }
  $('#gcount').textContent = `Mostrando ${visible} de ${cards.length}`;
}
$$('#grid .card').forEach(card => {
  const image = card.querySelector('img');
  const ratio = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  card.style.setProperty('--photo-ratio', ratio);
  card.classList.toggle('landscape', ratio >= 1.26);
});
$('#filters').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFilter(b.dataset.f); });
$$('[data-gallery-filter]').forEach(link => link.addEventListener('click', () => setFilter(link.dataset.galleryFilter)));

/* ---------- nav, menu, reveal, parallax ---------- */
const nav = $('#nav'), fab = $('#fabWa'), heroEl = $('#hero'); const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fabHide = new Set();
new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? fabHide.add(e.target) : fabHide.delete(e.target)); fab.classList.toggle('show', scrollY > innerHeight * 0.9 && !fabHide.size); }, { rootMargin: '-15% 0px -15% 0px' }).observe($('#contacto'));
document.querySelectorAll('.config .panel, footer').forEach(el => fabHide && new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? fabHide.add(e.target) : fabHide.delete(e.target)); fab.classList.toggle('show', scrollY > innerHeight * 0.9 && !fabHide.size); }).observe(el));
let ticking = false;
addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { const y = scrollY; nav.classList.toggle('scrolled', y > 40); fab.classList.toggle('show', y > innerHeight * 0.9 && !fabHide.size); if (y < innerHeight * 1.5 && !reduceMotion) heroEl.style.setProperty('--hp', Math.min(1, y / (innerHeight * 0.9)).toFixed(4)); ticking = false; }); }, { passive: true });
const menu = $('#menu');
function openMenu() {
  menu.classList.add('open');
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('#menuClose').focus({ preventScroll: true });
}
function closeMenu() {
  if (!menu.classList.contains('open')) return;
  menu.classList.remove('open');
  const trigger = $('#menuBtn');
  trigger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  trigger.focus({ preventScroll: true });
}
$('#menuBtn').onclick = openMenu; $('#menuClose').onclick = closeMenu; $$('#menu nav a').forEach(a => a.addEventListener('click', closeMenu));
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
$$('.rv,.split').forEach(el => rio.observe(el));
window.__appOK = true; // the inline failsafe in <head> reveals everything if we never get here
/* scroll-spy: the active link is the section that contains a probe line 35% down the viewport (position-based, no IO ordering issues) */
const spyIds = ['configurador', 'trabajos', 'talles', 'contacto'];
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
// Wrap keyboard focus within the active dialog.
function keepFocus(dialog, isOpen) {
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !isOpen()) return;
    const controls = $$('button:not(:disabled), a[href], input, [tabindex]', dialog)
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.target !== (event.shiftKey ? first : last)) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  });
}
keepFocus($('#cfg'), () => document.body.classList.contains('dz'));
keepFocus(menu, () => menu.classList.contains('open'));
keepFocus($('#lb'), () => $('#lb').classList.contains('open'));
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
    fill: 1.03,
    touch: document.body.classList.contains('dz'),
  });
}
new ResizeObserver(applyFit).observe($('#viewer'));
