import { ALL_OVER, LOCAL_DTF, optionsFor } from './product-data.js';

export const PATTERNS = {
  liso:['Liso','p-lis'], tricolor:['Tricolor','p-tri'], splash:['Splash','p-spl'], degrade:['Degradé','p-deg'], rayas:['Rayas','p-ray'],
  galactico:['Galáctico','p-gal'], tiedye:['Tie-dye','p-tie'], manitos:['Manitos','p-man'], camuflaje:['Camuflaje','p-cam'],
  geometrico:['Geométrico','p-geo'], diagonal:['Rayas diagonales','p-dia'],
  dinosaurios:['Dinosaurios','p-mot'], planetitas:['Planetitas','p-mot'], estrellas:['Estrellitas','p-mot'],
  heroes:['Héroes originales','p-mot'], doodles:['Doodles','p-mot'], arcoiris:['Arcoíris','p-mot'], egresaditos:['Egresaditos','p-mot'],
};
export const TRICOLOR_BANDS = [
  ['acento', 'Superior', 0, .47],
  ['acento2', 'Central', .47, .64],
  ['acento3', 'Inferior', .64, 1],
];
export const MOTIF_SIZES = { chico: 'Chico', mediano: 'Mediano', grande: 'Grande' };
export const hasMotifSizes = preset => PATTERNS[preset][1] === 'p-mot' || preset === 'manitos';

export const PLACEMENTS = {
  'pecho-izq':'Pecho izquierdo', 'pecho-centro':'Centro de pecho', 'pecho-der':'Pecho derecho',
  'espalda-alta':'Espalda alta', 'espalda-centro':'Centro de espalda', 'espalda-baja':'Espalda baja',
  'manga-izq':'Manga izquierda', 'manga-der':'Manga derecha',
};
export const TYPEFACES = { condensada:'Condensada', college:'College', varsity:'Varsity', moderna:'Moderna' };
export const ARTWORK = { ninguno:'Sin gráfica', laureles:'Laureles', corona:'Corona', sol:'Sol', estrellas:'Estrellas', escudo:'Escudo original' };
export const PERSONALIZATION = {
  nombreLugar:['Ubicación del nombre','pecho-der'], numeroLugar:['Ubicación del número','espalda-centro'],
  espaldaLugar:['Ubicación del texto principal','espalda-baja'], logoLugar:['Ubicación del logo o gráfica','pecho-izq'],
  arteLugar:['Ubicación del motivo','espalda-centro'],
};
export function placementChoices(options, field) {
  const acceptsSleeves = ['nombreLugar','numeroLugar','arteLugar'].includes(field);
  return options.regions.filter(place=>PLACEMENTS[place] && (acceptsSleeves || !place.startsWith('manga')));
}

const graduation = ['remera','campera'];
const sports = ['conjunto','remera','musculosa','short'];
const groups = {
  inicial:{ products:graduation, thumb:'remera', title:'EGRESADITOS', name:'SOL' },
  primaria:{ products:graduation, thumb:'remera', title:'EGRESADOS', name:'ÁLEX' },
  secundaria:{ products:graduation, thumb:'campera', title:'PROMOCIÓN', name:'FRAN' },
  deportivos:{ products:sports, thumb:'conjunto', title:'MI EQUIPO', name:'ÁLEX' },
  empresas:{ products:['remera','campera'], thumb:'remera', title:'', name:'' },
  accesorios:{ products:['gorra'], thumb:'gorra', title:'PROMO 26', name:'' },
};

function design(segment, id, label, preset, palette, config = {}) {
  const { products, thumb, title, name } = groups[segment];
  const [cuerpo, acento, acento2, acento3, mangas = cuerpo, punos = '#141414'] = palette;
  const sampleText = segment === 'empresas' ? '' : '26';
  const { motif = 'ninguno', type = 'condensada', photoModel = thumb, techniques = [ALL_OVER],
    places = {}, sleeveBands = preset !== 'liso', variants = products, lowerText = title, sample = name } = config;
  return {
    id,label,segment,products:variants,techniques,photoModel,
    design:{preset,printAll:sleeveBands, colors:{cuerpo,acento,acento2,acento3,mangas,punos,capucha:mangas},
      nombre:sample,numero:sampleText,espalda:lowerText,escuela:'',frase:'',tipografia:type,arte:motif,
      nombreLugar:'pecho-der',numeroLugar:'espalda-centro',espaldaLugar:'espalda-baja',logoLugar:'pecho-izq',arteLugar:'espalda-centro',...places},
  };
}

