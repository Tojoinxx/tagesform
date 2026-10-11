import { useState, useEffect } from 'preact/hooks';
import { useS, getDay, patchDay, toast } from '../lib/store.js';
import { todayKey, fmtDayTitle, addDays, WD_SHORT, parseKey, uid } from '../lib/util.js';
import { Chip, Field } from './common.jsx';
import { Dumbbell, HeartPulse, Check, Trash2, Sparkles, Info } from 'lucide-preact';

const ENERGY = [
  { v: 1, e: '😴', l: 'platt' },
  { v: 2, e: '😕', l: 'müde' },
  { v: 3, e: '😐', l: 'okay' },
  { v: 4, e: '🙂', l: 'gut' },
  { v: 5, e: '💪', l: 'top' },
];
const SLEEP = ['< 6 h', '6 h', '7 h', '8 h', '9 h +'];
const SORE = ['keiner', 'leicht', 'stark'];
export const AREAS = ['Schulter', 'Nacken', 'Rücken oben', 'Rücken unten', 'Ellbogen', 'Handgelenk', 'Hüfte', 'Knie', 'Sprunggelenk', 'Wade', 'Oberschenkel'];
const TYPES = ['Kraft', 'Handball', 'Laufen / Cardio', 'Mobility', 'Sonstiges'];
const RPE = ['locker', 'mittel', 'hart'];

function advice(f) {
  if (!f || !f.energy) return null;
  const pains = (f.pains || []).filter((p) => p.level >= 6);
  const lowSleep = f.sleep === '< 6 h';
  if (pains.length)
    return { kind: 'warn', text: `${pains.map((p) => p.area).join(', ')} meldet sich deutlich – heute Übungen weglassen, die dort reinziehen, und lieber Oberkörper/Unterkörper tauschen oder Mobility. Wenn es mehrere Tage so bleibt: abklären lassen.` };
  if (f.energy <= 2 || lowSleep) return { kind: 'calm', text: 'Eher wenig Energie – heute ruhig etwas lockerer: weniger Sätze, kein Maximalgewicht, oder ein Spaziergang statt hartem Training. Morgen wieder Gas geben.' };
  if (f.soreness === 'stark') return { kind: 'calm', text: 'Starker Muskelkater – trainier heute eher andere Muskelgruppen oder mach eine lockere Einheit.' };
  if (f.energy >= 4) return { kind: 'go', text: 'Gute Tagesform – ideal für ein forderndes Training. Versuch bei einer Übung ein bisschen mehr Gewicht oder eine Wiederholung mehr.' };
  return { kind: 'go', text: 'Normale Tagesform – trainier wie geplant und hör auf deinen Körper.' };
}

export function TagesForm() {
  const s = useS();
  const k = todayKey();
  const day = getDay(k);
  const [f, setF] = useState(day.form || { energy: 0, sleep: '', soreness: 'keiner', pains: [], note: '' });
  const [tr, setTr] = useState({ type: '', minutes: 60, rpe: 'mittel' });
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
    toast('Tagesform gespeichert');
  };
  const addTraining = () => {
    if (!tr.type) return;
    patchDay(k, (d) => ({ training: [...(d.training || []), { id: uid(), ...tr, at: Date.now() }] }));
    setTr({ type: '', minutes: 60, rpe: 'mittel' });
    toast('Training eingetragen 💪');
  };
  const adv = advice(day.form);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(k, -6 + i));

  return (
    <div class="page">
      <header class="pagehead">
        <h1>Tagesform</h1>
        <span class="muted">{fmtDayTitle(k)}</span>
      </header>

      {adv && (
        <section class={'card advice advice--' + adv.kind}>
          <Sparkles size={18} />
          <div>
            <b>Empfehlung für heute</b>
            <p>{adv.text}</p>
          </div>
        </section>
      )}

      <section class="card form">
        <h3>Wie ist deine Energie?</h3>
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
          </div>
        ))}
        <Field label="Notiz (optional)">
          <input class="input" value={f.note || ''} placeholder="z. B. Knie nach Handball etwas dick" onInput={(e) => setF({ ...f, note: e.currentTarget.value })} />
        </Field>
        <button class="btn btn--primary btn--block" onClick={save} disabled={!f.energy}>
          <Check size={18} /> {day.form ? 'Aktualisieren' : 'Speichern'}
        </button>
      </section>

      <section class="card form">
        <h3>
          <Dumbbell size={18} /> Training heute
        </h3>
        {(day.training || []).length > 0 && (
          <ul class="trlist">
            {day.training.map((t) => (
              <li>
                <span>
                  <b>{t.type}</b> · {t.minutes} Min · {t.rpe}
                </span>
                <button class="iconbtn" onClick={() => patchDay(k, (d) => ({ training: (d.training || []).filter((x) => x.id !== t.id) }))} aria-label="Training löschen">
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
                {[30, 45, 60, 90, 120].map((m) => (
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
            <button class="btn btn--block" onClick={addTraining}>
              <Check size={18} /> {tr.type} eintragen
            </button>
          </>
        )}
      </section>

      <section class="card">
        <h3 class="h3row">
          <HeartPulse size={18} /> Letzte 7 Tage
        </h3>
        <div class="week7">
          {last7.map((key) => {
            const d = getDay(key);
            const e = d.form && d.form.energy;
            return (
              <div class="week7__d">
                <span class="small muted">{WD_SHORT[parseKey(key).getDay()]}</span>
                <span class="week7__e">{e ? ENERGY[e - 1].e : '·'}</span>
                <span class="week7__t">{(d.training || []).length ? '🏋️' : ''}</span>
                {d.form && (d.form.pains || []).length > 0 && <span class="week7__p" title={(d.form.pains || []).map((p) => p.area).join(', ')} />}
              </div>
            );
          })}
        </div>
      </section>

      <section class="card soon">
        <Info size={18} />
        <div>
          <b>Trainingsplan kommt als Nächstes</b>
          <p class="small muted">Ein Plan nach deinem Ziel und deinen Trainingstagen, der sich automatisch an Tagesform und Schmerzen anpasst – inklusive Gewichte und Wiederholungen mitschreiben. Deine Einträge hier fließen dann direkt ein.</p>
        </div>
      </section>
    </div>
  );
}
