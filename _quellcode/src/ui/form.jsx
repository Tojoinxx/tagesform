import { useState, useEffect } from 'preact/hooks';
import { useS, getDay, patchDay, toast } from '../lib/store.js';
import { todayKey, addDays, WD_SHORT, parseKey, uid } from '../lib/util.js';
import { Chip, Field } from './common.jsx';
import { sportOf, isSportEntry } from '../lib/training.js';
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
