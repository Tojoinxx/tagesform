// Monats- und Jahresrückblick: Einheiten, bewegte Tonnen, neue Rekorde, Gewichtsverlauf – auf einer Seite
import { useState, useEffect } from 'preact/hooks';
import { useS, S, loadAllDays } from '../lib/store.js';
import { Sheet, Seg } from './common.jsx';
import { workoutLog, e1rm, isSportEntry } from '../lib/training.js';
import { EXERCISES } from '../lib/exercises.js';
import { weightTrend } from '../lib/body.js';
import { daySums, isLogged } from '../lib/nutrition.js';
import { LineChart } from './charts.jsx';
import { todayKey, addDays, n0, n1 } from '../lib/util.js';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-preact';

const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const pad = (n) => String(n).padStart(2, '0');
const kg = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** Zeitraum: Monat (y, m) oder Jahr (y) → [from, to] als Datums-Schlüssel */
function range(mode, y, m) {
  if (mode === 'jahr') return [`${y}-01-01`, `${y}-12-31`];
  const last = new Date(y, m + 1, 0).getDate();
  return [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-${pad(last)}`];
}

export function recapStats(from, to) {
  const log = workoutLog();
  const ws = log.filter((w) => w.date >= from && w.date <= to && (w.items || []).length);
  let tons = 0;
  let sets = 0;
  let minutes = 0;
  const exSets = {};
  for (const w of ws) {
    minutes += Number(w.minutes) || 0;
    for (const it of w.items) {
      for (const s of it.sets || []) {
        if (s.done === false || !(s.r > 0)) continue;
        sets++;
        tons += (Number(s.w) || 0) * s.r;
        exSets[it.exId] = (exSets[it.exId] || 0) + 1;
      }
    }
  }
  // Rekorde: bestes geschätztes Maximum im Zeitraum höher als alles davor
  const before = {};
  const inPer = {};
  for (const w of log) {
    if (w.date > to) continue;
    for (const it of w.items || []) {
      const ex = EXERCISES[it.exId];
      if (!ex || !(ex.inc > 0)) continue;
      for (const s of it.sets || []) {
        if (s.done === false || !(s.w > 0) || !(s.r > 0) || s.r > 15 || s.type === 'drop') continue;
        const v = e1rm(s.w, s.r);
        if (w.date < from) before[it.exId] = Math.max(before[it.exId] || 0, v);
        else if (!inPer[it.exId] || v > inPer[it.exId].v) inPer[it.exId] = { v, w: s.w, r: s.r, date: w.date };
      }
    }
  }
  // ohne frühere Werte (Übung neu in diesem Zeitraum): gegen den ersten Wert im Zeitraum vergleichen
  const firstIn = {};
  for (const w of log.slice().reverse()) {
    if (w.date < from || w.date > to) continue;
    for (const it of w.items || []) {
      if (firstIn[it.exId]) continue;
      const vs = (it.sets || []).filter((s) => s.done !== false && s.w > 0 && s.r > 0 && s.r <= 15 && s.type !== 'drop').map((s) => e1rm(s.w, s.r));
      if (vs.length) firstIn[it.exId] = Math.max(...vs);
    }
  }
  const prs = Object.entries(inPer)
    .map(([id, p]) => ({ id, p, ref: before[id] || firstIn[id] || 0 }))
    .filter(({ p, ref }) => ref && p.v > ref * 1.005)
    .map(({ id, p, ref }) => ({ id, name: EXERCISES[id].name, ...p, gain: p.v - ref }))
    .sort((a, b) => b.gain - a.gain);
  // Vereinssport & sonstiges Training (ohne Gym-Einträge)
  let sport = 0;
  let days = 0;
  let kcal = 0;
  let prot = 0;
  for (let k = from; k <= to && k <= todayKey(); k = addDays(k, 1)) {
    const d = S.days[k];
    if (!d) continue;
    sport += (d.training || []).filter((t) => !t.workoutId && isSportEntry(t)).length;
    if (isLogged(d)) {
      const s = daySums(d);
      days++;
      kcal += s.kcal;
      prot += s.p;
    }
  }
  const trend = weightTrend(800, to).filter((p) => p.k >= from);
  const top = Object.entries(exSets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ id, name: (EXERCISES[id] || {}).name || id, n }));
  return { sessions: ws.length, sport, minutes, sets, tons: tons / 1000, prs, trend, top, days, kcal: days ? kcal / days : 0, p: days ? prot / days : 0 };
}

export function RecapSheet({ mode: mode0 = 'monat' }) {
  useS();
  const now = new Date();
  const [mode, setMode] = useState(mode0);
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [from, to] = range(mode, y, m);
  // Ältere Tage (> 4 Monate) erst bei Bedarf laden
  useEffect(() => {
    if (from < addDays(todayKey(), -110)) loadAllDays();
  }, [from]);
  const st = recapStats(from, to);
  const prev = mode === 'jahr' ? range('jahr', y - 1) : range('monat', m ? y : y - 1, m ? m - 1 : 11);
  const pst = recapStats(prev[0], prev[1]);
  const isNow = mode === 'jahr' ? y === now.getFullYear() : y === now.getFullYear() && m === now.getMonth();
  const step = (d) => {
    if (mode === 'jahr') return setY(y + d);
    const nm = m + d;
    setM((nm + 12) % 12);
    setY(y + Math.floor(nm / 12));
  };
  const title = mode === 'jahr' ? String(y) : `${MON[m]} ${y}`;
  const diff = (a, b, unit = '') => {
    const d = Math.round((a - b) * 10) / 10;
    if (!b) return null; // kein Vergleichswert
    return <small class={d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}>{d > 0 ? '+' : d < 0 ? '−' : '±'}{kg(Math.abs(d))}{unit} zum {mode === 'jahr' ? 'Vorjahr' : 'Vormonat'}</small>;
  };
  // Gewicht: bei Jahr ein Punkt pro Monat (letzter Trendwert), bei Monat die letzten Messungen
  const wpts = (() => {
    if (st.trend.length < 2) return [];
    if (mode === 'monat') return st.trend.slice(-10).map((p) => ({ v: p.t, l: [String(Number(p.k.slice(8))) + '.', MS[Number(p.k.slice(5, 7)) - 1]] }));
    const byM = {};
    st.trend.forEach((p) => (byM[p.k.slice(5, 7)] = p.t));
    return Object.keys(byM)
      .sort()
      .map((mm) => ({ v: byM[mm], l: [MS[Number(mm) - 1], ''] }));
  })();
  const wd = st.trend.length >= 2 ? st.trend[st.trend.length - 1].t - st.trend[0].t : null;
  const empty = !st.sessions && !st.sport && !st.days && st.trend.length < 1;
  return (
    <Sheet title="Rückblick" tall>
      <Seg
        options={[
          { id: 'monat', label: 'Monat' },
          { id: 'jahr', label: 'Jahr' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <div class="recap__nav">
        <button class="iconbtn" onClick={() => step(-1)} aria-label="Zurück">
          <ChevronLeft size={22} />
        </button>
        <h2 class="recap__title">{title}</h2>
        <button class="iconbtn" onClick={() => step(1)} disabled={isNow} aria-label="Weiter">
          <ChevronRight size={22} />
        </button>
      </div>
      {empty ? (
        <p class="muted center">In diesem Zeitraum gibt es noch keine Einträge.</p>
      ) : (
        <>
          <div class="recap__grid">
            <div class="recap__tile recap__tile--big">
              <span>Bewegt</span>
              <b class="tnum">{kg(st.tons)} t</b>
              {diff(st.tons, pst.tons, ' t')}
              <small class="muted">{st.tons >= 1 ? recapCompare(st.tons) : ''}</small>
            </div>
            <div class="recap__tile">
              <span>Gym-Einheiten</span>
              <b class="tnum">{st.sessions}</b>
              {diff(st.sessions, pst.sessions)}
            </div>
            <div class="recap__tile">
              <span>Vereinstraining & Spiele</span>
              <b class="tnum">{st.sport}</b>
            </div>
            <div class="recap__tile">
              <span>Zeit im Gym</span>
              <b class="tnum">{st.minutes >= 120 ? `${kg(st.minutes / 60)} h` : `${st.minutes} Min.`}</b>
            </div>
            <div class="recap__tile">
              <span>Sätze</span>
              <b class="tnum">{n0(st.sets)}</b>
            </div>
          </div>

          <h4 class="sect">
            <Trophy size={16} /> Neue Rekorde ({st.prs.length})
          </h4>
          {st.prs.length ? (
            <ul class="recap__list">
              {st.prs.slice(0, mode === 'jahr' ? 10 : 6).map((p) => (
                <li>
                  <span>{p.name}</span>
                  <b class="tnum">
                    {kg(p.w)} kg × {p.r}
                  </b>
                  <small class="up tnum">+{kg(p.gain)} kg Max.</small>
                </li>
              ))}
            </ul>
          ) : (
            <p class="small muted">Keine neuen Bestwerte in diesem Zeitraum.</p>
          )}

          <h4 class="sect">Gewicht</h4>
          {wpts.length >= 2 ? (
            <>
              <p class="small">
                Trend <b class="tnum">{kg(st.trend[0].t)} → {kg(st.trend[st.trend.length - 1].t)} kg</b> ({wd > 0 ? '+' : wd < 0 ? '−' : '±'}
                {kg(Math.abs(wd))} kg)
              </p>
              <LineChart values={wpts.map((p) => p.v)} labels={wpts.map((p) => p.l)} fmt={kg} h={140} />
            </>
          ) : (
            <p class="small muted">Zu wenige Wiegungen für einen Verlauf.</p>
          )}

          {st.top.length > 0 && (
            <>
              <h4 class="sect">Am meisten trainiert</h4>
              <ul class="recap__list">
                {st.top.map((t) => (
                  <li>
                    <span>{t.name}</span>
                    <b class="tnum">{t.n} Sätze</b>
                  </li>
                ))}
              </ul>
            </>
          )}

          {st.days > 0 && (
            <>
              <h4 class="sect">Ernährung</h4>
              <p class="small">
                An <b>{st.days}</b> Tagen eingetragen · Ø <b class="tnum">{n0(st.kcal)} kcal</b> und <b class="tnum">{n0(st.p)} g Eiweiß</b> pro Tag
              </p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Greifbarer Vergleich für die bewegte Masse */
function recapCompare(t) {
  if (t >= 150) return `≈ ${n0(t / 150)} Blauwal${t / 150 >= 2 ? 'e' : ''}`;
  if (t >= 6) return `≈ ${n1(t / 6)} Elefant${t / 6 >= 1.5 ? 'en' : ''}`;
  return `≈ ${n0(t / 1.5)} Autos`;
}
