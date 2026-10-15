import { useState, useEffect } from 'preact/hooks';
import { useS, getDay, patchDay, toast, closeSheet, S } from '../lib/store.js';
import { Sheet } from './common.jsx';
import { startWorkout } from './exui.jsx';
import { todayKey, addDays, WD_SHORT, parseKey, uid } from '../lib/util.js';
import { Chip, Field } from './common.jsx';
import { sportOf, isSportEntry, soreOf, buildSession, mgOf, MUSCLE_LABEL } from '../lib/training.js';
import { BodyMap, musclesOf } from './bodymap.jsx';
import { sleepBucket } from '../lib/health.js';
import { Dumbbell, HeartPulse, Check, Trash2, Pencil } from 'lucide-preact';

export const ENERGY = [
  { v: 1, e: '😴', l: 'platt' },
  { v: 2, e: '😕', l: 'müde' },
  { v: 3, e: '😐', l: 'okay' },
  { v: 4, e: '🙂', l: 'gut' },
  { v: 5, e: '💪', l: 'top' },
];
const SLEEP = ['< 6 h', '6 h', '7 h', '8 h', '9 h +'];
const SORE = ['keiner', 'leicht', 'stark'];
export const AREAS = ['Schulter', 'Nacken', 'Rücken oben', 'Rücken unten', 'Ellbogen', 'Handgelenk', 'Hüfte', 'Knie', 'Sprunggelenk', 'Wade', 'Oberschenkel'];
const OTHER = ['Laufen / Cardio', 'Mobility', 'Sonstiges'];
const typesFor = (sp) => (sp.id === 'keiner' ? OTHER : [sp.name, ...(sp.games ? [`${sp.name}-Spiel`] : []), ...OTHER.filter((x) => !(sp.id === 'laufen' && x.startsWith('Laufen')))]);
const RPE = ['locker', 'mittel', 'hart'];

/** Tagesform-Check (eingeklappt, wenn schon ausgefüllt) */
export function FormCard() {
  useS();
  const k = todayKey();
  const day = getDay(k);
  const [open, setOpen] = useState(!day.form);
  const [f, setF] = useState(day.form || { energy: 0, sleep: '', soreness: 'keiner', pains: [], note: '' });
  useEffect(() => {
    if (day.form) setF(day.form);
  }, [day.form && day.form.at]);

  const togglePain = (area) =>
    setF((o) => {
      const has = (o.pains || []).some((p) => p.area === area);
      return { ...o, pains: has ? o.pains.filter((p) => p.area !== area) : [...(o.pains || []), { area, level: 4 }] };
    });
  const setLevel = (area, level) => setF((o) => ({ ...o, pains: o.pains.map((p) => (p.area === area ? { ...p, level } : p)) }));
  const save = () => {
    patchDay(k, { form: { ...f, at: Date.now() } });
    setOpen(false);
    toast('Tagesform gespeichert – Training ist angepasst');
  };

  if (!open && day.form) {
    const e = ENERGY[(day.form.energy || 3) - 1];
    return (
      <section class="card formsumcard">
        <span class="formsumcard__e">{e.e}</span>
        <div class="formsumcard__txt">
          <b>Tagesform: {e.l}</b>
          <span class="small muted">
            {[day.form.sleep && `Schlaf ${day.form.sleep}`, day.form.soreness && day.form.soreness !== 'keiner' && `Muskelkater ${day.form.soreness}`, ...(day.form.pains || []).map((p) => `${p.area} ${p.level}/10`)].filter(Boolean).join(' · ') || 'keine Beschwerden'}
          </span>
        </div>
        <button class="iconbtn" onClick={() => setOpen(true)} aria-label="Tagesform ändern">
          <Pencil size={18} />
        </button>
      </section>
    );
  }

  return (
    <section class="card form">
      <h3>
        <HeartPulse size={18} /> Wie fühlst du dich heute?
      </h3>
      <div class="energy">
        {ENERGY.map((x) => (
          <button class={'energy__btn' + (f.energy === x.v ? ' energy__btn--on' : '')} onClick={() => setF({ ...f, energy: x.v })} aria-pressed={f.energy === x.v}>
            <span class="energy__e">{x.e}</span>
            <span>{x.l}</span>
          </button>
        ))}
      </div>
      <h3>Schlaf letzte Nacht</h3>
      <div class="chips chips--wrap">
        {SLEEP.map((x) => (
          <Chip small active={f.sleep === x} onClick={() => setF({ ...f, sleep: x })}>
            {x}
          </Chip>
        ))}
      </div>
      <h3>Muskelkater</h3>
      <div class="chips chips--wrap">
        {SORE.map((x) => (
          <Chip small active={f.soreness === x} onClick={() => setF({ ...f, soreness: x })}>
            {x}
          </Chip>
        ))}
      </div>
      <h3>Schmerzen oder Zwicken?</h3>
      <div class="chips chips--wrap">
        {AREAS.map((a) => (
          <Chip small active={(f.pains || []).some((p) => p.area === a)} onClick={() => togglePain(a)}>
            {a}
          </Chip>
        ))}
      </div>
      {(f.pains || []).map((p) => (
        <div class="pain" key={p.area}>
          <div class="pain__top">
            <span>{p.area}</span>
            <b class="tnum">{p.level} / 10</b>
          </div>
          <input type="range" min="1" max="10" value={p.level} onInput={(e) => setLevel(p.area, Number(e.currentTarget.value))} aria-label={`Stärke ${p.area}`} />
          <span class="small muted">{p.level >= 7 ? 'Stark – betroffene Übungen fallen heute weg.' : p.level >= 4 ? 'Übungen, die hier belasten, werden getauscht.' : 'Leicht – nur zur Info.'}</span>
        </div>
      ))}
      <Field label="Notiz (optional)">
        <input class="input" value={f.note || ''} placeholder="z. B. Knie nach dem Training etwas dick" onInput={(e) => setF({ ...f, note: e.currentTarget.value })} />
      </Field>
      <button class="btn btn--primary btn--block" onClick={save} disabled={!f.energy}>
        <Check size={18} /> {day.form ? 'Aktualisieren' : 'Speichern'}
      </button>
    </section>
  );
}

