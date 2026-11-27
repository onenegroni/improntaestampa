// Original scalable art for garment printing. Coordinates use a 200 × 200 viewBox.
const paths = new Map();

function draw(g, shape, fill, outline, width = 3) {
  if (!paths.has(shape)) paths.set(shape, new Path2D(shape));
  const path = paths.get(shape);
  if (fill) { g.fillStyle = fill; g.fill(path); }
  if (outline) { g.strokeStyle = outline; g.lineWidth = width; g.stroke(path); }
}

function oval(g, x, y, rx, ry, fill) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

const sparkle = 'M0-12Q2-2 12 0 2 2 0 12-2 2-12 0-2-2 0-12Z';
function sparkles(g, points, tone) {
  for (const [x, y, size] of points) {
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    draw(g, sparkle, tone);
    g.restore();
  }
}

function superhero(g, { ink, a, b, c }) {
  oval(g, 98, 103, 72, 70, c);
  draw(g,'M43 124 18 110l41-15-12 26m97-32 37-28-13 45-24 3',b);
  draw(g,'M91 79Q55 80 43 113c-10 24-15 40-30 49 25 8 56 8 84-13l28-48Z',a,ink);
  draw(g,'M85 91c-5 10-9 21-16 31l-31 18 11 12 43-17 12-17 10 16 28 14 8-15-23-21 5-22Z',ink,ink);
  draw(g,'M38 140l-14 5q-5 3 0 7l19 6 9-8ZM144 133l12 1 15 9q5 4-1 8l-22-1-10-6Z',b,ink);
  draw(g,'M91 90l10-5 22 1 7 18-14 16H90l-6-12Z',a,ink);
  draw(g,'M102 92l-7 11h8l-4 10 15-15h-8l4-6Z',b);
  draw(g,'M91 94 74 110 60 99l8-10 9 6 10-12m33 7 18-9 12-17 12 7-14 25-20 12',a,ink);
  draw(g,'M155 65q-2-7 2-10l5-6 10 5-1 11-10 9m-96 17-8-7q-5-3-7 2l3 12 9 5',b,ink);
  draw(g,'M86 65q0-25 25-28c19-2 34 11 34 28l-5 17c-4 7-15 12-25 12-15 0-28-12-29-29Z',b,ink);
  draw(g,'M86 59q-2-22 17-28l17-2 14 6 10 16-9-4-16 7-9 16-22 2Z',ink,ink);
  draw(g,'M109 66q16-11 35-11v14l-15 1-10 9-12-3Z',ink);
  draw(g,'M117 68q3-4 10-3m7-2 7 0m-21 21q6 3 11-2',null,b,1.7);
  draw(g,'M72 49l-10 12 8 1-5 12 19-17-10-1 5-7Z',a);
  sparkles(g,[[39,62,.55],[156,35,.56],[169,115,.65],[99,160,.55]],b);
}

function dinosaur(g,{ink,a,b,c}) {
  oval(g,101,103,70,69,c);
  draw(g,'M34 147q54-10 134 1m-126 10h104',null,ink,2);
  draw(g,'M36 126 24 113l13 1-5-14 13 3 7-19 11 13 13-20 12 9 8-20 11 8',b,ink,2);
  draw(g,'M27 115q25 15 38-8 12-27 42-29l11-7q-11-14-4-28 9-23 38-19 30 3 28 27-1 18-27 17l-10 1-12 54 8 12q3 8-10 9l-20-2-6-20q-12 10-22 11l-5 11H54l5-12q-22-1-32-17Z',a,ink);
  draw(g,'M146 70q-6 22-26 47-13 16-39 16l19-20 13-28 8-5Z',b);
  draw(g,'M128 85q-5 14-12 17l-7-6m43-35q13 1 19-9',null,ink,2.5);
  oval(g,148,43,4,5,ink);
  oval(g,165,43,2.3,1.8,ink);
  for(const [x,y] of [[69,111],[80,100],[90,95],[82,116],[60,119]]) oval(g,x,y,3,2.2,c);
  draw(g,'M33 151q-14-14-12-26 13 6 14 16 0-21 10-27-1 22-10 37m121-4q10-12 23-13-6 11-19 15',b,ink,2);
  sparkles(g,[[44,57,.58],[70,42,.39],[172,95,.56]],ink);
}

function rocket(g,{ink,a,b,c}) {
  oval(g,101,99,66,68,c);
  draw(g,'M28 133c-19-16 35-62 83-86 55-28 80-31 73-13-8 24-59 63-114 92-38 20-59 20-42 7Z',null,b,3.5);
  draw(g,'M68 108 45 122l10-29 22-15m14 43-12 29 28-15 10-27',a,ink);
  draw(g,'M63 124Q54 157 28 168q22 1 40-13l15-23Z',b,ink,2.4);
  draw(g,'M70 118c8-37 41-69 84-76 1 39-22 73-61 89Z',b,ink);
  draw(g,'M124 51q15-7 30-9l-1 31-14-5Z',a,ink,2.5);
  oval(g,115,86,14,14,ink);
  oval(g,115,86,9,9,a);
  oval(g,112,82,3,2,b);
  draw(g,'M30 144 17 155m40 10-11 12m42-7-8 10',null,b,2.5);
  sparkles(g,[[42,50,.86],[72,39,.44],[92,23,.35],[155,122,.74],[169,151,.55],[131,163,.38]],b);
}

