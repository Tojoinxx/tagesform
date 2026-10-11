import { useState } from 'preact/hooks';
import { useS, S, saveTraining, saveActive, toast, patchDay } from '../lib/store.js';
import { EXPERIENCE, setupOf, defaultSetup, recommend, buildSession, weekPlan, dayShort, dayName } from '../lib/training.js';
import { SESSIONS, ROTATIONS, EXERCISES } from '../lib/exercises.js';
import { todayKey, uid, n1 } from '../lib/util.js';
import { Chip, Seg, Field } from './common.jsx';
import { FormCard, OtherTrainingCard, Last7Card } from './form.jsx';
import { Dumbbell, Play, Check, Settings2, ChevronRight, Sparkles, TriangleAlert } from 'lucide-preact';
import { nav } from './router.js';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export const fmtTarget = (it) => {
  const sets = it.sets.length;
  const r = it.target.reps;
  const w = it.target.w;
  return `${sets} × ${r} ${it.unit === 'Sek.' ? 'Sek.' : ''}${w ? ` · ${n1(w)} kg` : ''}`.replace('  ', ' ');
};

import { ExCard, ExAnim, startWorkout } from './exui.jsx';
export { startWorkout };

function SetupCard({ onDone, initial }) {
  const [st, setSt] = useState(initial || defaultSetup());
  const set = (p) => setSt((o) => ({ ...o, ...p }));
  const toggleDay = (d) => set({ handballDays: st.handballDays.includes(d) ? st.handballDays.filter((x) => x !== d) : [...st.handballDays, d] });
  return (
    <section class="card form">
      <h3>
        <Sparkles size={18} /> Dein Trainingsplan
      </h3>
      <p class="small muted">Ich baue dir einen Plan fürs Studio, der um dein Handball herum läuft und sich an Tagesform und Schmerzen anpasst.</p>
      <Field group label="Trainingserfahrung im Gym">
        <div class="opts opts--row">
          {EXPERIENCE.map((x) => (
            <button type="button" class={'opt' + (st.experience === x.id ? ' opt--on' : '')} onClick={() => set({ experience: x.id })} aria-pressed={st.experience === x.id}>
              <b>{x.label}</b>
              <span>{x.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field group label="Gym-Einheiten pro Woche" hint="2 = Ganzkörper, 3 = Oberkörper/Unterkörper/Oberkörper, 4 = je 2× Ober- und Unterkörper">
        <Seg
          value={String(st.perWeek)}
          onChange={(v) => set({ perWeek: Number(v) })}
          options={[
            { id: '2', label: '2×' },
            { id: '3', label: '3×' },
            { id: '4', label: '4×' },
          ]}
        />
      </Field>
      <Field group label="Zeit pro Einheit">
        <Seg
          value={String(st.minutes)}
          onChange={(v) => set({ minutes: Number(v) })}
          options={[
            { id: '45', label: '45 Min' },
            { id: '60', label: '60 Min' },
            { id: '75', label: '75+ Min' },
          ]}
        />
      </Field>
      <Field group label="Handball-Training an">
        <div class="daypick">
          {WEEK.map((d) => (
            <button type="button" class={'daypick__d' + (st.handballDays.includes(d) ? ' daypick__d--on' : '')} onClick={() => toggleDay(d)} aria-pressed={st.handballDays.includes(d)}>
              {dayShort(d)}
            </button>
          ))}
        </div>
      </Field>
      <Field group label="Spieltag (falls Saison)">
        <Seg
          value={String(st.gameDay ?? 'x')}
          onChange={(v) => set({ gameDay: v === 'x' ? null : Number(v) })}
          options={[
            { id: 'x', label: 'Keiner / wechselnd' },
            { id: '6', label: 'Samstag' },
            { id: '0', label: 'Sonntag' },
          ]}
        />
      </Field>
      <button
        class="btn btn--primary btn--block btn--lg"
        onClick={() => {
          saveTraining({ setup: st, createdAt: (S.training && S.training.createdAt) || Date.now() });
          toast('Plan erstellt 💪');
          onDone && onDone();
        }}
      >
        <Check size={18} /> {initial ? 'Plan aktualisieren' : 'Plan erstellen'}
      </button>
    </section>
  );
}

function WeekRhythm({ setup }) {
  const plan = weekPlan(setup);
  const today = new Date().getDay();
  return (
    <>
    {plan.dropped && plan.dropped.length > 0 && (
      <div class="notice notice--warn small" style={{ marginBottom: '10px' }}>
        <span>
          Mit diesen Handball-Tagen passt {plan.dropped.map((x) => SESSIONS[x].name).join(', ')} nirgends hin, ohne dass Beine direkt vor Training oder Spiel liegen – also {plan.length}× Gym diese Woche.
        </span>
      </div>
    )}
    <div class="rhythm">
      {WEEK.map((d) => {
        const p = plan.find((x) => x.d === d);
        const hb = setup.handballDays.includes(d);
        const game = setup.gameDay === d;
        return (
          <div class={'rhythm__d' + (d === today ? ' rhythm__d--today' : '') + (p ? ' rhythm__d--gym' : hb || game ? ' rhythm__d--hb' : '')}>
            <span class="rhythm__wd">{dayShort(d)}</span>
            <span class="rhythm__what">{p ? SESSIONS[p.sessionId].short : game ? 'Spiel' : hb ? '🤾' : '–'}</span>
          </div>
        );
      })}
    </div>
    </>
  );
}

function ExercisePreview({ items }) {
  return (
    <ul class="expv">
      {items.map((it) => (
        <li>
          <span class="expv__name">
            {it.name}
            {it.adaptedFrom && (
              <small class="badge badge--info">
                statt {it.adaptedFrom.name} ({it.adaptedFrom.why})
              </small>
            )}
          </span>
          <span class="expv__t tnum">{fmtTarget(it)}</span>
        </li>
      ))}
    </ul>
  );
}

function TodayCard({ setup }) {
  const s = useS();
  const rec = recommend(setup);
  const [pick, setPick] = useState(null);
  const sessionId = pick || rec.sessionId;
  const sess = buildSession(sessionId, setup);
  const showPlan = rec.status === 'train' || rec.status === 'free' || pick;

  return (
    <section class="card today-tr">
      <div class="today-tr__head">
        <span class="today-tr__badge tnum">
          {rec.doneThisWeek}/{rec.perWeek}
          <small>Gym diese Woche</small>
        </span>
        <div>
          {rec.status === 'handball' && !pick ? (
            <>
              <h2>Heute Handball 🤾</h2>
              <p class="muted small">Kein Gym nötig – trag das Training danach unten ein.</p>
            </>
          ) : rec.status === 'done' && !pick ? (
            <>
              <h2>Heute erledigt ✓</h2>
              <p class="muted small">{rec.doneToday.name} – stark! Jetzt Eiweiß und Schlaf.</p>
            </>
          ) : rec.status === 'goal' && !pick ? (
            <>
              <h2>Wochenziel erreicht</h2>
              <p class="muted small">Regeneration ist auch Training. Wenn du trotzdem willst:</p>
            </>
          ) : (
            <>
              <span class="small muted">{pick ? 'Gewählt' : rec.status === 'free' ? 'Kein fester Gym-Tag – wenn du Zeit hast' : 'Heute dran'}</span>
              <h2>{sess.name}</h2>
              <p class="muted small">{sess.focus}</p>
            </>
          )}
        </div>
      </div>

      {showPlan && (
        <>
          {!pick && rec.reasons.filter((r) => rec.status !== 'free' || !r.startsWith('Kein fester')).map((r) => <div class="notice small"><span>{r}</span></div>)}
          {sess.modeLabel && (
            <div class={'notice small ' + (sess.mode === 'light' ? 'notice--info' : 'notice--ok')}>
              <span>{sess.modeLabel}</span>
            </div>
          )}
          {sess.notes.map((n) => (
            <div class="notice notice--warn small">
              <TriangleAlert size={15} />
              <span>{n}</span>
            </div>
          ))}
          <div class="exlist exlist--c">
            {sess.items.map((it) => (
              <ExCard it={it} compact />
            ))}
          </div>
          <div class="row">
            <button class="btn btn--grow" onClick={() => nav('/einheit?s=' + sessionId)}>
              Ansehen & anpassen
            </button>
            <button class="btn btn--primary btn--grow" onClick={() => startWorkout(sessionId)}>
              <Play size={18} fill="currentColor" /> Starten
            </button>
          </div>
        </>
      )}
      {!showPlan && rec.status === 'goal' && (
        <button class="btn btn--block" onClick={() => setPick(rec.sessionId)}>
          {SESSIONS[rec.sessionId].name} trotzdem machen
        </button>
      )}
      {!showPlan && rec.status === 'handball' && (
        <button class="btn--link small" onClick={() => setPick(rec.sessionId)}>
          Trotzdem ins Gym ({SESSIONS[rec.sessionId].name})
        </button>
      )}
      {showPlan && (
        <div class="chips chips--wrap">
          <span class="small muted">Lieber was anderes:</span>
          {rec.rot
            .filter((x) => x !== sessionId)
            .map((x) => (
              <Chip small onClick={() => setPick(x)}>
                {SESSIONS[x].name}
              </Chip>
            ))}
        </div>
      )}
    </section>
  );
}

function PlanOverview({ setup }) {
  const rot = ROTATIONS[setup.perWeek] || ROTATIONS[3];
  return (
    <div class="sesslist">
      {rot.map((id) => {
        const sess = buildSession(id, setup);
        return (
          <button class="card sesscard" onClick={() => nav('/einheit?s=' + id)}>
            <div class="sesscard__thumbs">
              {sess.items.slice(0, 3).map((it) => (
                <ExAnim id={it.exId} size="xs" play={false} />
              ))}
            </div>
            <div class="sesscard__txt">
              <b>{sess.name}</b>
              <span class="small muted">
                {sess.focus} · {sess.items.length} Übungen
              </span>
            </div>
            <ChevronRight size={20} class="muted" />
          </button>
        );
      })}
    </div>
  );
}

export function Training() {
  const s = useS();
  const [editing, setEditing] = useState(false);
  const hasSetup = !!(s.training && s.training.setup);
  const setup = setupOf();

  return (
    <div class="page">
      <header class="pagehead">
        <h1>Training</h1>
        {hasSetup && (
          <button class="iconbtn" onClick={() => setEditing(!editing)} aria-label="Plan anpassen">
            <Settings2 size={20} />
          </button>
        )}
      </header>

      {s.active && (
        <button class="card cta cta--live" onClick={() => nav('/workout')}>
          <span class="cta__icon">
            <Dumbbell size={22} />
          </span>
          <span class="cta__text">
            <b>{s.active.name} läuft</b>
            <span>Weiter trainieren →</span>
          </span>
        </button>
      )}

      {(!hasSetup || editing) && <SetupCard initial={hasSetup ? setup : null} onDone={() => setEditing(false)} />}

      {hasSetup && !editing && (
        <>
          <FormCard />
          {!s.active && <TodayCard setup={setup} />}
          <h4 class="sect sect--page">Dein Wochenrhythmus</h4>
          <section class="card">
            <WeekRhythm setup={setup} />
            <p class="small muted" style={{ marginTop: '10px' }}>
              Beine nie am Tag vor dem Handball. Hast du an einem Tag keine Zeit, nimmst du einfach die nächste Einheit – die App merkt sich, wo du stehst.
            </p>
          </section>
          <OtherTrainingCard />
          <h4 class="sect sect--page">Alle Einheiten</h4>
          <PlanOverview setup={setup} />
          <Last7Card />
        </>
      )}
    </div>
  );
}
