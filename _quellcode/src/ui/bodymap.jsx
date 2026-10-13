// Körpermodell (vorne & hinten) mit einzeln ansprechbaren Muskelgruppen.
// Muskelgruppen wie in der Volumen-Zählung: brust, ruecken, schulter, bizeps, trizeps, quad, beinbeuger, po, adduktoren, waden, rumpf
// Formen: rechte Körperhälfte als Punktliste (x = Abstand zur Mitte), gespiegelt und mit Catmull-Rom-Kurven geglättet.
import { MUSCLE_LABEL } from '../lib/training.js';

const CX = 80;

// Breiten-Faktor für die weibliche Figur je Höhe: schmalere Schultern & Taille, breitere Hüfte
const KW = [
  [0, 0.92],
  [60, 0.87],
  [100, 0.86],
  [150, 0.8],
  [182, 1.08],
  [215, 1.05],
  [262, 0.97],
  [360, 0.93],
];
const kAt = (y) => {
  for (let i = 1; i < KW.length; i++) {
    if (y <= KW[i][0]) {
      const [y0, k0] = KW[i - 1];
      const [y1, k1] = KW[i];
      return k0 + ((y - y0) / (y1 - y0)) * (k1 - k0);
    }
  }
  return KW[KW.length - 1][1];
};
// Punkt [x, y, arm?] → absolute Koordinaten; Arme werden bei Frauen einheitlich schmaler
const tx = (female, side) => ([x, y, arm]) => [CX + side * x * (female ? (arm ? 0.87 : kAt(y)) : 1), y];

