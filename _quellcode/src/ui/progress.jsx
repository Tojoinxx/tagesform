import { useS, S, closeSheet, saveTraining, toast } from '../lib/store.js';
import { exHistory, progressStats, recommend, setupOf, sessionOf, buildSession, isAwaySession, e1rm } from '../lib/training.js';
import { EXERCISES } from '../lib/exercises.js';
import { fmtShortDate, n1, n0, isoWeek, todayKey } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { Trophy, TrendingUp, Timer, Layers, Dumbbell, ChevronRight, Play, Flame } from 'lucide-preact';
import { nav } from './router.js';
import { estMinutes } from './exui.jsx';

const kg = (v) => `${n1(v)} kg`;
const signed = (v, unit) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n1(Math.abs(v))}${unit}`;

/** Kleines Liniendiagramm (SVG), z. B. Kraftverlauf einer Übung */
export function Spark({ values, labels = [], unit = '', h = 96 }) {
  if (values.length < 2) return null;
  const W = 300;
  const pad = { l: 6, r: 6, t: 14, b: 16 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad.l + (i / (values.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg class="spark" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Verlauf von ${n1(values[0])} auf ${n1(values[last])}${unit}`}>
      <path d={`${d} L${x(last)},${h - pad.b} L${x(0)},${h - pad.b} Z`} class="spark__area" />
      <path d={d} class="spark__line" />
      {values.map((v, i) => (
        <circle cx={x(i)} cy={y(v)} r={i === last ? 3.6 : 2.2} class={i === last ? 'spark__dot spark__dot--last' : 'spark__dot'} />
      ))}
      <text x={x(0)} y={h - 3} class="spark__lbl">
        {labels[0] || ''}
      </text>
      <text x={x(last)} y={h - 3} class="spark__lbl" text-anchor="end">
        {labels[last] || ''}
      </text>
      <text x={x(last)} y={Math.max(10, y(values[last]) - 6)} class="spark__val" text-anchor="end">
        {n1(values[last])}
        {unit}
      </text>
    </svg>
  );
}

