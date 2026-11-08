// Statistik: Wochen-Check (Ernährung, Gewicht) und Training (Fortschritt, Kraftverlauf, letzte Einheiten)
import { useS } from '../lib/store.js';
import { Seg } from './common.jsx';
import { Week } from './week.jsx';
import { BodyStats } from './bodystats.jsx';
import { ProgressCard, StrengthCharts } from './progress.jsx';
import { WorkoutHistoryCard } from './wedit.jsx';
import { Last7Card } from './form.jsx';
import { workoutLog, weekStreak, isSportEntry, breakOn, recoveryMap, setsPerMuscle, volTarget, weeklyVolume, MUSCLE_LABEL, setupOf } from '../lib/training.js';
import { BodyMap } from './bodymap.jsx';
import { useState } from 'preact/hooks';
import { S, toast } from '../lib/store.js';
import { addDays, weekStart, todayKey, n1 } from '../lib/util.js';
import { nav } from './router.js';
import { Dumbbell, BatteryCharging, Layers, CalendarDays } from 'lucide-preact';
import { getDay } from '../lib/store.js';

const recColor = (r) => (r >= 90 ? 'var(--accent)' : r >= 70 ? '#9bd65c' : r >= 40 ? '#f2b84a' : '#ef5b4a');

/** Erholung je Muskel als Körperkarte (wie Fitbod) */
function RecoveryCard() {
  useS();
  const rec = recoveryMap();
  const fills = Object.fromEntries(Object.entries(rec).map(([g, r]) => [g, recColor(r)]));
  const tired = Object.entries(rec)
    .filter(([, r]) => r < 90)
    .sort((a, b) => a[1] - b[1]);
  return (
    <section class="card reccard">
      <h3 class="h3row">
        <BatteryCharging size={18} /> Erholung jetzt
      </h3>
      <BodyMap sex={S.profile && S.profile.sex === 'w' ? 'w' : 'm'} fills={fills} onTap={(g) => toast(`${MUSCLE_LABEL[g]}: ${rec[g]} % erholt`)} size="md" />
      <div class="reccard__legend small muted">
        <span><i style={{ background: recColor(100) }} />frisch</span>
        <span><i style={{ background: recColor(80) }} />fast</span>
        <span><i style={{ background: recColor(55) }} />erholt sich</span>
        <span><i style={{ background: recColor(20) }} />müde</span>
      </div>
      {tired.length ? (
        <ul class="reccard__list">
          {tired.map(([g, r]) => (
            <li>
              <span>{MUSCLE_LABEL[g]}</span>
              <span class="reccard__bar">
                <span style={{ width: r + '%', background: recColor(r) }} />
              </span>
              <b class="tnum">{r} %</b>
            </li>
          ))}
        </ul>
      ) : (
        <p class="small">Alle Muskeln sind erholt – bereit für alles 💪</p>
      )}
      <p class="small muted">Geschätzt aus deinen Sätzen der letzten Tage (große Muskeln ~4 Tage, kleine ~3 Tage) und deinem Muskelkater von heute. Muskel antippen zeigt den Wert.</p>
    </section>
  );
}