/** geschlossene Catmull-Rom-Kurve durch Punkte */
function smooth(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// Körperumriss rechte Hälfte, vom Hals nach unten bis zum Schritt
const OUTLINE = [
  [7, 36], [8, 49], [20, 55], [34, 60], [43, 70, 1], [45, 92, 1], [46, 124, 1], [49, 146, 1], [48, 174, 1], [50, 188, 1], [46, 199, 1], [41, 193, 1], [40, 175, 1], [38, 150, 1], [36, 128, 1], [35, 106, 1], [31, 92],
  [31, 104], [24, 148], [28, 176], [29, 204], [22, 262], [24, 286], [19, 316], [15, 336], [18, 347], [12, 352], [6, 350], [7, 336], [8, 292], [6, 262], [4, 226], [1, 205],
];
function bodyPath(female) {
  const r = OUTLINE.map(tx(female, 1));
  const l = OUTLINE.map(tx(female, -1)).reverse();
  return smooth([...r, ...l]);
}

// Muskeln: [Gruppe, Punkte rechts] (werden gespiegelt). 'mid' = über die Mitte (nicht spiegeln)
const FRONT = [
  ['schulter', [[31, 58, 1], [40, 61, 1], [45, 72, 1], [44, 88, 1], [38, 86, 1], [33, 72, 1]]],
  ['brust', [[2, 62], [15, 57], [30, 61], [34, 74], [29, 89], [15, 94], [2, 90]]],
  ['bizeps', [[35, 92, 1], [41, 92, 1], [44, 106, 1], [42, 122, 1], [37, 124, 1], [35.5, 108, 1]]],
  ['rumpf', [[15, 100], [24, 104], [25, 138], [21, 162], [15, 152], [14, 124]]],
  ['quad', [[9, 204], [24, 190], [29, 212], [27, 238], [20, 258], [12, 254], [9, 230]]],
  ['adduktoren', [[2, 206], [7, 204], [9, 224], [5, 236], [3, 222]]],
  ['waden', [[17, 272], [22, 282], [21, 304], [16, 312], [14, 292]]],
];
const ABS = [[98, 112], [114, 128], [130, 144], [146, 164]];
const BACK = [
  ['ruecken', [[0, 47], [8, 48], [24, 56], [14, 66], [4, 96], [0, 101]]],
  ['schulter', [[31, 58, 1], [40, 61, 1], [45, 72, 1], [44, 88, 1], [38, 86, 1], [33, 72, 1]]],
  ['ruecken', [[6, 72], [18, 66], [31, 90], [30, 112], [24, 140], [10, 146], [6, 110]]],
  ['ruecken', [[1, 142], [9, 140], [10, 172], [1, 174]]],
  ['trizeps', [[35, 90, 1], [42, 90, 1], [45, 106, 1], [42, 124, 1], [37, 122, 1], [35.5, 106, 1]]],
  ['po', [[1, 177], [16, 171], [28, 181], [29, 197], [20, 209], [6, 207], [1, 197]]],
  ['beinbeuger', [[7, 213], [20, 211], [27, 225], [24, 249], [16, 258], [10, 250], [7, 231]]],
  ['waden', [[9, 272], [19, 268], [24, 286], [20, 306], [14, 312], [10, 300], [8, 284]]],
];

function Hair({ female, back }) {
  if (female)
    return back ? (
      <path class="bm__hair" d={`M${CX - 13},20 Q${CX - 14},3 ${CX},4 Q${CX + 14},3 ${CX + 13},20 Q${CX + 14},40 ${CX + 9},50 Q${CX},53 ${CX - 9},50 Q${CX - 14},40 ${CX - 13},20 Z`} />
    ) : (
      <path class="bm__hair" d={`M${CX - 13},24 Q${CX - 14},3 ${CX},4 Q${CX + 14},3 ${CX + 13},24 Q${CX + 14},42 ${CX + 11},48 Q${CX + 10},28 ${CX + 6},15 Q${CX},19 ${CX - 6},15 Q${CX - 10},28 ${CX - 11},48 Q${CX - 14},42 ${CX - 13},24 Z`} />
    );
  return <path class="bm__hair" d={back ? `M${CX - 13},22 Q${CX - 13.5},5 ${CX},5 Q${CX + 13.5},5 ${CX + 13},22 Q${CX + 11},32 ${CX},33 Q${CX - 11},32 ${CX - 13},22 Z` : `M${CX - 13},19 Q${CX - 12.5},5 ${CX},5 Q${CX + 12.5},5 ${CX + 13},19 Q${CX + 7},11 ${CX},12 Q${CX - 7},11 ${CX - 13},19 Z`} />;
}

/**
 * sex: 'm' | 'w'; primary/secondary: Muskelgruppen hervorheben; sore: { gruppe: 'leicht'|'stark' };
 * pulse: Gruppen, die blinken; onTap(gruppe) macht die Muskeln antippbar
 */
export function BodyMap({ sex = 'm', primary = [], secondary = [], sore = {}, pulse = [], onTap, size = 'md', labels = true }) {
  const female = sex === 'w';
  const clsOf = (mg) => {
    let c = 'bm__m';
    if (sore[mg] === 'stark') c += ' bm__m--sore2';
    else if (sore[mg] === 'leicht') c += ' bm__m--sore1';
    else if (primary.includes(mg)) c += ' bm__m--pri';
    else if (secondary.includes(mg)) c += ' bm__m--sec';
    if (pulse.includes(mg)) c += ' bm__m--pulse';
    if (onTap) c += ' bm__m--tap';
    return c;
  };
  const shape = (mg, pts, key) => [1, -1].map((side) => (
    <path key={key + side} d={smooth(pts.map(tx(female, side)))} class={clsOf(mg)} onClick={onTap ? () => onTap(mg) : undefined}>
      <title>{MUSCLE_LABEL[mg]}</title>
    </path>
  ));
  const view = (back) => (
    <figure class="bm__fig">
      <svg viewBox="0 0 160 358" class="bm__svg" role="img" aria-label={`Körpermodell ${back ? 'hinten' : 'vorne'}`}>
        <path class="bm__body" d={bodyPath(female)} />
        <ellipse class="bm__body" cx={CX} cy={22} rx={female ? 12 : 13} ry={16} />
        <Hair female={female} back={back} />
        {(back ? BACK : FRONT).map(([mg, pts], i) => shape(mg, pts, 'm' + i))}
        {!back &&
          ABS.map(([y0, y1], i) =>
            [1, -1].map((side) => {
              const k = female ? kAt((y0 + y1) / 2) : 1;
              const w = 10.5 * k;
              const x = side > 0 ? CX + 1.2 : CX - 1.2 - w;
              return (
                <rect key={'a' + i + side} x={x} y={y0} width={w} height={y1 - y0 - 1.5} rx={3.5} class={clsOf('rumpf')} onClick={onTap ? () => onTap('rumpf') : undefined}>
                  <title>{MUSCLE_LABEL.rumpf}</title>
                </rect>
              );
            }),
          )}
      </svg>
      {labels && <figcaption>{back ? 'Hinten' : 'Vorne'}</figcaption>}
    </figure>
  );
  return (
    <div class={`bm bm--${size}`}>
      {view(false)}
      {view(true)}
    </div>
  );
}

/** Muskelgruppen einer Übungsliste: primär (voll) und sekundär (halb) */
export function musclesOf(ids, mgOf) {
  const pri = new Set();
  const sec = new Set();
  ids.forEach((id) => {
    const [a, b] = mgOf(id).split('|');
    (a || '').split(',').filter(Boolean).forEach((m) => pri.add(m));
    (b || '').split(',').filter(Boolean).forEach((m) => sec.add(m));
  });
  return { primary: [...pri], secondary: [...sec].filter((m) => !pri.has(m)) };
}
