// Canvas textures: print presets, text, logo, knit normal map.
import * as THREE from './vendor/three.module.min.js';
import { drawIllustration, illustrations } from './illustrations.js';
import { TRICOLOR_BANDS } from './design-library.js';

export function lum(hex) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
export const ink = hex => (lum(hex) > 0.205 ? '#141414' : '#fafafa');
function rng(seed) { let s = seed % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function mix(a, b, t) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, t).getHexString(); }

/** draw a print preset over a canvas region (x,y,w,h). k = px per metre scale factor (roughly) */
export const pcols = st => [st.colors.acento, st.colors.acento2 || '#f4f1ec', st.colors.acento3 || st.colors.acento];
// smooth organic blob (camouflage)
function blobPath(g, R, x, y, r, n = 9) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (0.55 + R() * 0.75); pts.push([x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr * 0.8]); }
  g.beginPath(); for (let i = 0; i <= n; i++) { const p0 = pts[i % n], p1 = pts[(i + 1) % n]; const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; i ? g.quadraticCurveTo(p0[0], p0[1], mx, my) : g.moveTo(mx, my); } g.closePath(); }

function rgbOf(hex) {
  const c = new THREE.Color(hex).convertLinearToSRGB();
  return [c.r * 255, c.g * 255, c.b * 255];
}
const dyeFields = new WeakMap();
// The motif is evaluated at native resolution in stable logical coordinates.
// Pack its palette band and two blend weights for fast text and colour edits.
function buildDyeField(width, height, w, h, centres, ph) {
  const pixels = new Uint16Array(width * height);
  const lw = w / 4, lh = h / 4, sc = Math.min(lw, lh);
  const threshold = lw / 2;
  const distances = centres.map(([ux, uy]) => ({
    y: uy * lh,
    x: Float32Array.from({ length: width }, (_, i) => {
      const dx = (i + .5) * lw / width - ux * lw;
      return dx > threshold ? dx - lw : dx < -threshold ? dx + lw : dx;
    }),
  }));
  const xs = Float32Array.from({ length: width }, (_, i) => (i + .5) * lw / width);
  const wave = xs.map(x => Math.sin(x * .045 + ph));
  const broadSin = xs.map(x => Math.sin(x * .021)), broadCos = xs.map(x => Math.cos(x * .021));
  const fineSin = xs.map(x => Math.sin(x * .63)), fineCos = xs.map(x => Math.cos(x * .63));
  let pixel = 0;
  for (let yi = 0; yi < height; yi++) {
    const y = (yi + .5) * lh / height;
    const slowY = Math.cos(y * .052 - ph) * .60;
    const fleckY = Math.cos(y * .61 - ph) * .24;
    const broadY = ph * 2 - y * .021;
    const bs = Math.sin(broadY) * .40, bc = Math.cos(broadY) * .40;
    const fs = Math.sin(y * .47) * fleckY, fc = Math.cos(y * .47) * fleckY;
    const dy0 = (y - distances[0].y) * 1.15;
    const dy1 = distances[1] ? (y - distances[1].y) * 1.15 : 0;
    for (let i = 0; i < width; i++, pixel++) {
      let bx = distances[0].x[i], by = dy0;
      let distance = bx * bx + by * by;
      if (distances[1]) {
        const dx = distances[1].x[i], second = dx * dx + dy1 * dy1;
        if (second < distance) { bx = dx; by = dy1; distance = second; }
      }
      const r = Math.sqrt(distance) / sc, th = Math.atan2(by, bx);
      const noise = wave[i] * slowY + broadSin[i] * bc + broadCos[i] * bs + fineSin[i] * fc + fineCos[i] * fs;
      let t = th / (Math.PI * 2) + r * 2.1 + noise * .05;
      t = (t - Math.floor(t)) * 4;
      const band = Math.floor(t), f = t - band;
      const m = Math.max(0, (f - .72) / .28), s = m * m * (3 - 2 * m);
      const edge = Math.max(0, 1 - Math.abs(f - .86) * 5);
      const crease = Math.max(0, Math.sin(th*34 + Math.sin(r*13+ph)*1.7 + Math.sin(th*13+r*22)*.85));
      const lift = Math.pow(crease,26) * (.15 + .85 * edge) * .6 + edge * .06;
      pixels[pixel] = (band << 14) | (Math.round(s * 127) << 7) | Math.round(lift * 192);
    }
  }
  return pixels;
}

