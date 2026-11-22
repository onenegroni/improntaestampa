// Handmade HSV colour wheel: hue/saturation disc + brightness slider + hex field + recent colours.
// One instance, mounted wherever it is needed (zone colours or print colours). Touch friendly.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function hsv2hex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
export function hex2hsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
export const normHex = s => { s = String(s || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join(''); return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null; };

export function createWheel({ seed = [], onInput, onCommit, onClose }) {
  const el = document.createElement('div'); el.className = 'cw'; el.hidden = true;
  el.innerHTML = `<div class="cw-head"><span class="cw-t"></span><button type="button" class="cw-x" aria-label="Cerrar selector de color"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
  <div class="cw-body"><div class="cw-wheel" role="slider" tabindex="0" aria-label="Tono y saturación"><canvas></canvas><span class="cw-knob"></span></div>
  <div class="cw-side"><span class="cw-lab">Brillo</span><div class="cw-val" role="slider" tabindex="0" aria-label="Brillo" aria-valuemin="0" aria-valuemax="100"><span class="cw-vknob"></span></div>
  <div class="cw-hexrow"><span class="cw-prev"></span><input class="cw-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código de color hex"></div>
  <span class="cw-lab">Recientes</span><div class="cw-rec"></div></div></div>`;
  const $ = s => el.querySelector(s);
  const cv = $('canvas'), wh = $('.cw-wheel'), knob = $('.cw-knob'), val = $('.cw-val'), vk = $('.cw-vknob'), hexI = $('.cw-hex'), prev = $('.cw-prev'), rec = $('.cw-rec');
  let hsv = { h: 0, s: 0, v: 1 }, drawnV = -1, size = 0, raf = 0;
  let recent = []; try { recent = JSON.parse(localStorage.getItem('imp-recent') || '[]').filter(normHex); } catch (e) { }
  seed.forEach(c => { if (recent.length < 8 && !recent.includes(c)) recent.push(c); });
  recent = recent.slice(0, 8);
  function drawWheel() {
    const css = wh.clientWidth || 180, dpr = Math.min(2, window.devicePixelRatio || 1), S = Math.round(css * dpr);
    if (S !== size) { cv.width = cv.height = S; size = S; drawnV = -1; }
    if (Math.abs(drawnV - hsv.v) < 0.004) return; drawnV = hsv.v;
    const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data, R = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - R, dy = y + 0.5 - R, r = Math.hypot(dx, dy) / R; const i = (y * S + x) * 4;
      if (r > 1) { d[i + 3] = 0; continue; }
      const h6 = ((Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1) * 6, v = hsv.v * 255, vs = v * r;
      const ch = n => { const k = (n + h6) % 6; return v - vs * Math.max(0, Math.min(k, 4 - k, 1)); };
      d[i] = ch(5); d[i + 1] = ch(3); d[i + 2] = ch(1); d[i + 3] = r > 0.985 ? Math.round((1 - r) / 0.015 * 255) : 255;
    }
    g.putImageData(img, 0, 0);
  }
  function paintUI() {
    const hex = hsv2hex(hsv.h, hsv.s, hsv.v), a = hsv.h * Math.PI / 180;
    knob.style.left = (50 + Math.cos(a) * hsv.s * 50) + '%'; knob.style.top = (50 + Math.sin(a) * hsv.s * 50) + '%'; knob.style.background = hex;
    val.style.setProperty('--full', hsv2hex(hsv.h, hsv.s, 1)); vk.style.left = (hsv.v * 100) + '%'; vk.style.background = hex; val.setAttribute('aria-valuenow', Math.round(hsv.v * 100));
    prev.style.background = hex; if (document.activeElement !== hexI) hexI.value = hex.toUpperCase();
    rec.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === hex));
    drawWheel();
  }
  function renderRecent() { rec.innerHTML = ''; recent.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.dataset.c = c; b.style.background = c; b.setAttribute('aria-label', 'Usar ' + c.toUpperCase()); rec.appendChild(b); }); }
  function emit(commit) { const hex = hsv2hex(hsv.h, hsv.s, hsv.v); cancelAnimationFrame(raf); raf = requestAnimationFrame(paintUI); onInput && onInput(hex, commit); if (commit) { pushRecent(hex); onCommit && onCommit(hex); } }
  function pushRecent(hex) { recent = [hex, ...recent.filter(c => c !== hex)].slice(0, 8); try { localStorage.setItem('imp-recent', JSON.stringify(recent)); } catch (e) { } renderRecent(); paintUI(); }
  function drag(target, fn) {
    target.addEventListener('pointerdown', e => { e.preventDefault(); target.setPointerCapture(e.pointerId); target.focus({ preventScroll: true }); fn(e); emit(false);
      const mv = ev => { fn(ev); emit(false); }, up = () => { target.removeEventListener('pointermove', mv); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); emit(true); };
      target.addEventListener('pointermove', mv); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up); });
  }
  drag(wh, e => { const r = wh.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; hsv.s = clamp(Math.hypot(dx, dy) / (r.width / 2), 0, 1); if (hsv.v < 0.08) hsv.v = 0.5; });
  drag(val, e => { const r = val.getBoundingClientRect(); hsv.v = clamp((e.clientX - r.left) / r.width, 0, 1); });
  wh.addEventListener('keydown', e => { const k = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[e.key]; if (!k) return; e.preventDefault(); hsv.h = (hsv.h + k[0] + 360) % 360; hsv.s = clamp(hsv.s + k[1], 0, 1); emit(true); });
  val.addEventListener('keydown', e => { const k = { ArrowLeft: -0.04, ArrowDown: -0.04, ArrowRight: 0.04, ArrowUp: 0.04 }[e.key]; if (k == null) return; e.preventDefault(); hsv.v = clamp(hsv.v + k, 0, 1); emit(true); });
  hexI.addEventListener('input', () => { const h = normHex(hexI.value); if (h && hexI.value.replace('#', '').length === 6) { hsv = hex2hsv(h); emit(false); } });
  hexI.addEventListener('change', () => { const h = normHex(hexI.value); if (h) { hsv = hex2hsv(h); emit(true); } else paintUI(); });
  hexI.addEventListener('keydown', e => { if (e.key === 'Enter') hexI.blur(); });
  rec.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; hsv = hex2hsv(b.dataset.c); emit(true); });
  $('.cw-x').addEventListener('click', () => onClose && onClose());
  renderRecent();
  return {
    el,
    open(host, title, hex) { if (el.parentNode !== host) host.appendChild(el); $('.cw-t').textContent = title; const n = hex2hsv(hex); if (n) hsv = n; el.hidden = false; requestAnimationFrame(() => { el.classList.add('on'); paintUI(); }); },
    set(hex) { const n = hex2hsv(hex); if (n) { hsv = n; paintUI(); } },
    close() { el.classList.remove('on'); el.hidden = true; },
    get isOpen() { return !el.hidden; },
  };
}