/** Verlauf einer Übung: Kraft-Kurve + letzte Einheiten + Bestleistung */
export function ExHistory({ exId }) {
  const ex = EXERCISES[exId];
  const h = exHistory(exId, 30);
  if (!h.length) return <p class="small muted">Noch keine Einheiten mit dieser Übung – nach dem ersten Training siehst du hier deinen Verlauf.</p>;
  const weighted = h.some((x) => x.topW > 0);
  const chron = h.slice().reverse();
  const vals = chron.map((x) => (weighted ? Math.round(x.best * 10) / 10 : Math.max(...x.sets.map((s) => s.r))));
  const best = h.reduce((a, x) => (x.best > a.best ? x : a), h[0]);
  const bestSet = best.sets.reduce((a, s) => (e1rm(s.w || 0, s.r) > e1rm(a.w || 0, a.r) ? s : a), best.sets[0]);
  return (
    <section class="card exhist">
      <h3 class="h3row">
        <TrendingUp size={17} /> Dein Verlauf
      </h3>
      {vals.length >= 2 && (
        <>
          <Spark values={vals} labels={chron.map((x) => fmtShortDate(x.date))} unit={weighted ? ' kg' : ` ${ex.unit}`} />
          <p class="small muted">{weighted ? 'Geschätztes Maximum (1 Wdh.) aus deinem besten Satz – steigt, wenn du stärker wirst.' : `Beste Leistung pro Einheit (${ex.unit}).`}</p>
        </>
      )}
      <p class="small">
        <Trophy size={14} /> Bestleistung: <b>{bestSet.w ? `${kg(bestSet.w)} × ${bestSet.r}` : `${bestSet.r} ${ex.unit}`}</b> <span class="muted">({fmtShortDate(best.date)})</span>
      </p>
      <ul class="exhist__list">
        {h.slice(0, 5).map((x) => (
          <li>
            <span class="muted tnum">{fmtShortDate(x.date)}</span>
            <span class="tnum">
              {x.sets.map((s) => (s.w ? `${n1(s.w)}×${s.r}` : `${s.r}`)).join(' · ')}
              {x.light ? <small class="muted"> (leicht)</small> : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Nach dem Training: Rekorde, Vergleich zum letzten Mal, Kennzahlen */
export function SummarySheet({ name, minutes, sets, volume, prs = [], cmp = [], rir }) {
  return (
    <Sheet
      title="Training gespeichert"
      footer={
        <button class="btn btn--primary btn--block btn--lg" onClick={closeSheet}>
          Fertig
        </button>
      }
    >
      <div class="sum__hero">
        <span class="sum__emoji">{prs.length ? '🏆' : '💪'}</span>
        <h2>{prs.length ? `${prs.length === 1 ? 'Neuer Rekord' : prs.length + ' neue Rekorde'}!` : 'Stark gemacht!'}</h2>
        <p class="muted">{name}</p>
      </div>
      <div class="sum__stats">
        <div>
          <Timer size={16} />
          <b class="tnum">{minutes}</b>
          <span>Minuten</span>
        </div>
        <div>
          <Layers size={16} />
          <b class="tnum">{sets}</b>
          <span>Sätze</span>
        </div>
        <div>
          <Dumbbell size={16} />
          <b class="tnum">{volume >= 1000 ? n1(volume / 1000) + ' t' : n0(volume) + ' kg'}</b>
          <span>bewegt</span>
        </div>
      </div>
      {prs.length > 0 && (
        <section class="card sum__prs">
          {prs.map((p) => (
            <div class="sum__pr">
              <Trophy size={16} />
              <span>
                <b>{p.name}</b>: {kg(p.w)} × {p.r} <small class="muted">(bisher bestes Maximum ~{n1(p.prev)} kg, jetzt ~{n1(p.now)} kg)</small>
              </span>
            </div>
          ))}
        </section>
      )}
      {cmp.length > 0 && (
        <section class="card">
          <h3 class="h3row">Im Vergleich zum letzten Mal</h3>
          <ul class="sum__cmp">
            {cmp.map((c) => (
              <li class={c.dir > 0 ? 'up' : c.dir < 0 ? 'down' : ''}>
                <span>{c.name}</span>
                <b class="tnum">{c.text}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rir != null && (
        <p class="small muted center">
          Ø Reserve: <b>{n1(rir)} Wdh.</b> – {rir < 1 ? 'du warst sehr nah am Limit. Gut, aber nicht jeden Satz so.' : rir > 2.5 ? 'da ging noch was – die App steigert beim nächsten Mal mutiger.' : 'genau im richtigen Bereich.'}
        </p>
      )}
      <p class="small muted center">Gewichte und Wiederholungen für das nächste Mal passt die App automatisch an.</p>
    </Sheet>
  );
}

/** Daten für die Zusammenfassung berechnen (vor dem Speichern aufrufen) */
export function buildSummary(w, record) {
  const prs = [];
  const cmp = [];
  record.items.forEach((it) => {
    const done = it.sets.filter((x) => x.r > 0);
    if (!done.length) return;
    const hist = exHistory(it.exId, 400);
    const prevBest = hist.reduce((a, x) => (x.topW > 0 ? Math.max(a, x.best) : a), 0);
    const topSet = done.reduce((a, s) => (e1rm(s.w || 0, s.r) > e1rm(a.w || 0, a.r) ? s : a), done[0]);
    const now = e1rm(topSet.w || 0, topSet.r);
    if (topSet.w > 0 && prevBest > 0 && now > prevBest + 0.01) prs.push({ name: it.name, w: topSet.w, r: topSet.r, prev: prevBest, now });
    const last = hist.find((x) => !x.light) || hist[0];
    if (!last) return;
    const topW = Math.max(...done.map((s) => s.w || 0));
    const reps = done.filter((s) => (s.w || 0) === topW).reduce((a, s) => a + s.r, 0);
    const lastReps = last.sets.filter((s) => (s.w || 0) === last.topW).reduce((a, s) => a + s.r, 0);
    let text;
    let dir = 0;
    if (topW > last.topW) {
      text = signed(topW - last.topW, ' kg');
      dir = 1;
    } else if (topW < last.topW) {
      text = signed(topW - last.topW, ' kg');
      dir = -1;
    } else {
      const d = reps - lastReps;
      text = d ? `${d > 0 ? '+' : '−'}${Math.abs(d)} ${it.unit === 'Sek.' ? 'Sek.' : 'Wdh.'}` : 'gleich';
      dir = Math.sign(d);
    }
    cmp.push({ name: it.name, text, dir });
  });
  const rated = record.items.flatMap((it) => it.sets.filter((s) => s.rir != null && s.rir !== '').map((s) => Number(s.rir)));
  const volume = record.items.reduce((a, it) => a + it.sets.reduce((b, x) => b + (x.w || 0) * x.r, 0), 0);
  return {
    name: record.name,
    minutes: record.minutes,
    sets: record.items.reduce((a, it) => a + it.sets.length, 0),
    volume,
    prs,
    cmp: cmp.sort((a, b) => b.dir - a.dir).slice(0, 8),
    rir: rated.length >= 3 ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
  };
}

/** Fortschritt auf einen Blick */
export function ProgressCard() {
  useS();
  const st = progressStats();
  const total = st.weeks.reduce((a, w) => a + w.n + w.away, 0);
  if (!total) return null;
  const maxN = Math.max(3, ...st.weeks.map((w) => w.n + w.away));
  const last4 = st.weeks.slice(4).reduce((a, w) => a + w.n + w.away, 0);
  return (
    <section class="card progcard">
      <h3 class="h3row">
        <TrendingUp size={18} /> Dein Fortschritt
      </h3>
      <div class="sum__stats sum__stats--sm">
        <div>
          <b class="tnum">{last4}</b>
          <span>Einheiten</span>
          <small>4 Wochen</small>
        </div>
        <div>
          <b class="tnum">{st.prs.length}</b>
          <span>Rekorde</span>
          <small>30 Tage</small>
        </div>
        <div>
          <b class="tnum">{st.weeks[7].sets}</b>
          <span>Sätze</span>
          <small>diese Woche</small>
        </div>
      </div>
      <div class="wkbars" aria-label="Einheiten pro Woche, letzte 8 Wochen">
        {st.weeks.map((w, i) => (
          <div class="wkbars__c">
            <div class="wkbars__track">
              <div class="wkbars__bar" style={{ height: ((w.n + w.away) / maxN) * 100 + '%' }}>
                {w.n + w.away > 0 && <span class="tnum">{w.n + w.away}</span>}
              </div>
            </div>
            <span class={'wkbars__l' + (i === 7 ? ' wkbars__l--now' : '')}>{i === 7 ? 'jetzt' : 'KW' + isoWeek(w.ws)}</span>
          </div>
        ))}
      </div>
      {st.trend.length > 0 && (
        <>
          <h4 class="sect">Kraft (letzte 8 Wochen)</h4>
          <ul class="trendlist">
            {st.trend.map((t) => (
              <li>
                <span>{t.name}</span>
                <span class="tnum muted">
                  ~{n0(t.first)} → ~{n0(t.last)} kg
                </span>
                <b class={'tnum ' + (t.pct > 0.5 ? 'up' : t.pct < -0.5 ? 'down' : '')}>{t.pct > 0 ? '+' : ''}{n1(t.pct)} %</b>
              </li>
            ))}
          </ul>
          <p class="small muted">Geschätztes Maximum für 1 Wiederholung, berechnet aus deinen Sätzen.</p>
        </>
      )}
      {st.prs.length > 0 && (
        <p class="small">
          <Trophy size={14} /> Zuletzt: <b>{st.prs[st.prs.length - 1].name}</b> ({fmtShortDate(st.prs[st.prs.length - 1].date)})
        </p>
      )}
    </section>
  );
}

/** Kachel auf „Heute“: Was steht im Training an? */
export function TodayTrainingTile() {
  const s = useS();
  if (!s.training || !s.training.setup) return null;
  if (s.active)
    return (
      <button class="card trtile trtile--live" onClick={() => nav('/workout')}>
        <Flame size={20} />
        <span class="trtile__txt">
          <b>{s.active.name} läuft</b>
          <small>Weiter trainieren</small>
        </span>
        <ChevronRight size={18} />
      </button>
    );
  const rec = recommend(setupOf());
  let icon = '💪';
  let title = '';
  let sub = '';
  if (rec.status === 'sick') {
    icon = '🤒';
    title = 'Gute Besserung';
    sub = 'Training ist pausiert';
  } else if (rec.status === 'urlaub-frei') {
    icon = '🏖️';
    title = 'Urlaub';
    sub = 'Erholung – kein Training geplant';
  } else if (rec.status === 'done') {
    icon = '✅';
    title = 'Heute trainiert';
    sub = rec.doneToday ? rec.doneToday.name : '';
  } else if (rec.status === 'game' || rec.status === 'handball') {
    icon = '🏅';
    title = rec.status === 'game' ? 'Heute Spiel' : 'Heute Vereinstraining';
    sub = 'Kein Gym nötig';
  } else if (rec.status === 'pregame') {
    icon = '🧘';
    title = 'Morgen Spiel';
    sub = 'Heute frei – frische Beine';
  } else if (rec.status === 'goal' || rec.status === 'urlaub-ziel') {
    icon = '🎯';
    title = 'Wochenziel erreicht';
    sub = `${rec.doneThisWeek}/${rec.perWeek} Einheiten`;
  } else {
    const sess = buildSession(rec.sessionId);
    const ss = sessionOf(rec.sessionId);
    icon = rec.brk ? '🏖️' : '🏋️';
    title = `${rec.status === 'free' ? 'Wenn du Zeit hast' : 'Heute'}: ${ss.name}`;
    sub = ss.cardio ? ss.focus : `${sess.items.length} Übungen · ~${estMinutes(sess.items)} Min · ${rec.doneThisWeek}/${rec.perWeek} diese Woche`;
  }
  return (
    <button class="card trtile" onClick={() => nav('/training')}>
      <span class="trtile__ic">{icon}</span>
      <span class="trtile__txt">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