function tieDye(g, w, h, cols, centres, R) {
  const width = g.canvas.width, height = g.canvas.height, ph = R() * 10;
  const key = [width, height, w, h, ph, ...centres.flat()].join('/');
  let field = dyeFields.get(g);
  if (field?.key !== key) {
    field = { key, pixels: buildDyeField(width, height, w, h, centres, ph) };
    dyeFields.set(g, field);
  }
  const img = g.createImageData(width, height), d = img.data;
  const colours = cols.map(rgbOf);
  const palette = new Uint8ClampedArray(4 * 65536);
  for (let i = 0; i < 65536; i++) {
    const band = i >> 14, blend = ((i >> 7) & 127) / 127, lift = (i & 127) / 192;
    const a = colours[band], b = colours[(band + 1) % 4];
    for (let channel = 0; channel < 3; channel++) {
      const value = a[channel] + (b[channel] - a[channel]) * blend;
      palette[i * 4 + channel] = value + (255 - value) * lift;
    }
  }
  for (let i = 0, offset = 0; i < field.pixels.length; i++, offset += 4) {
    const colour = field.pixels[i] * 4;
    d[offset] = palette[colour];
    d[offset + 1] = palette[colour + 1];
    d[offset + 2] = palette[colour + 2];
    d[offset + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// An irregular palm stamp. Pores lighten the ink without removing the cloth underneath.
let palm;
function hand(g, R, x, y, scale, rotation, color) {
  palm ||= new Path2D(
    'M -.40 .27 C -.50 .19 -.62 .04 -.57 -.052 C -.54 -.12 -.47 -.10 -.40 -.04 L -.28 .08 ' +
    'C -.30 -.10 -.40 -.32 -.43 -.47 C -.45 -.55 -.39 -.59 -.34 -.55 C -.29 -.51 -.23 -.30 -.18 -.22 ' +
    'C -.15 -.22 -.15 -.25 -.15 -.28 L -.21 -.71 C -.22 -.80 -.16 -.84 -.11 -.81 C -.06 -.78 -.045 -.70 -.031 -.60 ' +
    'L .032 -.30 C .045 -.27 .074 -.27 .084 -.31 L .081 -.75 C .084 -.84 .142 -.876 .184 -.842 ' +
    'C .226 -.808 .221 -.735 .218 -.65 L .201 -.29 C .204 -.25 .232 -.247 .247 -.278 L .325 -.57 ' +
    'C .35 -.65 .405 -.651 .436 -.609 C .468 -.56 .430 -.459 .412 -.365 L .345 -.085 ' +
    'C .34 .037 .397 .111 .342 .311 C .312 .457 .223 .583 .069 .629 C -.071 .676 -.210 .595 -.258 .491 ' +
    'C -.291 .417 -.328 .333 -.40 .27 Z'
  );
  g.save();
  g.translate(x, y);
  g.rotate(rotation);
  g.scale(R() < .5 ? -scale : scale, scale);
  g.fillStyle = color;
  g.fill(palm);
  g.clip(palm);
  g.fillStyle = 'rgba(238,225,207,.24)';
  for (let i = 0; i < 40; i++) {
    const px = (R() - .5) * 1.1, py = (R() - .55) * 1.55;
    const radius = .004 + .015 * R() * R();
    g.beginPath();
    g.ellipse(px, py, radius, radius * .67, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

const motifPaths = {
  corona: 'M-.8-.38-.39-.08 0-.57 .39-.08 .8-.38 .63 .48-.63 .48Z',
  escudo: 'M0-.78 .65-.42 .58 .38 0 .76-.58 .38-.65-.42Z',
};
const motifCache = {};
function star(g, radius, points) {
  g.beginPath();
  for (let i=0;i<points*2;i++) {
    const angle = i*Math.PI/points - Math.PI/2, edge = i % 2 ? radius * .43 : radius;
    g.lineTo(Math.cos(angle)*edge,Math.sin(angle)*edge);
  }
  g.closePath(); g.fill();
}
function circle(g,x,y,radius) { g.beginPath();g.arc(x,y,radius,0,Math.PI*2);g.fill(); }
function drawMotif(g, kind, x, y, size, color, accent) {
  g.save(); g.translate(x,y); g.scale(size,size); g.fillStyle=color; g.strokeStyle=color;
  if (motifPaths[kind]) {
    const path = motifCache[kind] ||= new Path2D(motifPaths[kind]);
    g.fill(path);
    g.fillStyle=accent;
    if (kind === 'escudo') star(g,.41,5);
  } else if (kind === 'estrellas') {
    star(g,.75,5);
  } else if (kind === 'planetitas') {
    circle(g,0,0,.59);
    g.strokeStyle=accent;g.lineWidth=.11;
    g.beginPath();g.ellipse(0,.05,.97,.25,-.40,0,Math.PI*2);g.stroke();
  } else if (kind === 'arcoiris') {
    [color,accent,mix(color,accent,.47)].forEach((tone,index)=>{
      g.strokeStyle=tone;g.lineWidth=.15;g.beginPath();g.arc(0,.34,.73-index*.20,Math.PI,Math.PI*2);g.stroke();
    });
  } else if (kind === 'sol') {
    star(g,.94,20);circle(g,0,0,.50);g.fillStyle=accent;circle(g,0,0,.34);
  } else if (kind === 'laureles') {
    g.lineWidth=.045;
    for (const side of [-1,1]) {
      g.beginPath();g.moveTo(side*.15,.68);g.quadraticCurveTo(side*.86,.44,side*.78,-.68);g.stroke();
      for (let i=0;i<6;i++) {
        const t=i/5;
        g.beginPath();g.ellipse(side*(.32+.46*Math.sin(t*1.48)),.55-1.12*t,.078,.19,side*(.78-.42*t),0,Math.PI*2);g.fill();
      }
    }
  }
  g.restore();
}

const motifSpacing = { chico: 146, mediano: 198, grande: 266 };

function repeatIllustration(g,preset,base,tones,w,h,k,scale,stretch,R) {
  const [a,b,c]=tones;
  const count=Math.max(2,Math.round(w/(k*(motifSpacing[scale] || motifSpacing.mediano))));
  const step=w/count,rowHeight=step*.88*stretch;
  const colours={ink:ink(c),a,b,c};
  const companion={planetitas:'orbitas',estrellas:'destellos'}[preset];
  for(let row=0;row<=Math.ceil(h/rowHeight);row++){
    for(let col=0;col<count;col++){
      const x=((col+.46+(row%2)*.51+(R()-.5)*.23)*step)%w;
      const y=(row+.25+R()*.28)*rowHeight;
      const turn=(R()-.5)*.58;
      const alternate=(row+col*2)%3===1;
      const kind=alternate && companion ? companion : preset;
      const size=(alternate && !companion ? .69 : .86)+R()*.15;
      const inks=alternate && !companion ? {...colours,a:mix(a,c,.38),c:mix(c,base,.21)} : colours;
      // Wrap stamps across the edges of the UV chart so pattern pieces meet on the seam.
      for (const offset of [-w,0,w]) {
        if (x+offset < -step || x+offset > w+step) continue;
        g.save();g.translate(x+offset,y);g.scale(1,stretch);g.rotate(turn);
        drawIllustration(g,kind,0,0,step*size,inks);
        g.restore();
      }
      g.fillStyle=mix(base,(row+col)%2?b:a,.66);
      circle(g,(x+step*.43)%w,y+rowHeight*.34,step*.023);
    }
  }
}

export function drawPattern(g, preset, base, accentIn, w, h, { seed = 3, k = 1, region = 'body', motifScale = 'mediano', sleeveStretch = 0 } = {}) {
  if (preset !== 'tiedye') dyeFields.delete(g);
  const R = rng(seed);
  const [accent, ac2, ac3] = Array.isArray(accentIn) ? accentIn : [accentIn, '#f4f1ec', accentIn];
  g.save();
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  if (preset === 'tricolor') {
    // Both sides and the raglan charts share the same vertical print register.
    TRICOLOR_BANDS.forEach(([, ,top,bottom],index)=>{
      g.fillStyle=[accent,ac2,ac3][index];g.fillRect(0,h*top,w,h*(bottom-top)+.4);
    });
  } else if (preset === 'diagonal') {
    g.translate(w*.50,h*.52);g.rotate(-.37);
    const spacing=245*k;
    for(let x=-w-h;x<w+h;x+=spacing){
      g.fillStyle=accent;g.fillRect(x,-h*2,spacing*.32,h*4);
      g.fillStyle=ac2;g.fillRect(x+spacing*.35,-h*2,spacing*.033,h*4);
    }
  } else if (Object.prototype.hasOwnProperty.call(illustrations,preset)) {
    const tones=[accent,ac2,ac3];
    if (sleeveStretch) {
      // Sleeves use two separate UV charts, with a shorter physical end-to-end axis.
      for(let panel=0;panel<2;panel++){
        g.save();g.translate(panel*w*.5,0);
        g.beginPath();g.rect(0,0,w*.5,h);g.clip();
        repeatIllustration(g,preset,base,tones,w*.5,h,k,motifScale,sleeveStretch,rng(seed));
        g.restore();
      }
    } else repeatIllustration(g,preset,base,tones,w,h,k,motifScale,1,R);
  } else if (preset === 'galactico') {
    const space=mix('#090d22',base,.47);
    g.fillStyle=space;g.fillRect(0,0,w,h);
    for(let i=0;i<Math.max(3,Math.round(w/(200*k)));i++){
      const x=(i+.5)*200*k,y=h*(.67+Math.sin(i*.73)*.15),r=(130+R()*120)*k;
      const glow=g.createRadialGradient(x,y,0,x,y,r);
      glow.addColorStop(0,[ac2,ac3,accent][i%3]+'a0');
      glow.addColorStop(1,space+'00');
      g.fillStyle=glow;g.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<Math.round(w/(5*k));i++){
      const x=R()*w,y=R()*h;
      g.fillStyle=i%7===0?accent:'#eee9fd';g.globalAlpha=R()*.64+.12;
      if(i%25===0) drawMotif(g,'estrellas',x,y,(4+R()*4)*k,accent,base);
      else circle(g,x,y,(.7+R()*R()*2.5)*k);
    }
  } else if (preset === 'splash') {
    const start=region==='body'?.63:.35;
    const band=g.createLinearGradient(0,h*start,w*.13,h);
    band.addColorStop(0,base);band.addColorStop(1,mix(base,ac3,.58));
    g.fillStyle=band;g.fillRect(0,h*start,w,h*(1-start)+1);
    const tones=[accent,ac3,accent,mix(ac2,base,.35)];
    for(let i=0;i<Math.max(12,Math.round(w/(65*k)));i++){
      const x=R()*w,y=h*(start+(1-start)*(R()*.93)),length=(70+R()*240)*k,stroke=(2+R()*13)*k;
      g.save();g.translate(x,y);g.rotate(-.31+(R()-.5)*.10);
      g.fillStyle=tones[i%tones.length];g.globalAlpha=.56+R()*.41;
      g.beginPath();
      g.moveTo(-length*.69,-stroke*.42);
      g.quadraticCurveTo(-length*.2,-stroke*1.05,length*.60,-stroke*.30);
      g.lineTo(length*.38,stroke*.06);
      g.quadraticCurveTo(length*.91,stroke*.14,length*.75,stroke*.38);
      g.quadraticCurveTo(-length*.22,stroke*.65,-length*.69,-stroke*.42);
      g.fill();g.restore();
      if(i%2===0){g.fillStyle=tones[(i+1)%tones.length];circle(g,x-length*.47,y+stroke*.80,(1.6+R()*2.6)*k);}
    }
  } else if (preset === 'degrade') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(0.38, base); gr.addColorStop(0.86, accent); gr.addColorStop(1, ac3);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const spacing=19*k;
    for(let row=0;row<Math.ceil(h*.32/spacing);row++) for(let x=0;x<w;x+=spacing){
      const y=h*.52+row*spacing;
      g.globalAlpha=.10+.26*Math.sin(row*spacing/(h*.32)*Math.PI);
      g.fillStyle=ac2;circle(g,x+row%2*spacing*.5,y,Math.min(2.7*k,row*.35*k));
    }
  } else if (preset === 'rayas') {
    const spacing=256*k,stripe=106*k;
    for(let x=0;x<w;x+=spacing){
      g.fillStyle=accent;g.fillRect(x+75*k,0,stripe,h);
      g.fillStyle=ac2;g.fillRect(x+75*k,0,4*k,h);
      g.fillStyle=ac3;g.fillRect(x+178*k,0,3*k,h);
    }
  } else if (preset === 'camuflaje') {
    // organic camouflage, three ink layers over the garment colour
    [[ac3, 30, 140], [ac2, 26, 115], [accent, 22, 92]].forEach(([c, n, r]) => { g.fillStyle = c; const cnt = Math.round(n * (w * h) / (2048 * 1024) / Math.max(0.3, k * k)) + 6;
      for (let i = 0; i < cnt; i++) { blobPath(g, R, R() * w, R() * h, (r * (0.6 + R() * 0.8)) * k); g.fill(); } });
  } else if (preset === 'tiedye') {
    const centres = region === 'body' ? [[0.25, 0.5], [0.75, 0.5]] : [[0.3 + R() * 0.4, 0.5]];
    tieDye(g, w, h, [accent, ac2, base, ac3], centres, R);

  } else if (preset === 'manitos') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(0.55, mix(base, ac3, 0.35)); gr.addColorStop(1, ac3); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const palette=[accent,ac2,mix(ac2,accent,.65),mix(ac2,'#51948d',.63),mix(base,ac3,.33)];
    const scale=(motifSpacing[motifScale] || motifSpacing.mediano)/motifSpacing.mediano;
    const count=Math.round((region==='body'?34:12)/(scale*scale));
    for(let i=0;i<count;i++){
      const x=R()*w, y=h*(.15+R()*.82);
      hand(g,R,x,y,(55+R()*33)*k*scale,(R()-.5)*1.9,palette[i%palette.length]);
    }
  } else if (preset === 'geometrico') {
    const panels = region==='body'?2:1;
    const width=w/panels;
    const shapes=[
      [mix(base,ac3,.72),[[0,.73],[.36,.55],[1,.76],[1,1],[0,1]]],
      [mix(base,accent,.52),[[0,.86],[.56,.65],[1,.83],[.81,1],[0,1]]],
      [accent,[[0,.9],[.47,.74],[.66,.80],[.16,1],[0,1]]],
      [ac3,[[.22,1],[.78,.82],[1,.9],[1,1]]],
      [ac2,[[.55,.65],[.98,.81],[.96,.823],[.53,.665]]],
    ];
    for(let i=0;i<panels;i++) for(const [colour,points] of shapes){
      g.beginPath();
      for(const [x,y] of points) g.lineTo((i+(i%2?1-x:x))*width,y*h);
      g.closePath();g.fillStyle=colour;g.fill();
    }
  }
  g.restore();
}

function fitText(g, txt, font, maxW, size) { let s = size; g.font = font(s); while (g.measureText(txt).width > maxW && s > 8) { s -= 2; g.font = font(s); } return s; }
export function imMark(g, x, y, r) {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#c8161d'; g.beginPath(); g.arc(x, y, r * 0.86, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = `italic ${r * 1.25}px "DM Serif Display"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('im', x - r * 0.04, y - r * 0.08);
}
export function drawLogo(g, img, x, y, size, maxHeight = size) {
  if (!img) return;
  const width = img.naturalWidth || img.width, height = img.naturalHeight || img.height;
  if (!width || !height) return;
  const scale = Math.min(size / width, maxHeight / height);
  const w = width * scale, h = height * scale;
  // Keep the original SVG or bitmap as the source. Rasterize it once into
  // the final sRGB print canvas at its physical atlas-pixel size.
  g.drawImage(img, x - w / 2, y - h / 2, w, h);
}

/* Torso canvas 2048x1024: front = left half (center x=512), back = right half (center x=1536). */
function stitch(g, scale, base, path) {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(15,12,10,.22)';
  g.lineWidth = 2.1 * scale;
  path();
  g.translate(0, -1.25 * scale);
  g.setLineDash([5 * scale, 3.2 * scale]);
  g.strokeStyle = lum(base) > .38 ? 'rgba(22,20,17,.28)' : 'rgba(240,232,222,.22)';
  g.lineWidth = 1.85 * scale;
  path();
  g.restore();
}
function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function placementFont(type, size) {
  if (type === 'college') return `bold ${size}px Georgia`;
  if (type === 'moderna') return `700 ${size}px "Inter Tight"`;
  return `${size}px Anton`;
}
function placementBase(design, y, h, base) {
  if (design.preset === 'tricolor') return design.colors[tricolorBand(y/h)];
  return design.preset === 'galactico' ? '#0a0f2a' : base;
}
export function tricolorBand(vertical) {
  return (TRICOLOR_BANDS.find(([, , ,bottom])=>vertical<bottom) || TRICOLOR_BANDS[2])[0];
}
function placedText(g, value, x, y, width, size, design, base) {
  const text = String(value).toUpperCase();
  if (!text) return;
  g.textAlign='center';g.textBaseline='middle';g.fillStyle=ink(base);
  fitText(g,text,s=>placementFont(design.tipografia,s),width,size);
  const outlined = design.tipografia === 'varsity' || ['splash','geometrico','tricolor','tiedye','manitos'].includes(design.preset) ||
    Object.prototype.hasOwnProperty.call(illustrations,design.preset);
  if (outlined) {
    g.lineJoin='round';g.lineWidth=Math.min(6,size*.115);g.strokeStyle=base;
    g.strokeText(text,x,y);
  }
  g.fillText(text,x,y);
}
function placementContent(st) {
  const entries = [
    [st.nombreLugar || 'pecho-der','text',st.nombre,'name'],
    [st.numeroLugar || 'espalda-centro','number',st.numero,'number'],
    [st.espaldaLugar || 'espalda-baja','text',st.espalda,'back'],
    [st.logoLugar || 'pecho-izq','logo',st.logoImg,'logo'],
    [st.arteLugar || 'espalda-centro','artwork',st.arte === 'ninguno' ? '' : st.arte,'artwork'],
    ['espalda-baja','text',st.escuela,'small'],
    ['espalda-baja','text',st.frase,'small'],
  ];
  return entries.filter(([, ,value])=>value);
}
function drawPlaced(g, entries, x, y, width, height, state, base) {
  const text = entries.filter(([,kind])=>kind !== 'artwork');
  const art = entries.find(([,kind])=>kind === 'artwork');
  const adornsNumber = art?.[2] === 'laureles' && text.length === 1 && text[0][1] === 'number';
  if (adornsNumber) {
    g.save();g.translate(x,y);g.scale(1.64,1);
    drawMotif(g,'laureles',0,0,height*.57,ink(base),base);
    g.restore();
  }
  const items = art && !adornsNumber ? [art,...text] : text;
  const slot = height / items.length;
  items.forEach(([,kind,value,role],index)=>{
    const cy=y+(index-(items.length-1)*.5)*slot;
    if (kind==='logo') drawLogo(g,value,x,cy,width*.80,slot*.86);
    else if (kind==='artwork') drawMotif(g,value,x,cy,Math.min(width*.34,slot*.60),ink(base),state.colors.acento);
    else {
      const maxFont = role==='small' ? 32 : kind==='number' ? 208 : role==='name' ? 58 : 79;
      placedText(g,value,x,cy,width*(adornsNumber ? .54 : 1),Math.min(maxFont,slot*.86),state,base);
    }
  });
}
function torsoPlacements(g, st, product, Y, W, H) {
  const jacket = product==='campera';
  const localized = st.hideAutoMark;
  const chestY=Y(jacket ? .052 : .054), sx=W/2048;
  const zones = {
    'pecho-izq':[jacket?674:671,chestY,177,95],
    'pecho-der':[jacket?350:347,chestY,177,95],
    'espalda-alta':[1536,Y(jacket?-.017:.108),400,91],
    'espalda-centro':[1536,Y(jacket?-.122:-.012),470,localized?136:191],
    'espalda-baja':[1536,Y(jacket?-.234:-.171),490,104],
  };
  if (!jacket) zones['pecho-centro']=[512,Y(-.039),373,localized?116:142];
  const entries=placementContent(st);
  g.save();
  for (const [zone,[x,y,width,height]] of Object.entries(zones)) {
    const here=entries.filter(([place])=>place===zone || (jacket && zone==='pecho-der' && place==='pecho-centro'));
    if(here.length) drawPlaced(g,here,x*sx,y,width*sx,height*sx,st,placementBase(st,y,H,st.colors.cuerpo));
  }
  if (!localized) imMark(g,1536*sx,Y(jacket ? .069 : .195),13*sx);
  g.restore();
}
export function torsoCanvas(cv, st, { vOf, product }) {
  const W = cv.width, H = cv.height, g = cv.context;
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 11, k: W / 2048, motifScale:st.escalaMotivo });
  const Y = y => (1 - vOf(y)) * H;
  if (st.nombreLugar || st.numeroLugar || st.logoLugar || st.espaldaLugar || st.arte || st.tipografia || st.hideAutoMark) {
    torsoPlacements(g, st, product, Y, W, H);
    return;
  }
  const base = st.preset === 'galactico' ? '#0a0f2a' : (st.preset === 'tiedye' || st.preset === 'manitos') ? '#1b1f3b' : st.colors.cuerpo;
  const t = ink(base), sx = W / 2048;
  g.textBaseline = 'alphabetic';
  // front chest
  const nm = (st.nombre || '').toUpperCase();
  if (product !== 'campera') {
    const sleeveless = product === 'musculosa';
    const nameY = Y(sleeveless ? .061 : .085);
    g.textAlign = 'left'; g.fillStyle = t;
    fitText(g, nm, s => `${s}px Anton`, 200 * sx, (sleeveless ? 69 : 78) * sx);
    if (st.preset !== 'liso' && st.preset !== 'degrade' && st.preset !== 'galactico') {
      g.save(); g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = 9 * sx;
      g.strokeText(nm, 285 * sx, nameY); g.restore();
    }
    g.fillText(nm, 285 * sx, nameY);
    g.font = `600 ${21 * sx}px "Barlow Condensed"`; g.fillStyle = mix(t, base, 0.09);
    const sub = [st.espalda, st.escuela].filter(Boolean).join(' · ').toUpperCase();
    fitText(g, sub, s => `600 ${s}px "Barlow Condensed"`, 250 * sx, 25 * sx);
    g.fillText(sub, 287 * sx, nameY + 34 * sx);
    const logoY = Y(sleeveless ? .074 : .1);
    if (st.logoImg) drawLogo(g, st.logoImg, 680 * sx, logoY, 110 * sx);
    else if (!st.hideAutoMark) imMark(g, 680 * sx, logoY, 42 * sx);
  } else {
    g.textAlign = 'center'; g.fillStyle = t;
    fitText(g, nm, s => `${s}px Anton`, 150 * sx, 54 * sx); g.fillText(nm, 338 * sx, Y(0.08));
    if (st.logoImg) drawLogo(g, st.logoImg, 650 * sx, Y(0.095), 100 * sx);
  }
  const jacket = product === 'campera';
  const numberY = Y(jacket ? -.118 : -.065);
  // back
  g.textAlign = 'center'; g.fillStyle = t;
  const busy = st.preset !== 'liso' && st.preset !== 'degrade';
  const outl = (txt, x, y, w) => { if (busy) { g.save(); g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = w * sx; g.strokeText(txt, x, y); g.restore(); } g.fillText(txt, x, y); };
  fitText(g, nm, s => `${s}px Anton`, 420 * sx, (jacket ? 60 : 76) * sx); outl(nm, 1536 * sx, Y(jacket ? .008 : .122), 10);
  if (st.numero) {
    const num = String(st.numero).slice(0, 3);
    fitText(g, num, s => `${s}px Anton`, 460 * sx, (jacket ? 206 : 300) * sx); g.lineWidth = 9 * sx;
    const ac = lum(st.colors.acento) - lum(base); g.strokeStyle = Math.abs(ac) < 0.08 ? t : st.colors.acento;
    if (st.preset === 'rayas') { g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = 16 * sx; g.strokeText(num, 1536 * sx, numberY); g.fillStyle = t; g.fillText(num, 1536 * sx, numberY); }
    else { g.fillStyle = base === '#0a0f2a' ? 'rgba(10,15,42,.6)' : base; g.fillText(num, 1536 * sx, numberY); g.strokeText(num, 1536 * sx, numberY); }
  }
  if (st.espalda) { g.fillStyle = t; fitText(g, st.espalda.toUpperCase(), s => `${s}px Anton`, 520 * sx, (jacket ? 110 : 124) * sx); outl(st.espalda.toUpperCase(), 1536 * sx, Y(jacket ? -.193 : -.156), 12); }
  const frase = (st.frase || '').toUpperCase();
  if (frase) { g.fillStyle = mix(t, base, 0.08); fitText(g, frase, s => `600 ${s}px "Barlow Condensed"`, 640 * sx, 34 * sx); g.fillText(frase, 1536 * sx, Y(jacket ? -.259 : -.190)); }
  if (jacket && st.escuela) {
    g.fillStyle = t;
    fitText(g, st.escuela.toUpperCase(), size => `600 ${size}px "Barlow Condensed"`, 530 * sx, 29 * sx);
    g.fillText(st.escuela.toUpperCase(), 1536 * sx, Y(-.227));
  }
  // brand tag below back collar
  if (!jacket && !st.hideAutoMark) imMark(g, 1536 * sx, Y(0.195), 13 * sx);
}

export function plainCanvas(cv, st, zone, { pattern = false, seed = 5 } = {}) {
  const g = cv.context;
  const sleeveStretch=zone==='mangas' ? st.producto==='campera' ? .82 : 2.15 : 0;
  if (pattern && st.preset !== 'liso') drawPattern(g, st.preset, st.colors[zone], pcols(st), cv.width, cv.height, { seed, k: cv.width / 2048, region: 'side', motifScale:st.escalaMotivo, sleeveStretch });
  else { dyeFields.delete(g); g.fillStyle = st.colors[zone]; g.fillRect(0, 0, cv.width, cv.height); }
}
export function sleeveCanvas(cv, st) {
  plainCanvas(cv,st,'mangas',{pattern:st.printAll,seed:9});
  const g=cv.context, W=cv.width, H=cv.height;
  if (st.printAll && st.preset !== 'liso' && !Object.prototype.hasOwnProperty.call(illustrations,st.preset)) {
    const canvas=cv.canvas;
    g.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,W*.5,H);
    g.drawImage(canvas,0,0,canvas.width*.5,canvas.height,W*.5,0,W*.5,H);
  }
  const fromBody=placementContent(st);
  const start=st.producto==='conjunto' ? .225 : st.producto==='campera' ? .25 : .16;
  const y=H*(st.producto==='conjunto' ? .51 : st.producto==='campera' ? .38 : .32);
  for(const [i,place,initials] of [[0,'manga-der',st.mangaDer],[1,'manga-izq',st.mangaIzq]]) {
    const entries=fromBody.filter(([zone])=>zone===place);
    if(initials) entries.push([place,'text',initials,'initials']);
    if(!entries.length) continue;
    const base=st.printAll?placementBase(st,y,H,st.colors.mangas):st.colors.mangas;
    // The wrapped charts are mirrored on one arm. Restore reading direction
    // for localized ink while leaving the fabric pattern in its own space.
    const reverse = st.producto==='campera' ? i===0 : i===1;
    const rightRaglan = st.producto==='campera' && i===0;
    g.save();g.translate(W*(start+i*.5+(rightRaglan ? .023 : 0)),0);g.scale(reverse ? -1 : 1,1);
    drawPlaced(g,entries,0,y,W*(rightRaglan ? .069 : .081),H*.12,st,base);
    g.restore();
  }
}
export function hoodCanvas(cv, st) {
  plainCanvas(cv, st, 'capucha', {pattern: st.printAll, seed: 13});
  const g = cv.context, W = cv.width, H = cv.height;
  stitch(g, W / 1024, st.colors.capucha, () => {
    line(g, W * .494, 0, W * .494, H);
    line(g, W * .506, 0, W * .506, H);
    line(g, 0, H * .042, W, H * .042);
  });
}
export function shortCanvas(cv, st, withoutNumber) {
  const g = cv.context, W = cv.width, H = cv.height;
  const base = st.colors.short;
  const preset=st.preset==='splash' || (st.preset==='tricolor' && st.producto==='conjunto') ? 'liso' : st.preset;
  drawPattern(g, preset, base, pcols(st), W, H, { seed: 21, k: W / 2048, motifScale:st.escalaMotivo });
  const sx = W / 1024;
  g.fillStyle = st.colors.acento;
  [0, .5, 1].forEach(u => g.fillRect((u - .009) * W, 0, .018 * W, H));
  stitch(g, sx, base, () => {
    [.944, .962].forEach(y => line(g, 0, y * H, W, y * H));
    [.013, .487, .513, .987].forEach(x => line(g, x * W, 0, x * W, .95 * H));
  });
  if (withoutNumber !== cv) withoutNumber.context.drawImage(cv.canvas, 0, 0, W, H);
  if (st.numero) {
    g.fillStyle = ink(preset==='tricolor' ? st.colors.acento3 : base);
    g.textAlign = 'center';
    g.font = `${84 * sx}px Anton`;
    g.fillText(String(st.numero).slice(0, 3), W * .31, H * .76);
  }
}
export function flagCanvas(cv, st) {
  const g = cv.context, W = cv.width, H = cv.height;
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 31, k: W / 2048, motifScale:st.escalaMotivo });
  const trim = W * .014;
  g.fillStyle = 'rgba(17,17,17,.15)';
  g.fillRect(0, 0, W, trim); g.fillRect(0, H - trim, W, trim);
  g.fillRect(0, 0, trim * 1.27, H); g.fillRect(W - trim, 0, trim, H);
  stitch(g, W / 2048, st.colors.cuerpo, () => {
    [.66, 1.12].forEach(multiplier => {
      const edge = trim * multiplier;
      g.strokeRect(edge * 1.24, edge, W - edge * 2.24, H - edge * 2);
    });
  });
  const t = ink(st.preset === 'galactico' ? '#0a0f2a' : st.colors.cuerpo);
  g.textAlign = 'center'; g.fillStyle = t;
  const big = (st.espalda || '').toUpperCase();
  fitText(g, big, s => `${s}px Anton`, W * 0.8, 380); g.fillText(big, W / 2, H * 0.58);
  if (st.escuela) { g.font = `600 64px "Barlow Condensed"`; fitText(g, st.escuela.toUpperCase(), s => `600 ${s}px "Barlow Condensed"`, W * 0.7, 64); g.fillText(st.escuela.toUpperCase(), W / 2, H * 0.72); }
  if (st.logoImg) drawLogo(g, st.logoImg, W / 2, H * 0.2, 220); else imMark(g, W / 2, H * 0.2, 80);
}
export function capCanvas(cv, st) {
  const g = cv.context, W = cv.width, H = cv.height;
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 41, k: W / 2048 * .7, motifScale:st.escalaMotivo });
  stitch(g, W / 1024, st.colors.cuerpo, () => line(g, 0, H * .936, W, H * .936));
  const base=placementBase(st,H*.60,H,st.colors.cuerpo);
  const text=[...new Set([st.nombre,st.espalda].filter(Boolean))];
  if(st.logoImg)drawLogo(g,st.logoImg,W*.5,H*.61,W*.38,H*(text.length ? .26 : .37));
  if(text[0])placedText(g,text[0],W*.5,H*(st.logoImg ? .405 : .60),W*.51,H*(st.logoImg ? .12 : .245),st,base);
  if(text[1])placedText(g,text[1],W*.5,H*.775,W*.47,H*.10,st,base);
}
export function knitNormal(size = 256, kind = 'jersey') {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); const img = g.createImageData(size, size);
  const height = (x, y) => {
    const u = x / size, v = y / size;
    const cycle = Math.PI * 2;
    if (kind === 'rib') {
      return Math.cos(u * cycle * 14) * .85 + Math.sin(v * cycle * 29 + Math.sin(u * cycle * 14)) * .14;
    }
    if (kind === 'twill') {
      return .57 * Math.sin((u * 26 + v * 37) * cycle) * Math.sin(v * 40 * cycle)
        + .23 * Math.sin(u * 48 * cycle);
    }
    if (kind === 'mesh') {
      const row = Math.floor(v * 28), fx = ((u * 24 + row * .5) % 1) - .5, fy = (v * 28 % 1) - .5;
      return -.8 * Math.exp(-(fx * fx * 20 + fy * fy * 13)) + .18 * Math.sin((u + v) * cycle * 37);
    }
    if (kind === 'fleece') {
      return Math.sin(u * cycle * 23 + Math.sin(v * cycle * 27)) * .45
        + Math.sin(v * cycle * 19 + Math.cos(u * cycle * 17)) * .38;
    }
    const cx = u * 30, cy = v * 26, fx = cx % 1, fy = cy % 1;
    return Math.sin(fx * Math.PI) * .62 + Math.cos((fy + Math.abs(fx - .5) * .64) * cycle) * .38;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = height((x + 1) % size, y) - height((x - 1 + size) % size, y), dy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
    const n = [-dx * 0.5, -dy * 0.5, 1], l = Math.hypot(...n); const i = (y * size + x) * 4;
    img.data[i] = (n[0] / l * 0.5 + 0.5) * 255; img.data[i + 1] = (n[1] / l * 0.5 + 0.5) * 255; img.data[i + 2] = (n[2] / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// This repeatable albedo tile models interlaced yarn, filament variation and the
// fine lint that remains visible under printed ink. Normal and roughness use the same grain.
const yarns = new Map();
function yarnTile(kind) {
  if (yarns.has(kind)) return yarns.get(kind);
  const size = 144, tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d'), img = ctx.createImageData(size, size);
  const random = rng(2327 + kind.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = Math.PI * 2 * x / size, b = Math.PI * 2 * y / size;
      const warp = Math.sin(28 * a + .32 * Math.sin(7 * b));
      const weft = Math.cos(24 * b + .45 * Math.sin(6 * a));
      const yarn = kind === 'fleece'
        ? 11 * Math.sin(a * 25 + 3 * Math.sin(b * 23)) * Math.sin(b * 28)
        : 14 * warp * Math.cos(14 * a + 12 * b) + 13 * weft * Math.sin(12 * b - 14 * a);
      const filament = 6 * Math.sin(a * 47 + b * 43) + 10 * (random() - .5);
      const marl = 8 * Math.sin(a * 4 + Math.sin(b * 3)) * Math.sin(b * 5);
      const value = 128 + yarn + filament + marl;
      const i = 4 * (y * size + x);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  yarns.set(kind, tile);
  return tile;
}
export function fabricGrain(kind) {
  const texture = new THREE.CanvasTexture(yarnTile(kind));
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
export function fabricRoughness(kind, repeat) {
  const canvas = document.createElement('canvas'), source = yarnTile(kind);
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = kind === 'fleece' ? .20 : .32;
  context.drawImage(source, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  return texture;
}
export function truckerMeshMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  const { width, height } = canvas;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  context.beginPath();
  for (let y = 19; y < height - 25; y += 9) {
    for (let x = 7 + (Math.floor(y / 9) % 2) * 4; x < width - 6; x += 8) {
      context.moveTo(x + 2.4, y);
      context.ellipse(x, y, 2.4, 2.2, 0, 0, Math.PI * 2);
    }
  }
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}
