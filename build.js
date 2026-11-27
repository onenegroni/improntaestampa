// Build: src/ -> site/ (classic scripts, inlined fonts) so the site works over http AND file://
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const catalogue = require('./src/data/catalogue.json');
const S = path.join(__dirname, 'src'), O = path.join(__dirname, 'site');
const common = { bundle: true, format: 'iife', minify: true, target: ['es2018', 'safari12', 'ios12', 'chrome70', 'firefox68'], legalComments: 'inline', logLevel: 'warning' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const photoPath = (id, preview = false) => `img/trabajos/${id}${preview ? '-680' : ''}.webp`;
const arrow = '<span aria-hidden="true">›</span>';
function retailCard(card, nested = false) {
  const photo = card.photo && catalogue.photos.find(([id]) => id === card.photo);
  const image = photo ? `<img class="pimg" src="${photoPath(photo[0],true)}" width="${photo[4]}" height="${photo[5]}" alt="${escapeHtml(photo[3])}" loading="lazy" decoding="async">`
    : card.image ? `<img class="pimg" src="img/${card.image}" width="840" height="840" alt="${escapeHtml(card.alt)}" loading="lazy" decoding="async">` : '';
  const enquiry = card.enquiry ? `<a class="more" href="https://wa.me/5492644127431?text=${encodeURIComponent(card.enquiry[1])}" target="_blank" rel="noopener">${escapeHtml(card.enquiry[0])} ${arrow}</a>` : '';
  const links = (card.links || []).map(([product,label,size]) => `<a class="more" href="#configurador" data-product="${product}" data-segment="${card.id}"${size ? ` data-size="${escapeHtml(size)}"` : ''}>${escapeHtml(label)} ${arrow}</a>`).join('');
  const heading = nested ? 'h4' : 'h3';
  return `<article class="pitem${image ? '' : ' catalogue-text'}" id="catalogo-${card.id}">${image}<div class="catalogue-copy">${card.note ? `<p class="catalogue-kicker">${escapeHtml(card.note)}</p>` : ''}<${heading}>${escapeHtml(card.title)}</${heading}><p>${escapeHtml(card.copy)}</p><div class="catalogue-links">${links}${enquiry}</div></div></article>`;
}
function renderCatalogue() {
  const categories = catalogue.categories.map(card => `<a href="#catalogo-${card.id}">${escapeHtml(catalogue.segments[card.id])}</a>`).join('');
  return `<div class="wrap"><nav class="catalogue-nav" aria-label="Categorías del catálogo"><a href="#catalogo-egresados">Egresados</a>${categories}</nav></div>
  <section class="catalogue-graduation" id="catalogo-egresados" aria-labelledby="egresados-title"><div class="wrap catalogue-intro"><h3 id="egresados-title">Egresados</h3><p>Elegí el nivel y encontrá ideas para tu promoción.</p></div><div class="wrap product-gallery"><div class="product-list">${catalogue.graduation.map(card=>retailCard(card,true)).join('')}</div></div></section>
  <div class="wrap product-gallery catalogue-services"><div class="product-list">${catalogue.categories.map(card=>retailCard(card)).join('')}</div></div>`;
}
function renderOwnerPhotos() {
  return catalogue.photos.map(([id,category,title,alt,width,height]) => `<figure class="card rv" data-cat="${category}" data-owner-photo="${id}"><button class="ph2" data-lb="${photoPath(id)}" aria-label="Ampliar foto de ${escapeHtml(title)}"><img src="${photoPath(id,true)}" width="${width}" height="${height}" loading="lazy" decoding="async" alt="${escapeHtml(alt)}"></button><figcaption class="cap"><b>${escapeHtml(title)}</b><span>${escapeHtml(catalogue.segments[category])}</span></figcaption></figure>`).join('\n');
}
(async () => {
  for (const f of ['main.js','configurator.js','garments.js','textures.js']) fs.rmSync(path.join(O,'js',f),{force:true});
  fs.rmSync(path.join(O,'js','vendor'),{recursive:true,force:true});
  await esbuild.build({ ...common, entryPoints: [path.join(S, 'js/main.js')], outfile: path.join(O, 'js/app.js') });
  await esbuild.build({ ...common, loader: { '.webp': 'dataurl', '.im3d': 'binary' }, entryPoints: [path.join(S, 'js/studio-entry.js')], outfile: path.join(O, 'js/studio.js') });
  let css = fs.readFileSync(path.join(S, 'styles.css'), 'utf8');
  // fonts: separate woff2 files (font-display:swap) so first paint never waits for them; the page CSS is inlined in <head>.
  // file:// can't load @font-face files cross-origin, so an inline-font stylesheet is injected only there (see <head>).
  const faces = css.match(/@font-face\{[^}]*\}/g) || []; css = css.replace(/@font-face\{[^}]*\}\n?/g, '');
  const CT = ['safari12', 'ios12', 'chrome70', 'firefox68'];
  fs.rmSync(path.join(O, 'fonts'), { recursive: true, force: true }); fs.mkdirSync(path.join(O, 'fonts'));
  for (const f of fs.readdirSync(path.join(S, 'fonts'))) fs.copyFileSync(path.join(S, 'fonts', f), path.join(O, 'fonts', f));
  const facesHttp = faces.join('').replace(/url\(\.\.\/fonts\//g, 'url(fonts/');
  const facesInline = faces.join('').replace(/url\(\.\.\/fonts\/([\w-]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(S, 'fonts', f)).toString('base64')})`);
  const r = await esbuild.transform(css, { loader: 'css', minify: true, target: CT });
  const fr = (await esbuild.transform(facesHttp, { loader: 'css', minify: true, target: CT })).code.trim();
  fs.writeFileSync(path.join(O, 'css/styles.css'), fr.replace(/url\(fonts\//g, 'url(../fonts/') + r.code);
  fs.writeFileSync(path.join(O, 'css/fonts-inline.css'), (await esbuild.transform(facesInline, { loader: 'css', minify: true })).code);
  const html = fs.readFileSync(path.join(S, 'index.html'), 'utf8').replace('FACES', () => JSON.stringify(fr).replace(/</g, '\\u003c')).replace('<!--CSS-->', () => `<style>${r.code.replace(/<\/style/gi, '<\\/style')}</style>`).replace('<!--CATALOGUE-->',renderCatalogue).replace('<!--OWNER-PHOTOS-->',renderOwnerPhotos);
  fs.writeFileSync(path.join(O, 'index.html'), html);
  for (const f of ['index.html','js/app.js','js/studio.js','css/styles.css','css/fonts-inline.css']) console.log(f, (fs.statSync(path.join(O,f)).size/1024).toFixed(0)+' KB');
})().catch(e => { console.error(e); process.exit(1); });