/** Vereinssport & sonstiges Training eintragen */
export function OtherTrainingCard({ preset }) {
  useS();
  const k = todayKey();
  const day = getDay(k);
  const [tr, setTr] = useState({ type: preset || '', minutes: 90, rpe: 'mittel' });
  const sp = sportOf();
  const TYPES = typesFor(sp);
  const add = () => {
    if (!tr.type) return;
    const sport = sp.id !== 'keiner' && tr.type.startsWith(sp.name);
    patchDay(k, (d) => ({ training: [...(d.training || []), { id: uid(), ...tr, sport, at: Date.now() }] }));
    setTr({ type: '', minutes: 90, rpe: 'mittel' });
    toast(`${tr.type} eingetragen 💪`);
  };
  return (
    <section class="card form">
      <h3>
        <Dumbbell size={18} /> Heute trainiert
      </h3>
      {(day.training || []).length > 0 && (
        <ul class="trlist">
          {day.training.map((t) => (
            <li>
              <span>
                <b>{t.session || t.type}</b> · {t.minutes} Min{t.rpe ? ' · ' + t.rpe : ''}
              </span>
              <button
                class="iconbtn"
                onClick={() => patchDay(k, (d) => ({ training: (d.training || []).filter((x) => x.id !== t.id), workouts: t.workoutId ? (d.workouts || []).filter((w) => w.id !== t.workoutId) : d.workouts || [] }))}
                aria-label="Training löschen"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="chips chips--wrap">
        {TYPES.map((x) => (
          <Chip small active={tr.type === x} onClick={() => setTr({ ...tr, type: x })}>
            {x}
          </Chip>
        ))}
      </div>
      {tr.type && (
        <>
          <div class="row row--center">
            <span class="small muted">Dauer</span>
            <div class="chips">
              {[30, 60, 90, 120].map((m) => (
                <Chip small active={tr.minutes === m} onClick={() => setTr({ ...tr, minutes: m })}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
          <div class="row row--center">
            <span class="small muted">Wie hart?</span>
            <div class="chips">
              {RPE.map((x) => (
                <Chip small active={tr.rpe === x} onClick={() => setTr({ ...tr, rpe: x })}>
                  {x}
                </Chip>
              ))}
            </div>
          </div>
          <button class="btn btn--block" onClick={add}>
            <Check size={18} /> {tr.type} eintragen
          </button>
        </>
      )}
    </section>
  );
}

export function Last7Card() {
  useS();
  const k = todayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(k, -6 + i));
  return (
    <section class="card">
      <h3 class="h3row">
        <HeartPulse size={18} /> Letzte 7 Tage
      </h3>
      <div class="week7">
        {last7.map((key) => {
          const d = getDay(key);
          const e = d.form && d.form.energy;
          const tr = d.training || [];
          return (
            <div class="week7__d">
              <span class={'small ' + (key === k ? '' : 'muted')}>{WD_SHORT[parseKey(key).getDay()]}</span>
              <span class="week7__e">{e ? ENERGY[e - 1].e : '·'}</span>
              <span class="week7__t">{tr.some((t) => isSportEntry(t)) ? sportOf().emoji || '🏅' : ''}{tr.some((t) => t.type === 'Kraft') ? '🏋️' : ''}</span>
              {d.form && (d.form.pains || []).length > 0 && <span class="week7__p" title={(d.form.pains || []).map((p) => p.area).join(', ')} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const FIT = ['Total K.O.', 'Eher schlapp', 'Normal', 'Fit', 'Sehr fit'];

/** Wellness-Abfrage vor dem Training (wie bei MCI), Schritt für Schritt */
export function WellnessSheet({ sessionId }) {
  const k = todayKey();
  const prev = getDay(k).form;
  const [step, setStep] = useState(0);
  const hs = getDay(k).health;
  const [f, setF] = useState(() => ({ energy: 4, sleep: sleepBucket(hs && hs.sleepH) || '7 h', soreness: 'keiner', pains: [], note: '', ...(prev && prev.energy ? prev : {}) }));
  const STEPS = 4;
  const finish = (skipped) => {
    patchDay(k, { form: skipped ? { ...(prev || {}), skipped: true, at: Date.now() } : { ...f, skipped: false, at: Date.now() } });
    closeSheet();
    if (sessionId) startWorkout(sessionId, null, { skipCheck: true });
    else toast('Tagesform gespeichert');
  };
  const togglePain = (area) =>
    setF((o) => {
      const has = o.pains.some((p) => p.area === area);
      return { ...o, pains: has ? o.pains.filter((p) => p.area !== area) : [...o.pains, { area, level: 4 }] };
    });
  // Muskelkater pro Muskel: antippen = leicht → stark → weg; Gesamtwert wird abgeleitet
  const sore = soreOf(f);
  const tapSore = (m) =>
    setF((o) => {
      const cur = { ...soreOf(o) };
      cur[m] = !cur[m] ? 'leicht' : cur[m] === 'leicht' ? 'stark' : undefined;
      if (!cur[m]) delete cur[m];
      const lv = Object.values(cur);
      return { ...o, sore: cur, soreness: lv.includes('stark') ? 'stark' : lv.length ? 'leicht' : 'keiner' };
    });
  const target = (() => {
    try {
      return sessionId ? musclesOf(buildSession(sessionId, undefined, null).items.map((it) => it.exId), mgOf) : { primary: [], secondary: [] };
    } catch (e) {
      return { primary: [], secondary: [] };
    }
  })();
  return (
    <Sheet
      title="Wellness-Abfrage"
      footer={
        <div class="row">
          {step > 0 && (
            <button class="btn" onClick={() => setStep(step - 1)}>
              Zurück
            </button>
          )}
          <button class="btn btn--primary btn--grow btn--lg" onClick={() => (step < STEPS - 1 ? setStep(step + 1) : finish(false))}>
            {step < STEPS - 1 ? 'Weiter' : sessionId ? 'Training starten' : 'Speichern'}
          </button>
        </div>
      }
    >
      <div class="wellness__top">
        <div class="wellness__dots">
          {Array.from({ length: STEPS }, (_, i) => (
            <span class={'wellness__dot' + (i <= step ? ' wellness__dot--on' : '')} />
          ))}
        </div>
        <button class="btn--link small wellness__skip" onClick={() => finish(true)}>
          Überspringen
        </button>
      </div>
      {step === 0 && (
        <div class="wellness">
          <p class="muted">Damit dein Training heute genau passt, kurz ein paar Fragen.</p>
          <h2 class="wellness__big">
            {ENERGY[f.energy - 1].e} {FIT[f.energy - 1]}
          </h2>
          <input class="wellness__range" type="range" min="1" max="5" step="1" value={f.energy} onInput={(e) => setF({ ...f, energy: Number(e.currentTarget.value) })} aria-label="Wie fit fühlst du dich?" />
          <div class="row row--between small muted">
            <span>Total K.O.</span>
            <span>Sehr fit</span>
          </div>
        </div>
      )}
      {step === 1 && (
        <div class="wellness">
          <h2>Wie lange hast du geschlafen?</h2>
          {hs && hs.sleepH && <p class="small muted">❤️ Laut Health: {String(hs.sleepH).replace('.', ',')} h</p>}
          <div class="chips chips--wrap">
            {SLEEP.map((x) => (
              <Chip active={f.sleep === x} onClick={() => setF({ ...f, sleep: x })}>
                {x}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div class="wellness">
          <h2>Muskelkater?</h2>
          <p class="small muted">Tippe auf die Muskeln: 1× = leicht, 2× = stark, 3× = weg.{target.primary.length ? ' Blinkend = heute dran.' : ''}</p>
          <BodyMap sex={S.profile && S.profile.sex === 'w' ? 'w' : 'm'} sore={sore} pulse={target.primary} onTap={tapSore} size="md" />
          <div class="bmlegend">
            {target.primary.length > 0 && (
              <span>
                <i style={{ background: 'var(--accent)' }} />
                heute dran
              </span>
            )}
            <span>
              <i style={{ background: 'var(--c)' }} />
              leicht
            </span>
            <span>
              <i style={{ background: 'var(--danger)' }} />
              stark
            </span>
          </div>
          {Object.keys(sore).length > 0 ? (
            <div class="sorelist">
              {Object.entries(sore).map(([m, lv]) => (
                <Chip small active onClick={() => tapSore(m)}>
                  {MUSCLE_LABEL[m]}: {lv}
                </Chip>
              ))}
            </div>
          ) : (
            <p class="small muted center">Kein Muskelkater? Einfach weiter.</p>
          )}
          {Object.entries(sore).some(([m, lv]) => lv === 'stark' && target.primary.includes(m)) && <p class="small muted center">Muskeln mit starkem Muskelkater bekommen heute 1 Satz weniger – oder die App schlägt eine andere Einheit vor.</p>}
        </div>
      )}
      {step === 3 && (
        <div class="wellness">
          <h2>Schmerzen oder Zwicken?</h2>
          <p class="small muted">Nichts auswählen, wenn alles gut ist.</p>
          <div class="chips chips--wrap">
            {AREAS.map((a) => (
              <Chip small active={f.pains.some((p) => p.area === a)} onClick={() => togglePain(a)}>
                {a}
              </Chip>
            ))}
          </div>
          {f.pains.map((p) => (
            <div class="pain" key={p.area}>
              <div class="pain__top">
                <span>{p.area}</span>
                <b class="tnum">{p.level} / 10</b>
              </div>
              <input type="range" min="1" max="10" value={p.level} onInput={(e) => setF((o) => ({ ...o, pains: o.pains.map((x) => (x.area === p.area ? { ...x, level: Number(e.currentTarget.value) } : x)) }))} aria-label={`Stärke ${p.area}`} />
              <span class="small muted">{p.level >= 7 ? 'Stark – betroffene Übungen fallen heute weg.' : p.level >= 4 ? 'Übungen, die hier belasten, werden getauscht.' : 'Leicht – nur zur Info.'}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
