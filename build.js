// Build: src/ -> site/ (classic scripts, inlined fonts) so the site works over http AND file://
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const S = path.join(__dirname, 'src'), O = path.join(__dirname, 'site');
const common = { bundle: true, format: 'iife', minify: true, target: ['es2018', 'safari12', 'ios12', 'chrome70', 'firefox68'], legalComments: 'inline', logLevel: 'warning' };
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
  const html = fs.readFileSync(path.join(S, 'index.html'), 'utf8').replace('FACES', () => JSON.stringify(fr).replace(/</g, '\\u003c')).replace('<!--CSS-->', () => `<style>${r.code.replace(/<\/style/gi, '<\\/style')}</style>`);
  fs.writeFileSync(path.join(O, 'index.html'), html);
  for (const f of ['index.html','js/app.js','js/studio.js','css/styles.css','css/fonts-inline.css']) console.log(f, (fs.statSync(path.join(O,f)).size/1024).toFixed(0)+' KB');
})().catch(e => { console.error(e); process.exit(1); });
