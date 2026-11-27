// Run against the built site. BASE defaults to http://127.0.0.1:8080/.
// Set IDS to a comma-separated template list to regenerate a subset.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const args = process.env.SOFTWARE_GL ? ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({channel:'chrome',args});
  const dest = path.resolve(__dirname,'../site/img/plantillas');
  await fs.mkdir(dest,{recursive:true});
  try {
    const page = await browser.newPage({viewport:{width:1120,height:840},reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.BASE || 'http://127.0.0.1:8080/');
    await page.locator('#cfg').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>window.__impronta?.api,null,{timeout:45000});
    const templates = await page.evaluate(()=>window.__impronta.templates.flatMap(({id,photoModel,products,segment})=>
      products.map(product=>({id,product,segment,suffix:product===photoModel?'':'-'+product}))));
    const only = process.env.IDS?.split(',');
    for (const {id,product,segment,suffix} of templates) {
      if (only && !only.includes(id)) continue;
      const image = await page.evaluate(async ({id,product,segment})=>{
        const {state,api,sync,applyTemplate}=window.__impronta;
        const oldProduct=state.producto;
        const tela=product==='campera' ? 'frizado' : segment==='empresas' && id!=='marca-bloques' ? 'algodon' : 'deportiva';
        Object.assign(state,{producto:product,segmento:segment,tela,plantilla:'',nombre:'',numero:'',espalda:'',escuela:'',frase:'',mangaIzq:'',mangaDer:''});
        sync();
        if (!applyTemplate(id)) throw new Error(`Template unavailable for ${product}: ${id}`);
        if (oldProduct!==product) api.rebuild();
        const back=['college','varsity','tipografia','identidad','argentina','tricolor'].includes(id);
        const [shot]=await api.renderSet({w:360,h:352,zoom:1.07,thumbnail:true,
          angles:[['thumbnail',back ? Math.PI-.29 : -.32]],pitch:product==='gorra' ? .20 : .105});
        const source=new Image();
        source.src=shot.url;
        await source.decode();
        const canvas=document.createElement('canvas');
        canvas.width=300;
        canvas.height=294;
        const context=canvas.getContext('2d');
        context.imageSmoothingQuality='high';
        context.drawImage(source,0,0,canvas.width,canvas.height);
        return canvas.toDataURL('image/webp',.87);
      },{id,product,segment});
      assert.match(image,/^data:image\/webp;base64,/);
      const output=id+suffix+'.webp';
      await fs.writeFile(path.join(dest,output),Buffer.from(image.split(',')[1],'base64'));
      console.log(output);
    }
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