/** Harte Sätze pro Muskel und Woche mit Zielbereich (wie RP / Hevy) */
function VolumeCard() {
  useS();
  const [last, setLast] = useState(false);
  const ws = addDays(weekStart(todayKey()), last ? -7 : 0);
  const done = setsPerMuscle(ws);
  const plan = last ? null : weeklyVolume({ ...setupOf(), gameDay: null });
  const rows = Object.keys(done).map((g) => ({ g, v: done[g], p: plan ? plan[g] || 0 : null, t: volTarget(g) }));
  const max = Math.max(...rows.map((r) => Math.max(r.t[1] * 1.15, r.v, r.p || 0)));
  const pct = (v) => Math.min(100, (v / max) * 100) + '%';
  return (
    <section class="card volcard">
      <h3 class="h3row">
        <Layers size={18} /> Sätze pro Muskel
      </h3>
      <div class="chips">
        <button class={'chip chip--sm' + (!last ? ' chip--on' : '')} onClick={() => setLast(false)}>
          Diese Woche
        </button>
        <button class={'chip chip--sm' + (last ? ' chip--on' : '')} onClick={() => setLast(true)}>
          Letzte Woche
        </button>
      </div>
      <ul class="volcard__list">
        {rows.map(({ g, v, p, t }) => {
          const st = v >= t[0] && v <= t[1] ? 'ok' : v > t[1] ? 'hi' : 'lo';
          return (
            <li class={'volrow volrow--' + st}>
              <span class="volrow__n">{MUSCLE_LABEL[g]}</span>
              <span class="volrow__track" aria-hidden="true">
                <span class="volrow__zone" style={{ left: pct(t[0]), width: `calc(${pct(t[1])} - ${pct(t[0])})` }} />
                {p != null && p > v && <span class="volrow__plan" style={{ width: pct(p) }} />}
                <span class="volrow__fill" style={{ width: pct(v) }} />
              </span>
              <span class="volrow__v tnum">
                <b>{n1(v)}</b>
                <small class="muted">
                  {' '}
                  / {t[0]}–{t[1]}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
      <p class="small muted">
        Grüner Bereich = Ziel pro Woche. Hilfsmuskeln zählen halb (Bankdrücken = 1 Satz Brust + ½ Trizeps).{!last && ' Heller Balken = was dein Plan bis Sonntag noch vorsieht.'}
      </p>
    </section>
  );
}

/** Kalender der letzten 5 Wochen + Serie (wie MCI / Hevy) */
function CalendarCard() {
  useS();
  const st = weekStreak();
  const tk = todayKey();
  const start = addDays(weekStart(tk), -28);
  const days = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const kind = (k) => {
    if (k > tk) return 'future';
    const d = getDay(k);
    if ((d.workouts || []).some((w) => (w.items || []).length)) return 'gym';
    const tr = d.training || [];
    if (tr.some((t) => isSportEntry(t))) return 'sport';
    if (tr.length) return 'other';
    if (breakOn(k)) return 'break';
    return 'none';
  };
  return (
    <section class="card calcard">
      <div class="calcard__head">
        <h3 class="h3row">
          <CalendarDays size={18} /> Letzte 5 Wochen
        </h3>
        <span class={'streak' + (st.weeks ? ' streak--on' : '')} title="Wochen in Folge mit erreichtem Wochenziel">
          🔥 <b class="tnum">{st.weeks}</b> {st.weeks === 1 ? 'Woche' : 'Wochen'}
        </span>
      </div>
      <div class="calgrid">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <span class="calgrid__h">{d}</span>
        ))}
        {days.map((k) => (
          <span class={'calgrid__d calgrid__d--' + kind(k) + (k === tk ? ' calgrid__d--today' : '')} title={k}>
            {Number(k.slice(8))}
          </span>
        ))}
      </div>
      <div class="calcard__legend small muted">
        <span><i class="calgrid__d--gym" />Gym</span>
        <span><i class="calgrid__d--sport" />Verein</span>
        <span><i class="calgrid__d--other" />Sonstiges</span>
        <span><i class="calgrid__d--break" />Pause</span>
      </div>
      <p class="small">
        Diese Woche: <b class="tnum">{st.thisWeek}/{st.goal}</b> Gym-Einheiten
        {st.thisWeek >= st.goal ? ' ✓ Ziel erreicht' : ` – noch ${st.goal - st.thisWeek} für die Serie`}
      </p>
    </section>
  );
}

function TrainingStats() {
  useS();
  const any = workoutLog().some((w) => (w.items || []).length);
  return (
    <div class="page">
      <header class="pagehead">
        <h1>Fortschritt</h1>
      </header>
      {!any && (
        <section class="card empty">
          <Dumbbell size={28} class="muted" />
          <p>
            <b>Noch keine Trainings</b>
          </p>
          <p class="small muted">Nach deinem ersten Training siehst du hier Fortschritt, Kraftverlauf je Übung und deine letzten Einheiten.</p>
          <button class="btn btn--primary" onClick={() => nav('/training')}>
            Zum Training
          </button>
        </section>
      )}
      {any && <RecoveryCard />}
      {any && <CalendarCard />}
      <ProgressCard />
      {any && <VolumeCard />}
      <StrengthCharts />
      <WorkoutHistoryCard />
      <Last7Card />
    </div>
  );
}

export function Stats({ query = {} }) {
  const tab = query.tab === 'training' || query.tab === 'koerper' ? query.tab : 'woche';
  return (
    <div class="page">
      <div class="stattabs">
        <Seg
          options={[
            { id: 'woche', label: 'Woche' },
            { id: 'training', label: 'Training' },
            { id: 'koerper', label: 'Körper' },
          ]}
          value={tab}
          onChange={(t) => nav('/woche' + (t !== 'woche' ? '?tab=' + t : ''))}
        />
      </div>
      {tab === 'woche' ? <Week query={query} key={query.last || 'w'} /> : tab === 'koerper' ? <BodyStats /> : <TrainingStats />}
    </div>
  );
}