const blue = ['#10305c','#65b8e5','#f8f5ed','#1a3a5e'];
const coral = ['#192239','#f58c94','#1f71ad','#172038','#df667b'];
const bordeaux = ['#222135','#8c2250','#f7eee5','#222135','#8c2250'];
const paletteCloud = ['#e1edf7','#3876b4','#f6bd60','#18325a'];
const business = [ALL_OVER,LOCAL_DTF];
export const DESIGN_LIBRARY = [
  design('inicial','dino','Dinosaurios','dinosaurios',['#e5e8ce','#528273','#f6cf76','#d8dbab'],{sleeveBands:false}),
  design('inicial','espacio','Planetitas y espacio','planetitas',['#202747','#db795c','#f7d6a0','#7180b9'],{sleeveBands:false}),
  design('inicial','estrellitas','Estrellitas','estrellas',['#244268','#699db4','#efe0ac','#9cb7c7'],{sleeveBands:false}),
  design('inicial','manitos','Manitos','manitos',['#58b8ec','#e8432a','#f2c230','#7a3fb4'],{photoModel:'campera'}),
  design('inicial','heroes','Superhéroes originales','heroes',['#1a324c','#db5e49','#ffe1a7','#8eb0c0','#243e59','#192b3a'],{sleeveBands:false, type:'moderna'}),
  design('inicial','monstruitos','Doodles y monstruitos','doodles',['#d5e4d8','#719e84','#eda879','#efdbac'],{sleeveBands:false}),
  design('inicial','arcoiris','Arcoíris','arcoiris',['#f3e0d6','#be6a73','#f0c781','#d6b6bb'],{sleeveBands:false}),
  design('inicial','primer-grado','Egresaditos ilustrados','egresaditos',paletteCloud,{lowerText:'PRIMER GRADO',sleeveBands:false}),

  design('primaria','tricolor','Tricolor','tricolor',coral,{photoModel:'campera', motif:'laureles',type:'varsity'}),
  design('primaria','galactico','Galáctico','galactico',['#11122c','#71c5f0','#8c63e5','#3142bd'],{photoModel:'campera'}),
  design('primaria','degrade','Degradé','degrade',['#2a192f','#9e2071','#ff7ba0','#2c1b55']),
  design('primaria','argentina','Argentina','tricolor',blue,{photoModel:'campera',motif:'sol',type:'college'}),
  design('primaria','splash','Splash','splash',['#1d2429','#c02e49','#f4ece1','#74213d']),
  design('primaria','geometrico','Geométrico','geometrico',['#1d3452','#1b897d','#f2c979','#3a4662']),
  design('primaria','tie-dye','Tie-dye','tiedye',['#3275df','#f06845','#f4be49','#754bc0']),
  design('primaria','camuflaje','Camuflaje','camuflaje',['#2d3744','#739b9c','#c8d5c9','#263247']),
  design('primaria','rayas','Rayas','rayas',blue),
  design('primaria','doodles','Doodles','doodles',['#bbe1e8','#628da8','#e8bb67','#a5c7cf'],{sleeveBands:false}),

  design('secundaria','college','College','liso',['#243855','#a23e57','#e9d6ad','#f5eee3'],{motif:'laureles',type:'college'}),
  design('secundaria','varsity','Varsity','tricolor',bordeaux,{motif:'corona',type:'varsity'}),
  design('secundaria','minimo','Minimalista','liso',['#e9e6dd','#22252b','#d6ccbf','#22252b'],{type:'moderna'}),
  design('secundaria','tricolor-noche','Tricolor noche','tricolor',['#202631','#273958','#9fc6d1','#191b25'],{type:'moderna'}),
  design('secundaria','angular','Geométrico','geometrico',['#22222f','#777393','#e5c4cc','#30364c'],{type:'moderna'}),
  design('secundaria','mono','Monocromático','liso',['#17191c','#a2a2a2','#e4e1da','#32353c']),
  design('secundaria','tipografia','Identidad tipográfica','liso',['#621e43','#e0a389','#f6e9db','#242440'],{type:'college',places:{espaldaLugar:'espalda-alta'}}),

  design('deportivos','verticales','Rayas verticales','rayas',blue),
  design('deportivos','diagonales','Rayas diagonales','diagonal',['#17253f','#d13c48','#f5d7b0','#562634']),
  design('deportivos','tricolor-deportivo','Tricolor deportivo','tricolor',['#242d37','#224a61','#7ce0bc','#202537']),
  design('deportivos','clasico','Deportivo clásico','liso',['#6a243a','#f2cfa3','#faf0de','#422037'],{type:'varsity'}),
  design('deportivos','geometria-equipo','Geométrico de equipo','geometrico',['#21233b','#4b559e','#84d5e1','#35336a']),
  design('deportivos','argentina-equipo','Argentina deportiva','rayas',['#e8edf5','#7ecfed','#fffaf0','#233c72'],{motif:'estrellas'}),
  design('deportivos','degrade-equipo','Degradé deportivo','degrade',['#251a3d','#5c3dc2','#89c8f6','#1b244e']),

  design('empresas','logo-empresa','Logo de empresa','liso',['#141414','#cb403b','#f2efe9','#141414'],{techniques:business,motif:'escudo',places:{arteLugar:'pecho-izq',logoLugar:'pecho-der'},sample:'TU MARCA'}),
  design('empresas','marca-minimal','Marca minimalista','liso',['#f2efe9','#20232c','#f2efe9','#31353b'],{techniques:business,type:'moderna',sample:'TU MARCA',places:{nombreLugar:'pecho-centro'}}),
  design('empresas','identidad','Identidad de marca','liso',['#141414','#e7b196','#ece8df','#192323'],{techniques:business,type:'college',lowerText:'TU IDENTIDAD',places:{espaldaLugar:'espalda-centro'}}),
  design('empresas','marca-mono','Marca monocromática','liso',['#141414','#e6e6e6','#e6e6e6','#222222'],{techniques:business,type:'moderna',sample:'TU MARCA'}),
  design('empresas','marca-bloques','Bloques de marca','tricolor',['#303a41','#243c47','#bacfbf','#302841'],{type:'moderna',sample:'TU MARCA'}),

  design('accesorios','gorra-promo','Gorra de la promo','liso',['#f5f1ee','#89364e','#f4e8e1','#28232d','#211d26'],{techniques:['frente'],type:'varsity'}),
  design('accesorios','gorra-equipo','Gorra de equipo','diagonal',blue,{techniques:['frente'],lowerText:'MI EQUIPO'}),
];

export function availableTemplates(state) {
  const { segment,technique } = optionsFor(state);
  return DESIGN_LIBRARY.filter(template => template.segment === segment && template.products.includes(state.producto)
    && template.techniques.includes(technique));
}
