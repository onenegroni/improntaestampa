// Functional test: node test.js  (desktop + mobile)
const {chromium}=require('playwright');const fs=require('fs');
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('  ✓',m)};
async function run(name,ctxOpts,mobile){
 console.log('== '+name);
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({...ctxOpts,acceptDownloads:true});const p=await ctx.newPage();
 const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('pageerror '+e.message));
 p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())});
 await p.goto((process.env.BASE||'http://localhost:8080/')+(process.env.Q||''),{waitUntil:'networkidle'});
 ok(await p.evaluate(()=>scrollY)===0,'page stays at top on load');
 await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 await p.evaluate(()=>document.querySelector('#configurador').scrollIntoView());
 if(mobile){await p.waitForTimeout(300);await p.tap('#openDz');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.body.classList.contains('dz')),'mobile: Diseñar en 3D opens the full-screen designer');}
 await p.waitForFunction(()=>document.getElementById('viewer').classList.contains('ready'),null,{timeout:60000});
 ok(true,'3D configurator lazy-loaded');
 const clk=async sel=>{await p.evaluate(s=>{const e=document.querySelector(s.split(',')[0]);e&&e.scrollIntoView({block:'center'})},sel);await p.waitForTimeout(150);await p.click(sel)};
 const tab=async g=>{if(mobile){await clk('#tab-'+g);await p.waitForTimeout(250);}};
 const st=()=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__impronta.state,(k,v)=>k==='logoImg'?undefined:v)));
 await tab('producto');
 for(const k of ['campera','conjunto','musculosa','bandera','gorra','remera']){await clk(`#grp-producto .chip[data-v=${k}]`);await p.waitForTimeout(900);ok((await st()).producto===k,'product '+k);}
 await tab('tela');await clk('#grp-tela .fab button[data-v=modal]');ok((await st()).tela==='modal','tela modal');
 await tab('colores');await clk('.zp[data-z=cuerpo]');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.querySelector('#slotZone .cw').hidden),'zone pill opens colour wheel');
 await clk('#slotZone .cw-rec button:nth-child(5)');await p.waitForTimeout(400);
 const s1=await st();ok(s1.colors.cuerpo!=='#141414','cuerpo color changed via recent swatch → '+s1.colors.cuerpo);
 await p.fill('#slotZone .cw-hex','#1E2F5C');await p.press('#slotZone .cw-hex','Enter');await p.waitForTimeout(300);ok((await st()).colors.cuerpo==='#1e2f5c','hex input sets colour');
 // tap a sleeve on the 3D product -> selects the Mangas zone (tap = movement < 6px)
 await p.evaluate(()=>{document.querySelector('#viewer').scrollIntoView({block:'center'});const v=window.__impronta.api.view;v.auto=false;v.lastInteract=performance.now()+1e9;});await p.waitForTimeout(900);
 const pt=await p.evaluate(()=>window.__impronta.api.zoneScreenPoint('mangas'));ok(!!pt,'sleeve located on screen');
 if(mobile)await p.touchscreen.tap(pt.x,pt.y);else await p.mouse.click(pt.x,pt.y);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.querySelector('.zp[aria-checked=true]')?.dataset.z==='mangas'&&!document.querySelector('.cw').hidden),'tapping sleeve selects Mangas + opens wheel');
 const wb=await p.evaluate(()=>{const e=document.querySelector('.cw-wheel');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});await p.waitForTimeout(200);
 const m0=(await st()).colors.mangas;await p.mouse.move(wb.x+wb.w*.5,wb.y+wb.h*.5);await p.mouse.down();await p.mouse.move(wb.x+wb.w*.2,wb.y+wb.h*.7,{steps:5});await p.mouse.up();await p.waitForTimeout(400);
 ok((await st()).colors.mangas!==m0,'dragging the wheel changes sleeve colour → '+(await st()).colors.mangas);
 await clk('#slotZone .cw-x');ok(await p.evaluate(()=>document.querySelector('.cw').hidden),'wheel closes');
 // drag-rotate must not select a zone
 const g=await p.evaluate(()=>{const e=document.querySelector('#gl canvas');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});await p.waitForTimeout(200);
 if(!mobile){await p.mouse.move(g.x+g.w*.45,g.y+g.h*.45);await p.mouse.down();await p.mouse.move(g.x+g.w*.65,g.y+g.h*.45,{steps:8});await p.mouse.up();await p.waitForTimeout(300);ok(await p.evaluate(()=>document.querySelector('.cw').hidden),'drag-to-rotate does not open the wheel');}
 await tab('estampa');await clk('#grp-estampa .prints button[data-v=galactico]');await p.waitForTimeout(800);ok((await st()).preset==='galactico','pattern galáctico');
 for(const k of ['tiedye','manitos','camuflaje','geometrico']){await clk(`#grp-estampa .prints button[data-v=${k}]`);await p.waitForTimeout(700);ok((await st()).preset===k,'pattern '+k);}
 await clk('#pcols .pc[data-i="2"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.querySelector('#slotPrint .cw').hidden),'print colour 3 opens wheel');
 await p.fill('#slotPrint .cw-hex','#F2C230');await p.press('#slotPrint .cw-hex','Enter');await p.waitForTimeout(300);ok((await st()).colors.acento3==='#f2c230','print colour 3 set');
 await clk('#grp-estampa .prints button[data-v=galactico]');await p.waitForTimeout(800);
 await tab('texto');await p.fill('#fNombre','');await p.type('#fNombre','JUANI');await p.fill('#fNum','10');await p.waitForTimeout(500);
 const s2=await st();ok(s2.nombre==='JUANI'&&s2.numero==='10','name/number typed');
 await tab('logo');ok(await p.evaluate(()=>document.querySelector('#drop .dt').textContent.includes('Subí el logo de la escuela')),'logo copy says "de la escuela"');
 await p.setInputFiles('#fLogo','site/img/mark.svg');await p.waitForTimeout(800);
 ok(await p.evaluate(()=>!!window.__impronta.state.logoImg),'logo uploaded');
 await tab('talle');await clk('#grp-talle .sizes button[data-v=TL]');ok((await st()).talle==='TL','talle TL');
 const href=await p.getAttribute('#waBtn','href');const msg=decodeURIComponent(href.split('text=')[1]||'');
 ok(href.startsWith('https://wa.me/5492644127431'),'WA link number');ok(/JUANI/.test(msg)&&/TL/.test(msg)&&/Gal/i.test(msg),'WA message contains design summary');ok(/Mangas: #[0-9A-F]{6}/.test(msg)&&/Colores del estampado: 1\) #[0-9A-F]{6}.*2\) #[0-9A-F]{6}.*3\) #F2C230/.test(msg),'WA lists zone hex + 3 print colours');
 ok((await p.textContent('#waBtn')).includes('Pedir presupuesto'),'CTA reads "Pedir presupuesto"');
 // render
 await clk('#renderBtn');await p.waitForFunction(()=>document.querySelectorAll('.rth.has').length===4,null,{timeout:120000});ok(true,'4 renders generated');
 const sizes=await p.evaluate(()=>[...document.querySelectorAll('.rth img')].map(i=>i.naturalWidth+'x'+i.naturalHeight));console.log('   render sizes',sizes.join(' '));
 if(mobile){await p.waitForSelector('#lb.open',{timeout:8000});ok(true,'mobile: lightbox opens automatically after render');await p.keyboard.press('Escape');await p.waitForTimeout(500);ok(!(await p.$('#lb.open')),'lightbox closes (Esc)');ok(await p.evaluate(()=>document.body.classList.contains('dz')),'designer still open after closing lightbox');await p.tap('#closeDz');await p.waitForTimeout(500);ok(await p.evaluate(()=>!document.body.classList.contains('dz')),'X closes designer');}
 else{const [dl]=await Promise.all([p.waitForEvent('download',{timeout:30000}),clk('#dlBtn')]);const fp='/tmp/test_'+name+'.zip';await dl.saveAs(fp);
 const zb=fs.readFileSync(fp);ok(zb.slice(0,2).toString()==='PK'&&zb.length>100000,'zip downloaded '+dl.suggestedFilename()+' '+(zb.length/1024|0)+'KB');
 await p.click('.rth.has >> nth=1');await p.waitForSelector('#lb.open,#lb[open],.lb.open',{timeout:5000});ok(true,'lightbox opens');
 if(!mobile){await p.keyboard.press('ArrowRight');await p.waitForTimeout(300);}
 await p.keyboard.press('Escape');await p.waitForTimeout(500);ok(!(await p.$('#lb.open')),'lightbox closes (Esc)');}
 // gallery preset
 await p.evaluate(()=>document.querySelector('#trabajos').scrollIntoView());await p.waitForTimeout(600);
 await p.click('#filters button[data-f="3d"]');await p.waitForTimeout(600);const vis=await p.$$eval('#grid .card',cs=>cs.filter(c=>c.offsetParent).length);ok(vis>=4,'filter 3D shows '+vis+' cards');
 await p.click('#grid [data-preset=seleccion]');await p.waitForTimeout(2500);const s3=await st();ok(s3.producto==='conjunto'&&s3.preset==='rayas','gallery preset loads into configurator');
 ok(await p.evaluate(()=>{const r=document.querySelector('#configurador .viewer').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}),'designer visible after picking a gallery design');
 if(mobile){ok(await p.evaluate(()=>document.body.classList.contains('dz')),'mobile: gallery design opens full-screen designer');await p.tap('#closeDz');await p.waitForTimeout(500);}
 // menu (mobile)
 if(mobile){await p.click('#menuBtn');await p.waitForTimeout(500);ok(await p.evaluate(()=>document.querySelector('#menu').classList.contains('open')||document.body.classList.contains('menu-open')),'mobile menu opens');await p.keyboard.press('Escape');}
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 ok(errs.length===0,'no console errors'+(errs.length?': '+errs.join(' | '):''));
 await b.close();
}
(async()=>{try{
 await run('desktop',{viewport:{width:1440,height:900}},false);
 await run('mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'},true);
 console.log('ALL PASSED');}catch(e){console.log(e.message);process.exit(1)}})();
