// Impronta Estampa — page logic (UI, lazy 3D, gallery, WhatsApp, renders)
import { createWheel } from './colorwheel.js';
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
const clone = o => JSON.parse(JSON.stringify(o));
let state = clone(DEFAULT);
try { const m = location.hash.match(/d=([\w-]+)/); if (m) { const j = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); state = { ...state, ...j, colors: { ...state.colors, ...(j.colors || {}) } }; } } catch (e) { }
state.logoImg = null;

/* ---------- toast ---------- */
let tt; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- panel UI ---------- */
const groups = $('#groups'), tabs = $('#mtabs');
const GROUPS = [['producto', 'Producto'], ['tela', 'Tela'], ['colores', 'Colores'], ['estampa', 'Estampa'], ['texto', 'Texto'], ['logo', 'Logo'], ['talle', 'Talle']];
// phones (portrait ≤768px, or landscape phones): compact page + full-screen app-like designer
const MQ = matchMedia('(max-width: 768px), (max-height: 500px) and (max-width: 1000px)');
function btn(attrs, html) { const b = document.createElement('button'); b.type = 'button'; Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v)); b.innerHTML = html; return b; }
function buildPanel() {
  groups.innerHTML = '';
  GROUPS.forEach(([id, label], i) => {
    const t = btn({ role: 'tab', 'aria-selected': i === 2 ? 'true' : 'false', 'data-g': id, id: 'tab-' + id, 'aria-controls': 'grp-' + id }, label); tabs.appendChild(t);
    const g = document.createElement('div'); g.className = 'grp' + (i === 2 ? ' act' : ''); g.id = 'grp-' + id; g.setAttribute('role', 'tabpanel'); g.setAttribute('aria-labelledby', 'tab-' + id); groups.appendChild(g);
  });
  // producto
  $('#grp-producto').innerHTML = `<h4>Producto <em id="emProd"></em></h4><div class="chips" role="radiogroup" aria-label="Producto"></div>`;
  Object.entries(P).forEach(([k, v]) => $('#grp-producto .chips').appendChild(btn({ class: 'chip', role: 'radio', 'data-v': k }, v.label)));
  $('#grp-tela').innerHTML = `<h4>Tela <em id="emTela"></em></h4><div class="fab" role="radiogroup" aria-label="Tela"></div>`;
  Object.entries(TELAS).forEach(([k, [a, b]]) => $('#grp-tela .fab').appendChild(btn({ role: 'radio', 'data-v': k }, `${a}<small>${b}</small>`)));
  $('#grp-colores').innerHTML = `<h4>Colores <em id="emZones"></em></h4><p class="zhint"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 013 0V10m0-1.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v4.5A5.5 5.5 0 0112.5 20h-.7a5 5 0 01-3.9-1.9L5 14.5a1.5 1.5 0 012.2-2L9 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Tocá una parte de la prenda en 3D o elegí una zona</p>
   <div class="zpills" role="radiogroup" aria-label="Zona a colorear"></div><div class="cw-slot" id="slotZone"></div>`;
  ['cuerpo', 'mangas', 'capucha', 'punos'].forEach(z => $('#grp-colores .zpills').appendChild(btn({ class: 'zp', role: 'radio', 'aria-checked': 'false', 'data-z': z }, `<i></i><span>${ZL[z]}</span>`)));
  $('#grp-estampa').innerHTML = `<h4>Estampado <em id="emPrint"></em></h4><div class="prints" role="radiogroup" aria-label="Estampado"></div>
   <div class="pcols" id="pcols"><span class="pcl">Colores del estampado</span><div class="pchips">${PCOL.map((k, i) => `<button type="button" class="pc" data-i="${i}" aria-pressed="false"><i></i><span>Color ${i + 1}</span></button>`).join('')}</div></div>
   <div class="cw-slot" id="slotPrint"></div><label class="toggle"><input type="checkbox" id="printAll"> Estampar también mangas y capucha</label>`;
  const cls = { galactico: 'p-gal', splash: 'p-spl', degrade: 'p-deg', rayas: 'p-ray', tiedye: 'p-tie', manitos: 'p-man', camuflaje: 'p-cam', geometrico: 'p-geo', liso: 'p-lis' };
  Object.entries(PRESETS_P).forEach(([k, n]) => $('#grp-estampa .prints').appendChild(btn({ role: 'radio', 'data-v': k }, `<i class="${cls[k]}"></i>${n}`)));
  $('#grp-texto').innerHTML = `<h4>Personalización</h4><div class="fields">
   <div class="field"><label for="fNombre">Nombre / apodo</label><input id="fNombre" maxlength="14" autocomplete="off" data-k="nombre"></div>
   <div class="field"><label for="fNum">Número</label><input id="fNum" maxlength="3" inputmode="numeric" data-k="numero"></div>
   <div class="field full"><label for="fEsp">Texto espalda</label><input id="fEsp" maxlength="18" data-k="espalda"></div>
   <div class="field full"><label for="fEsc">Escuela / curso / club</label><input id="fEsc" maxlength="32" data-k="escuela"></div>
   <div class="field full"><label for="fFrase">Frase</label><input id="fFrase" maxlength="48" data-k="frase"></div>
   </div>`;
  $('#grp-logo').innerHTML = `<h4>Logo <em>Opcional</em></h4><label class="drop" id="drop"><span class="dt"><b>Subí el logo de la escuela</b><br>PNG, JPG o SVG · se ubica en el pecho</span><span class="ac">+ Archivo</span><input type="file" id="fLogo" accept="image/*" class="sr"></label>`;
  $('#grp-talle').innerHTML = `<h4>Talle <a class="lnk" href="#talles" style="font-size:11px;font-family:var(--mono);letter-spacing:.1em;color:#d9d5ce">Ver tabla</a></h4><div class="sizes" role="radiogroup" aria-label="Talle"></div>
   <div class="fields" style="margin-top:12px"><div class="field full"><label for="fCant">Cantidad aproximada</label><input id="fCant" inputmode="numeric" maxlength="4" data-k="cantidad"></div></div>
   <p class="idea m-idea">¿Tenés una idea más específica? Elegí el modelo y los colores más parecidos y contanos los detalles al pedir presupuesto.</p>`;
  const si = document.getElementById('stepInfo'); if (si) si.textContent = GROUPS.length + ' pasos';
  wire();
}
function sizeList() { return P[state.producto].sizes || SIZES; }
function sync() {
  const pr = P[state.producto];
  if (!pr.telas.includes(state.tela) && pr.telas.length) state.tela = pr.telas[0];
  if (!sizeList().includes(state.talle)) state.talle = sizeList()[Math.min(8, sizeList().length - 1)] || sizeList()[0];
  $$('#grp-producto .chip').forEach(b => b.setAttribute('aria-checked', b.dataset.v === state.producto));
  $('#emProd').textContent = pr.label;
  $$('#grp-tela .fab button').forEach(b => { b.disabled = !pr.telas.includes(b.dataset.v); b.setAttribute('aria-checked', pr.telas.length && b.dataset.v === state.tela); });
  $('#emTela').textContent = pr.telas.length ? TELAS[state.tela][0] : pr.fixed;
  let nz = 0;
  $$('#grp-colores .zp').forEach(b => { const z = b.dataset.z, lab = pr.zones[z]; b.hidden = !lab; if (lab) nz++; b.querySelector('span').textContent = lab || ZL[z]; b.querySelector('i').style.background = state.colors[z]; b.setAttribute('aria-checked', !!(active && active.kind === 'zone' && active.z === z)); });
  $('#emZones').textContent = nz + (nz === 1 ? ' zona' : ' zonas');
  if (active && active.kind === 'zone' && !pr.zones[active.z]) closeWheel();
  const lisoP = state.preset === 'liso'; $('#pcols').hidden = lisoP; if (lisoP && active && active.kind === 'print') closeWheel();
  $$('#pcols .pc').forEach(b => { const i = +b.dataset.i; b.querySelector('i').style.background = state.colors[PCOL[i]]; b.setAttribute('aria-pressed', !!(active && active.kind === 'print' && active.i === i)); });
  $$('#grp-estampa .prints button').forEach(b => { b.setAttribute('aria-checked', b.dataset.v === state.preset); b.querySelector('i').style.setProperty('--b', state.colors.cuerpo); b.querySelector('i').style.setProperty('--a', state.colors.acento); b.querySelector('i').style.setProperty('--a2', state.colors.acento2); b.querySelector('i').style.setProperty('--a3', state.colors.acento3); });
  $('#emPrint').textContent = PRESETS_P[state.preset]; $('#printAll').checked = !!state.printAll;
  $('#printAll').closest('.toggle').style.display = (pr.zones.mangas || pr.zones.capucha) ? '' : 'none';
  $$('#groups input[data-k]').forEach(i => { if (document.activeElement !== i) i.value = state[i.dataset.k] ?? ''; });
  const sz = $('#grp-talle .sizes'); const list = sizeList();
  if (sz.dataset.p !== state.producto) { sz.innerHTML = ''; list.forEach(s => sz.appendChild(btn({ role: 'radio', 'data-v': s }, s))); sz.dataset.p = state.producto; sz.classList.toggle('wide', list.length < 6); }
  sz.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === state.talle));
  // summary
  $('#crumbT').textContent = pr.crumb;
  const telaTxt = pr.telas.length ? 'Tela ' + TELAS[state.tela][0].toLowerCase() : pr.fixed;
  $('#crumbS').textContent = `${telaTxt} · ${list.length > 3 ? 'Talle ' : ''}${state.talle}`;
  $('#sumL').textContent = `${pr.label} · ${pr.telas.length ? TELAS[state.tela][0] : pr.fixed.split(' ')[0]} · ${PRESETS_P[state.preset]}`;
  $('#sumR').textContent = (list.length > 3 ? 'Talle ' : '') + state.talle;
  const href = waLink(); $('#waBtn').href = href; $('#waBtn2').href = href;
  const fb = document.getElementById('fb'); if (fb) { fb.querySelector('a').href = href; fb.querySelector('img').src = FALLBACK_IMG[state.producto] || 'img/poster.webp'; }
  saveHash();
}
let hashT, hashReady = false; function saveHash() { if (!hashReady) return; clearTimeout(hashT); hashT = setTimeout(() => { const { logoImg, ...s } = state; const enc = btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); history.replaceState(null, '', '#d=' + enc); }, 400); }
function waLink() {
  const pr = P[state.producto], z = pr.zones;
  const hx = h => { const n = cname(h); return h.toUpperCase() + (n !== h ? ` (${n})` : ''); };
  const cols = Object.entries(z).filter(([, l]) => l).map(([k, l]) => `${l}: ${hx(state.colors[k])}`);
  const L = [
    '¡Hola Impronta! Quiero pedir presupuesto por este diseño:', '',
    `• Producto: ${pr.crumb}`, `• Tela: ${pr.telas.length ? TELAS[state.tela][0] : pr.fixed}`, `• Colores por zona: ${cols.join(' · ')}`,
    `• Estampado: ${PRESETS_P[state.preset]}${state.printAll ? ' (incluye mangas y capucha)' : ''}`,
    state.preset !== 'liso' && `• Colores del estampado: ${PCOL.map((k, i) => `${i + 1}) ${hx(state.colors[k])}`).join(' · ')}`,
    state.nombre && `• Nombre: ${state.nombre}${state.numero ? ' · Número: ' + state.numero : ''}`,
    state.espalda && `• Texto espalda: ${state.espalda}`, state.escuela && `• Escuela / curso: ${state.escuela}`, state.frase && `• Frase: ${state.frase}`,
    state.logoImg && '• Logo: lo adjunto en este chat', `• Talle: ${state.talle}`, state.cantidad && `• Cantidad aprox.: ${state.cantidad}`, '',
    `Ver el diseño en 3D: ${location.href.split('#')[0]}#${location.hash.slice(1) || ''}`,
    'Te adjunto los renders descargados del diseñador.',
    '', 'Detalles extra: ',
  ].filter(Boolean);
  return `https://wa.me/${WA}?text=${encodeURIComponent(L.join('\n'))}`;
}
function wire() {
  groups.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || b.closest('.cw')) return;
    const grp = b.closest('.grp'); if (!grp) return; const g = grp.id.slice(4);
    if (g === 'producto') return setProduct(b.dataset.v);
    if (g === 'tela') { state.tela = b.dataset.v; sync(); api && api.repaint('fade'); return; }
    if (g === 'colores' && b.classList.contains('zp')) { if (active && active.kind === 'zone' && active.z === b.dataset.z) closeWheel(); else selectZone(b.dataset.z); return; }
    if (g === 'estampa' && b.classList.contains('pc')) { const i = +b.dataset.i; if (active && active.kind === 'print' && active.i === i) closeWheel(); else openPrint(i); return; }
    if (g === 'estampa' && b.closest('.prints')) { state.preset = b.dataset.v; sync(); api && api.repaint('wipe'); return; }
    if (g === 'talle' && b.closest('.sizes')) { state.talle = b.dataset.v; sync(); }
  });
  $('#printAll').addEventListener('change', e => { state.printAll = e.target.checked; sync(); api && api.repaint('wipe'); });
  let it; $$('#groups input[data-k]').forEach(i => i.addEventListener('input', () => { state[i.dataset.k] = i.value.toUpperCase() === i.value ? i.value : i.value; if (i.dataset.k === 'numero' || i.dataset.k === 'cantidad') { i.value = i.value.replace(/\D/g, ''); state[i.dataset.k] = i.value; } sync(); clearTimeout(it); it = setTimeout(() => api && api.repaint('fade'), 160); }));
  const drop = $('#drop'), fl = $('#fLogo');
  const take = f => { if (!f || !f.type.startsWith('image/')) return toast('Subí una imagen (PNG, JPG o SVG).'); const url = URL.createObjectURL(f); const im = new Image(); im.onload = () => { state.logoImg = im; drop.querySelector('.dt').innerHTML = `<b>${f.name.slice(0, 26)}</b><br>Logo ubicado en el pecho`; drop.querySelector('.ac').innerHTML = `<img src="${url}" alt="">`; sync(); api && api.repaint('fade'); toast('Logo aplicado al diseño.'); }; im.src = url; };
  fl.addEventListener('change', () => take(fl.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));
  tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; selectTab(b.dataset.g); });
}
/* ---------- colour wheel (zones + print colours) ---------- */
let active = null, rpT = 0, rpLast = 0;
function liveRepaint(commit) {
  if (!api) return; const now = performance.now(), gap = api.lowPower ? 260 : 120; clearTimeout(rpT);
  if (commit || now - rpLast > gap) { rpLast = now; api.repaint('fade'); } else rpT = setTimeout(() => { rpLast = performance.now(); api.repaint('fade'); }, gap - (now - rpLast));
}
const wheel = createWheel({
  seed: ['#141414', '#f2efe9', '#b5141a', '#1e2f5c', '#9fc8e8', '#f2c230', '#5b2a86', '#e8742a'],
  onInput(hex, commit) { if (!active) return; const key = active.kind === 'zone' ? active.z : PCOL[active.i]; if (state.colors[key] === hex && !commit) return; state.colors[key] = hex; sync(); liveRepaint(commit); },
  onClose: () => closeWheel(),
});
function closeWheel() { if (!active) return; active = null; wheel.close(); api && api.highlight && api.highlight(null); sync(); }
function selectZone(z, from3D) {
  const pr = P[state.producto]; if (!pr.zones[z]) return;
  active = { kind: 'zone', z }; wheel.open($('#slotZone'), pr.zones[z], state.colors[z]); sync();
  api && api.highlight && api.highlight(z, true);
  if (from3D) selectTab('colores');
  revealWheel($('#slotZone'));
}
// bring the opened wheel into view inside the panel (and the page, minimally) without jumping
function revealWheel(slot) { setTimeout(() => { const r = slot.getBoundingClientRect(); const sc = slot.closest('#groups'); if (sc && sc.scrollHeight > sc.clientHeight + 4) { const sr = sc.getBoundingClientRect(); if (r.bottom > sr.bottom || r.top < sr.top) sc.scrollTo({ top: sc.scrollTop + (document.body.classList.contains('dz') ? r.top - sr.top - 6 : Math.min(r.bottom - sr.bottom + 12, r.top - sr.top - 60)), behavior: 'smooth' }); } else if (r.bottom > innerHeight || r.top < 0) slot.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, 60); }
function openPrint(i) { active = { kind: 'print', i }; wheel.open($('#slotPrint'), `Color ${i + 1} del estampado`, state.colors[PCOL[i]]); sync(); revealWheel($('#slotPrint')); }
function selectTab(id) {
  $$('#mtabs button').forEach(t => t.setAttribute('aria-selected', t.dataset.g === id));
  $$('#groups .grp').forEach(g => g.classList.toggle('act', g.id === 'grp-' + id));
  moveInk();
}
function moveInk() { const a = $('#mtabs button[aria-selected=true]'), ink = $('#mtabs .ink'); if (!a) return; ink.style.left = a.offsetLeft + 'px'; ink.style.width = a.offsetWidth + 'px'; const t = $('#mtabs'); if (t.scrollWidth <= t.clientWidth + 2) return;
  if (document.body.classList.contains('dz')) { // keep the active tab (and the one before it) fully in view, never a clipped label
    const L = a.offsetLeft, R = L + a.offsetWidth, v0 = t.scrollLeft, v1 = v0 + t.clientWidth; if (L - 12 >= v0 && R + 24 <= v1) return;
    const prev = a.previousElementSibling; let x = prev && prev.tagName === 'BUTTON' ? prev.offsetLeft - 16 : 0; if (R + 24 > x + t.clientWidth) x = R + 24 - t.clientWidth;
    t.scrollTo({ left: Math.max(0, x), behavior: 'smooth' }); return; }
  t.scrollTo({ left: a.offsetLeft - (t.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' }); }
function setProduct(p, extra) {
  const prev = P[state.producto];
  if (state.frase === prev.frase || !state.frase) state.frase = P[p].frase;
  state.producto = p; if (extra) Object.assign(state, extra);
  sync(); api && api.rebuild(true);
  invalidateRenders();
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
  const f = document.createElement('div'); f.className = 'fb'; f.id = 'fb'; f.setAttribute('role', 'status');
  f.innerHTML = `<img src="${FALLBACK_IMG[state.producto] || 'img/poster.webp'}" alt="Ejemplo de diseño de ${P[state.producto].label.toLowerCase()}"><div class="fbx"><b>El estudio 3D no pudo abrirse en este dispositivo</b><p>No pasa nada: elegí tus opciones en el panel y mandanos el pedido por WhatsApp. Te armamos la propuesta en 3D nosotros.</p><a class="btn btn-red" id="fbWa" target="_blank" rel="noopener" href="${waLink()}"><svg class="wa"><use href="#wa"/></svg>Pedir presupuesto</a></div>`;
  v.appendChild(f);
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
    api.onZonePick && api.onZonePick(z => selectZone(z, true));
    api.setZones && api.setZones(() => Object.keys(P[state.producto].zones).filter(z => P[state.producto].zones[z]));
    api.onView(v => {
      const deg = ((Math.round(-api.yaw() * 180 / Math.PI) % 360) + 360) % 360;
      $('#vinfo').innerHTML = `Rotación ${deg}°<br>Zoom ${Math.round(v.zoom * 100)}%`;
      const x = 110 + Math.sin(-api.yaw()) * 80; $('#rotDot').setAttribute('cx', x.toFixed(1));
      $('#autoBtn').setAttribute('aria-pressed', v.auto);
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
const seg = $('#seg');
function movePill(b) { const p = seg.querySelector('.pill'); p.style.left = b.offsetLeft + 'px'; p.style.width = b.offsetWidth + 'px'; }
seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); movePill(b); load3D().then(a => a && a.setYaw(+b.dataset.yaw)); });
$('#zIn').onclick = () => api && api.zoomBy(1.18); $('#zOut').onclick = () => api && api.zoomBy(1 / 1.18);
$('#autoBtn').onclick = () => api && api.toggleAuto(); $('#resetBtn').onclick = () => api && api.resetView();
$('#gl').addEventListener('pointerdown', () => $('#viewer').classList.add('touched'), { once: true });

/* ---------- renders ---------- */
let shots = [];
function invalidateRenders() { if (!shots.length) return; $$('.rth').forEach(t => t.classList.remove('has')); shots = []; $('#dlBtn').disabled = $('#dlZip').disabled = $('#openLb').disabled = true; }
async function doRender() {
  const a = await load3D(); if (!a) { toast('El 3D no está disponible en este dispositivo. Pedí tu presupuesto por WhatsApp y te mandamos los renders.'); return; }
  const B = [$('#renderBtn'), $('#renderBtn2')]; B.forEach(b => { b.classList.add('busy'); b.disabled = true; });
  $$('.rth').forEach(t => { t.classList.remove('has'); t.classList.add('busy'); });
  await new Promise(r => setTimeout(r, 60));
  try {
    const out = await a.renderSet();
    shots = out.map(o => ({ ...o, blob: dataURLtoBlob(o.url) })); shots.forEach(s => (s.obj = URL.createObjectURL(s.blob)));
    $$('.rth').forEach((t, i) => { const im = t.querySelector('img'); im.onload = () => { t.classList.remove('busy'); requestAnimationFrame(() => t.classList.add('has')); }; im.src = shots[i].obj; im.alt = 'Render ' + shots[i].name; });
    $('#dlBtn').disabled = $('#dlZip').disabled = $('#openLb').disabled = false;
    $('#flash').classList.remove('go'); void $('#flash').offsetWidth; $('#flash').classList.add('go');
    toast('Render listo: 4 ángulos en alta resolución.');
    if (document.body.classList.contains('dz')) setTimeout(() => $('#openLb').click(), 350);
  } catch (e) { console.error(e); toast('No se pudo generar el render.'); $$('.rth').forEach(t => t.classList.remove('busy')); }
  B.forEach(b => { b.classList.remove('busy'); b.disabled = false; });
  return shots;
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
  if (!shots.length) await doRender(); if (!shots.length) return;
  const z = await makeZip(shots.map(s => ({ name: `${fileBase()}-${s.name}.png`, blob: s.blob })));
  const a = document.createElement('a'); a.href = URL.createObjectURL(z); a.download = fileBase() + '-renders.zip'; document.body.appendChild(a); a.click(); a.remove();
  toast('Descargando renders. Adjuntalos en WhatsApp.');
}
$('#renderBtn').onclick = doRender;
$('#renderBtn2').onclick = async () => { await doRender(); downloadZip(); };
$('#dlBtn').onclick = downloadZip; $('#dlZip').onclick = downloadZip; $('#lbZip').onclick = downloadZip;
$('#openLb').onclick = () => openLb(shots.map(s => ({ src: s.obj, name: s.name, dl: `${fileBase()}-${s.name}.png` })), 0);
$$('.rth').forEach(t => t.addEventListener('click', () => { if (shots.length) openLb(shots.map(s => ({ src: s.obj, name: s.name, dl: `${fileBase()}-${s.name}.png` })), +t.dataset.i); else doRender(); }));

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
function applyPreset(k) { const p = clone(PRESETS[k] || {}); const base = clone(DEFAULT); const next = { ...base, ...p, colors: { ...base.colors, ...(p.colors || {}) } }; const logo = state.logoImg; const prod = next.producto; Object.assign(state, next); state.logoImg = logo; state.producto = '__'; state.producto = prod; sync(); if (api) api.rebuild(true); invalidateRenders(); }
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('button.ph2'); if (!b) return;
  if (b.dataset.preset) { applyPreset(b.dataset.preset); load3D(); if (MQ.matches) { openDz(); return; } (matchMedia('(max-width: 900px)').matches ? $('#viewer') : document.getElementById('configurador')).scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('Diseño cargado en el diseñador 3D. Personalizalo a tu gusto.'); }
  else if (b.dataset.lb) { const all = $$('#grid .card:not(.hide) button[data-lb]'); openLb(all.map(x => ({ src: x.dataset.lb, name: x.closest('.card').querySelector('.cap b').textContent })), all.indexOf(b)); }
});
function setFilter(f) { $$('#filters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); let n = 0; $$('#grid .card').forEach(c => { const show = f === 'all' || c.dataset.cat === f; c.classList.toggle('hide', !show); if (show) { n++; c.classList.add('in'); } }); $('#gcount').textContent = `Mostrando ${n} de 211`; }
$('#filters').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setFilter(b.dataset.f); });
$$('[data-product]').forEach(a => a.addEventListener('click', () => { load3D(); setProduct(a.dataset.product); }));

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
requestAnimationFrame(() => { movePill(seg.querySelector('.on')); moveInk(); });
addEventListener('resize', () => { movePill(seg.querySelector('.on')); moveInk(); });
document.fonts && document.fonts.ready.then(() => { movePill(seg.querySelector('.on')); moveInk(); api && api.repaint(); });

/* ---------- mobile: full-screen app-like designer ---------- */
function openDz() {
  if (!MQ.matches) { document.getElementById('configurador').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (document.body.classList.contains('dz')) return;
  document.body.classList.add('dz'); document.documentElement.classList.add('dz-lock');
  try { history.pushState({ dz: 1 }, '', location.href); } catch (e) { }
  load3D(); requestAnimationFrame(() => { applyFit(); moveInk(); try { movePill(seg.querySelector('.on')); } catch (e) { } $('#closeDz').focus({ preventScroll: true }); });
}
function closeDz(fromPop) {
  if (!document.body.classList.contains('dz')) return;
  document.body.classList.remove('dz'); document.documentElement.classList.remove('dz-lock'); applyFit();
  if (!fromPop && history.state && history.state.dz) { try { history.back(); } catch (e) { } }
  $('#openDz').focus({ preventScroll: true });
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
// the overlay frame must never scroll as a whole (focus / scrollIntoView can scroll overflow:hidden boxes): only the step panel scrolls
['#cfg', '.config .panel', '#viewer'].forEach(s => { const el = $(s); el && el.addEventListener('scroll', () => { if (document.body.classList.contains('dz') && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; } }); });

// phone designer: frame the garment itself (stand cropped) in the space left free by the view pills
function applyFit() {
  if (!api || !api.setFit) return;
  if (!document.body.classList.contains('dz')) { api.setFit(null); return; }
  const v = $('#viewer').getBoundingClientRect(), sg = $('#seg'); const sr = sg && sg.offsetParent ? sg.getBoundingClientRect() : null;
  const bottom = sr && sr.top > v.top + v.height / 2 ? v.bottom - sr.top + 8 : 14, top = sr && sr.top <= v.top + v.height / 2 ? sr.bottom - v.top + 8 : 14;
  api.setFit({ top, bottom, fill: 0.85 });
}
{ let ft = 0; addEventListener('resize', () => { clearTimeout(ft); ft = setTimeout(applyFit, 120); }); }