function monsters(g,{ink,a,b,c}) {
  oval(g,101,107,72,64,c);
  draw(g,'M25 135q22 10 56 6m35 7h61',null,ink,2);
  draw(g,'M25 126q-10-26 14-47L35 55q20-4 31 15 15-3 24 8l19-15 1 25q17 18 11 40c-4 23-91 25-96-2Z',a,ink);
  draw(g,'M102 139q-8-18 8-35 4-12 11-18-6-14 2-22 11 4 12 17l12-1 6-22q14 5 13 23l-3 10c18 11 18 40 7 50l-12 5-9-5-9 6-12-5-12 4Z',b,ink);
  for(const [x,y,rx,ry] of [[53,101,11,14],[83,101,11,14],[134,111,10,12],[155,108,7,8]]) {
    oval(g,x,y,rx,ry,'#fff8e9');
    oval(g,x+1,y+1,rx*.43,ry*.44,ink);
  }
  draw(g,'M58 123q11 10 21-1m57 9q6 6 13-2',null,ink,2.8);
  sparkles(g,[[39,41,.34],[92,47,.63],[151,42,.48],[173,89,.32],[78,162,.37]],ink);
}

function graduate(g,{ink,a,b,c}) {
  oval(g,102,100,72,67,c);
  draw(g,'M47 123l7-52 48-21 56 18 3 55q-22 28-60 24-44 1-54-24Z',a,ink);
  draw(g,'M61 108q39 15 81 0l-8 28-31 16-33-16Z',b,ink,2.6);
  draw(g,'M31 69 102 38l72 31-71 30Z',ink);
  draw(g,'M109 67 162 77v28',null,b,2);
  draw(g,'M162 102q-6 4-5 11h10q1-7-5-11Z',b,ink,1.5);
  oval(g,80,113,3.4,4.5,ink); oval(g,121,113,3.4,4.5,ink);
  draw(g,'M93 119q8 9 16-1',null,ink,2.6);
  sparkles(g,[[33,103,.62],[56,42,.48],[149,44,.42],[171,129,.72],[128,165,.34]],b);
}

function rainbow(g,{ink,a,b,c}) {
  oval(g,102,103,71,65,c);
  for(const [i,tone] of [ink,a,b].entries()) {
    const r=61-i*13;
    g.lineWidth=11; g.strokeStyle=tone;
    g.beginPath();g.arc(100,112,r,Math.PI,2*Math.PI);g.stroke();
  }
  draw(g,'M34 125q-9-9 3-16 3-13 17-11 9 1 11 13 17-5 18 8 0 13-44 11m118-26q16-2 19 15 8 6 2 13-22 8-55 1-8-9 0-16 4-9 16-6 8-15 18-7Z',b,ink,2);
  sparkles(g,[[72,48,.44],[121,45,.66],[105,133,.50],[48,140,.42],[151,83,.28]],ink);
}

function constellation(g,{ink,a,b,c}) {
  oval(g,102,103,72,68,c);
  draw(g,'M41 117 65 71l31 32 30-42 29 50-30 34-29-42-24 37Z',null,a,2);
  sparkles(g,[[41,117,.6],[65,71,.73],[96,103,1.16],[126,61,.52],[155,111,.76],[125,145,.48],[72,140,.37]],ink);
  sparkles(g,[[39,53,.40],[108,60,.36],[161,73,.4],[102,153,.25],[158,144,.45]],b);
  for(const [x,y] of [[70,94],[86,55],[142,93],[100,77],[128,118],[53,116],[149,133]]) oval(g,x,y,1.7,1.7,ink);
}

function ringedPlanet(g, {ink, a, b, c}) {
  oval(g,100,103,49,49,c);
  draw(g,'M64 70q35 1 75 24m-82-4q29-3 71 21m-67-3q23 1 48 15',null,a,6);
  g.save();g.translate(100,103);g.rotate(-.37);
  g.beginPath();g.ellipse(0,0,79,22,0,0,Math.PI);g.lineWidth=11;g.strokeStyle=ink;g.stroke();
  g.beginPath();g.ellipse(0,0,79,22,0,0,Math.PI);g.lineWidth=6;g.strokeStyle=b;g.stroke();
  g.restore();
  sparkles(g,[[48,52,.49],[159,57,.44],[150,134,.34]],b);
}
function stardust(g,{ink,a,b,c}) {
  g.save();g.translate(102,100);g.scale(3,3);
  draw(g,sparkle,b,a,1.55);g.restore();
  sparkles(g,[[60,65,.82],[142,68,.56],[143,136,1],[61,126,.49]],c);
  oval(g,84,42,3,3,ink);oval(g,163,112,3.3,3.3,ink);
}

export const illustrations = {
  heroes: superhero, dinosaurios: dinosaur, planetitas: rocket, doodles: monsters,
  egresaditos: graduate, arcoiris: rainbow, estrellas: constellation, orbitas: ringedPlanet, destellos: stardust,
};

export function drawIllustration(g, kind, x, y, size, colors, stretch = 1) {
  g.save();
  g.translate(x,y);
  g.scale(size * stretch / 200,size / 200);
  g.translate(-100,-100);
  g.lineJoin='round';
  g.lineCap='round';
  illustrations[kind](g, colors);
  g.restore();
}
