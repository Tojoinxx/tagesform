// Liniendiagramm im MCI-Stil: Punkte mit Werten darüber, Datum darunter
import { n1 } from '../lib/util.js';

const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** „2026-08-02“ → ['2.', 'Aug'] bzw. mit Wochentag ['Mo', '2'] */
export const dateLbl = (k, weekday = false) => {
  const d = new Date(k + 'T12:00:00');
  return weekday ? [WD[d.getDay()], String(d.getDate())] : [d.getDate() + '.', MON[d.getMonth()]];
};

/**
 * values: Zahlen, labels: [[Zeile1, Zeile2], …], fmt: Wert-Format, tone: 'acc' | 'up' | 'down'
 */
export function LineChart({ values, labels = [], fmt = n1, h = 150, tone = 'acc', ariaLabel, raw = null }) {
  const n = values.length;
  if (n < 1) return null;
  const W = 340;
  const pad = { l: 22, r: 22, t: 28, b: 56 };
  const all = raw ? [...values, ...raw.filter((v) => v != null)] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i) => (n === 1 ? W / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => (max === min ? pad.t + (h - pad.t - pad.b) / 2 : pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b));
  // Wert unter den Punkt, wenn die Linie von oben kommt (sonst überdeckt sie die Zahl)
  // Viele Punkte: nur Start, Ende, höchsten & tiefsten Wert beschriften, Datum jeden 2. Punkt
  const many = n > 7;
  const iMax = values.indexOf(max);
  const iMin = values.indexOf(Math.min(...values));
  const showVal = (i) => !many || i === 0 || i === n - 1 || i === iMax || i === iMin;
  const showLbl = (i) => !many || i === n - 1 || (n - 1 - i) % 2 === 0;
  const below = (i) => i > 0 && values[i - 1] > values[i] && (i === n - 1 || values[i + 1] >= values[i]);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg class={`lchart lchart--${tone}`} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={ariaLabel || `Verlauf: ${values.map(fmt).join(', ')}`}>
      <path d={`${d} L${x(n - 1)},${h - pad.b + 4} L${x(0)},${h - pad.b + 4} Z`} class="lchart__area" />
      <path d={d} class="lchart__line" />
      {raw && raw.map((v, i) => (v == null ? null : <circle cx={x(i)} cy={y(v)} r="2.6" class="lchart__raw" />))}
      {values.map((v, i) => (
        <g>
          <circle cx={x(i)} cy={y(v)} r="4.5" class="lchart__dot" />
          {showVal(i) && (
            <text x={x(i)} y={below(i) ? y(v) + 20 : y(v) - 10} class="lchart__val" text-anchor="middle">
              {fmt(v)}
            </text>
          )}
          {labels[i] && showLbl(i) && (
            <text x={x(i)} y={h - 20} class="lchart__lbl" text-anchor="middle">
              <tspan x={x(i)}>{labels[i][0]}</tspan>
              <tspan x={x(i)} dy="14">
                {labels[i][1]}
              </tspan>
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
