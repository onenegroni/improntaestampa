import materials from '../data/materials.json';

export const SIZES = ['T4', 'T6', 'T8', 'T10', 'T12', 'T14', 'T16', 'S', 'M', 'L', 'XL', 'XXL'];
export const GRADUATION = ['inicial','primaria','secundaria'];
export const ALL_OVER = 'sublimacion';
export const LOCAL_DTF = 'dtf';
export const CONSULT = 'consulta';
export const TECHNIQUES = {
  sublimacion: { label: 'Sublimación integral', description: 'Personalizá el color y el diseño de los paneles de tela.' },
  frente: { label: 'Sublimación en el frente', description: 'La gráfica se imprime en el frente. Los tonos de la visera y la malla se confirman al consultar.' },
  dtf: { label: 'DTF localizado', description: 'Direct to Film para logos y gráficas localizadas en el pecho o la espalda de la remera de algodón.' },
  consulta: { label: 'Personalización a confirmar', description: 'Elegí la tela y consultanos qué técnica y tonos podemos ofrecerte.' },
};

export const MATERIALS = materials;

const front = ['pecho-izq','pecho-centro','pecho-der'];
const back = ['espalda-alta','espalda-centro','espalda-baja'];
const sleeves = ['manga-izq','manga-der'];
const garment = { status:'disponible', sizes:SIZES, fields:['nombre','numero','espalda','escuela','frase','logo'], regions:[...front,...back,...sleeves], frase:'' };
const sportsZones = { cuerpo:'Cuerpo', mangas:'Mangas', punos:'Cuello y puños' };
export const PRODUCTS = {
  remera: { ...garment, label:'Remera', crumb:'Remera personalizada', category:'egresados', segments:[...GRADUATION,'deportivos','empresas'], defaultSegment:'primaria', telas:['deportiva','modal','algodon'], zones:sportsZones, model:'tee', atlas:['torso','sleeve'], image:'img/studio-shoulder-poster.webp', description:'Remera personalizable para egresados, equipos y marcas.', frase:'Más que una remera, un recuerdo para siempre' },
  campera: { ...garment, label:'Campera', crumb:'Campera con capucha', category:'egresados', segments:[...GRADUATION,'empresas'], defaultSegment:'primaria', telas:['frizado','frisa'], zones:{cuerpo:'Cuerpo',mangas:'Mangas raglán',capucha:'Capucha',punos:'Puños y cintura'}, regions:['pecho-izq','pecho-der',...back,...sleeves], model:'hoodie', atlas:['torso','sleeve','hood'], image:'img/catalog-egresados.webp', description:'Campera raglán con cierre y capucha.', frase:'Más que una campera, un recuerdo para siempre' },
  conjunto: { ...garment, label:'Conjunto deportivo', crumb:'Conjunto deportivo', category:'deportivos', segments:['deportivos'], defaultSegment:'deportivos', telas:['deportiva'], zones:{cuerpo:'Remera',short:'Short',mangas:'Mangas',punos:'Cuello y cintura'}, model:'kit', atlas:['torso','sleeve','short','shortPlain'], image:'img/catalog-deportivos.webp', description:'Remera deportiva y short coordinados.' },
  musculosa: { ...garment, label:'Musculosa', crumb:'Musculosa', category:'deportivos', segments:['deportivos'], defaultSegment:'deportivos', telas:['deportiva','modal'], zones:{cuerpo:'Cuerpo',punos:'Vivos'}, regions:[...front,...back], model:'tank', atlas:['torso'], image:'img/preset-zumba.webp', description:'Musculosa personalizable para actividad deportiva.' },
  short: { ...garment, label:'Short', crumb:'Short deportivo', category:'deportivos', segments:['deportivos'], defaultSegment:'deportivos', telas:['deportiva'], zones:{short:'Short',punos:'Cintura'}, fields:['numero'], regions:['pierna'], model:'shorts', atlas:['short','shortPlain'], image:'img/trabajos/deportivo-estrella-680.webp', description:'Short deportivo con número opcional.' },
  bandera: { ...garment, label:'Bandera', crumb:'Bandera', category:'accesorios', segments:['accesorios'], defaultSegment:'accesorios', telas:[], fixed:'Poliéster sublimable', technique:ALL_OVER, zones:{cuerpo:'Fondo'}, fields:['espalda','escuela','logo'], regions:['frente'], sizes:['90×60 cm','150×90 cm','200×100 cm'], model:'flag', atlas:['flag'], image:'img/catalog-banderas.webp', description:'Bandera personalizada para promociones, clubes y eventos.' },
  gorra: { ...garment, label:'Gorra', crumb:'Gorra trucker de cinco gajos', category:'accesorios', segments:['accesorios'], defaultSegment:'accesorios', telas:[], fixed:'Frente sublimado y malla', technique:'frente', zones:{cuerpo:'Frente',mangas:'Visera',malla:'Malla',punos:'Botón y vivos'}, fields:['nombre','espalda','logo'], regions:['frente'], sizes:['Infantil ajustable','Adulto ajustable'], model:'cap', atlas:['cap','visor'], image:'img/catalog-gorras.webp', description:'Gorra de cinco gajos. Consultá opciones y colores.' },
};
export const ENQUIRY_PRODUCTS = {
  chomba: { category:'uniformes', label:'Chomba escolar', status:'consulta', model:null },
  educacionFisica: { category:'uniformes', label:'Remera de educación física', status:'consulta', model:null },
  taza: { category:'accesorios', label:'Taza personalizada', status:'consulta', model:null },
};

const dtfFields = ['nombre','numero','espalda','logo'];
export function optionsFor(state) {
  const product = PRODUCTS[state.producto];
  const segment = product.segments.includes(state.segmento) ? state.segmento : product.defaultSegment;
  const materials = product.telas.filter(key => {
    const material = MATERIALS[key];
    return material.status === 'disponible' && (!material.segments || material.segments.includes(segment));
  });
  const materialId = materials.includes(state.tela) ? state.tela : materials[0];
  const material = MATERIALS[materialId];
  const technique = material?.technique || product.technique;
  const zones = technique === LOCAL_DTF ? { cuerpo:'Prenda' } : product.zones;
  const fields = technique === LOCAL_DTF ? dtfFields : technique === CONSULT ? [] : product.fields;
  const regions = technique === LOCAL_DTF ? [...front,...back] : technique === CONSULT ? [] : product.regions;
  return { product, segment, materials, materialId, material, technique, zones, fields, regions,
    patterns: technique === ALL_OVER || technique === 'frente' };
}

export function compatiblePrint(state) {
  const options = optionsFor(state);
  if (options.patterns) return state;
  const { technique, material } = options;
  // Legacy designs remain recoverable when returning to the original material.
  const plain = { ...state, preset:'liso', printAll:false, hideAutoMark:true, escuela:'', frase:'' };
  if (technique === CONSULT) return { ...plain, nombre:'', numero:'', espalda:'', logoImg:null };
  const base = material.previewColors.includes(state.colors.cuerpo) ? state.colors.cuerpo : material.previewColors[0];
  return { ...plain, colors:{ ...state.colors, cuerpo:base, mangas:base, punos:base } };
}
