// Abgeschlossene Trainings nachträglich bearbeiten: Gewichte, Wdh., RIR, Sätze, Übungen, Dauer
import { useState } from 'preact/hooks';
import { useS, getDay, patchDay, toast, openSheet, closeSheet } from '../lib/store.js';
import { Sheet } from './common.jsx';
import { workoutLog, exOf } from '../lib/training.js';
import { fmtDayTitle, fmtShortDate, num, n1 } from '../lib/util.js';
import { Pencil, Plus, Trash2, X, History } from 'lucide-preact';

const str = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

/** Satzwerte als Text fürs Bearbeiten (Komma statt Punkt) */
const toDraft = (w) => ({
  minutes: String(w.minutes || ''),
  items: (w.items || []).map((it) => ({ ...it, sets: it.sets.map((s) => ({ w: str(s.w), r: str(s.r), rir: s.rir ?? null })) })),
});

export function editWorkout(dayKey, id) {
  openSheet('wedit', { dayKey, id });
}

export function WorkoutEditSheet({ dayKey, id, draft: start }) {
  const orig = (getDay(dayKey).workouts || []).find((w) => w.id === id);
  const [d, setD] = useState(() => start || (orig ? toDraft(orig) : null));
  if (!orig || !d) {
    return (
      <Sheet title="Training bearbeiten">
        <p class="muted">Dieses Training gibt es nicht mehr.</p>
      </Sheet>
    );
  }
  const upItem = (i, f) => setD((o) => ({ ...o, items: o.items.map((it, a) => (a !== i ? it : f(it))) }));
  const upSet = (i, j, p) => upItem(i, (it) => ({ ...it, sets: it.sets.map((s, b) => (b !== j ? s : { ...s, ...p })) }));
  const addSet = (i) => upItem(i, (it) => ({ ...it, sets: [...it.sets, { ...(it.sets[it.sets.length - 1] || { w: '', r: '', rir: null }) }] }));
  const delSet = (i, j) => upItem(i, (it) => ({ ...it, sets: it.sets.filter((_, b) => b !== j) }));
  const delItem = (i) => setD((o) => ({ ...o, items: o.items.filter((_, a) => a !== i) }));
  const addEx = () => {
    const keep = d;
    openSheet('pick', {
      title: 'Übung nachtragen',
      exclude: d.items.map((x) => x.exId),
      onPick: (exId) => {
        const ex = exOf(exId);
        const item = { exId: ex.id, name: ex.name, unit: ex.unit, targetRir: null, sets: [{ w: '', r: '', rir: null }], added: true };
        // Der Picker schließt sich nach der Auswahl – danach hier mit dem Zwischenstand weitermachen
        setTimeout(() => openSheet('wedit', { dayKey, id, draft: { ...keep, items: [...keep.items, item] } }), 40);
      },
    });
  };

  const clean = d.items
    .map((it) => ({ ...it, sets: it.sets.map((s) => ({ w: num(s.w), r: num(s.r), rir: s.rir ?? null, done: true })).filter((s) => s.r > 0) }))
    .filter((it) => it.sets.length);
  const minutes = Math.max(1, Math.round(num(d.minutes)) || orig.minutes || 1);

  const save = () => {
    if (!clean.length) return toast('Mindestens ein Satz mit Wiederholungen nötig – oder das Training löschen');
    const items = clean.map(({ added, ...it }) => it);
    patchDay(dayKey, (day) => ({
      workouts: (day.workouts || []).map((w) => (w.id !== id ? w : { ...w, items, minutes, finishedAt: w.startedAt ? w.startedAt + minutes * 60000 : w.finishedAt, edited: Date.now() })),
      training: (day.training || []).map((t) => (t.workoutId === id ? { ...t, minutes } : t)),
    }));
    closeSheet();
    toast('Training aktualisiert ✓');
  };
  const remove = () => {
    if (!confirm(`${orig.name} vom ${fmtShortDate(dayKey)} wirklich löschen?`)) return;
    patchDay(dayKey, (day) => ({ workouts: (day.workouts || []).filter((w) => w.id !== id), training: (day.training || []).filter((t) => t.workoutId !== id) }));
    closeSheet();
    toast('Training gelöscht');
  };

  return (
    <Sheet
      title="Training bearbeiten"
      tall
      footer={
        <div class="row">
          <button class="btn" onClick={remove} aria-label="Training löschen">
            <Trash2 size={18} />
          </button>
          <button class="btn btn--primary btn--grow btn--lg" onClick={save}>
            Speichern
          </button>
        </div>
      }
    >
      <div class="wed__head">
        <div>
          <b>{orig.name}</b>
          <span class="small muted">{fmtDayTitle(dayKey)}</span>
        </div>
        <label class="wed__min">
          <input class="input sets__in" inputMode="numeric" value={d.minutes} onInput={(e) => setD({ ...d, minutes: e.currentTarget.value })} aria-label="Dauer in Minuten" />
          <span class="small muted">Min.</span>
        </label>
      </div>
      <p class="small muted">Korrigiere, was du wirklich gemacht hast. Die nächsten Gewichte und dein Verlauf richten sich danach. Sätze ohne Wiederholungen werden beim Speichern weggelassen.</p>

      {d.items.map((it, i) => (
        <section class="card wed__ex">
          <div class="wed__exh">
            <h3>{it.name}</h3>
            <button class="iconbtn" onClick={() => delItem(i)} aria-label={`${it.name} entfernen`}>
              <Trash2 size={17} />
            </button>
          </div>
          <div class="sets">
            <div class="sets__h small muted">
              <span>Satz</span>
              <span>kg</span>
              <span>{it.unit || 'Wdh.'}</span>
              <span>{it.unit !== 'Sek.' ? 'RIR' : ''}</span>
              <span />
            </div>
            {it.sets.map((s, j) => (
              <div class="sets__row" key={j}>
                <span class="sets__n tnum">{j + 1}</span>
                <input class="input sets__in" inputMode="decimal" value={s.w} placeholder="–" onInput={(e) => upSet(i, j, { w: e.currentTarget.value })} aria-label={`${it.name} Gewicht Satz ${j + 1}`} />
                <input class="input sets__in" inputMode="numeric" value={s.r} placeholder="0" onInput={(e) => upSet(i, j, { r: e.currentTarget.value })} aria-label={`${it.name} Wiederholungen Satz ${j + 1}`} />
                {it.unit !== 'Sek.' ? (
                  <select class="input sets__in wed__rir" value={s.rir == null ? '' : String(s.rir)} onChange={(e) => upSet(i, j, { rir: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} aria-label={`${it.name} RIR Satz ${j + 1}`}>
                    <option value="">–</option>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3+</option>
                  </select>
                ) : (
                  <span />
                )}
                <button class="iconbtn" onClick={() => delSet(i, j)} aria-label={`${it.name} Satz ${j + 1} löschen`}>
                  <X size={17} />
                </button>
              </div>
            ))}
          </div>
          <button class="btn--link small" onClick={() => addSet(i)}>
            <Plus size={14} /> Satz
          </button>
        </section>
      ))}
      <button class="btn btn--block" onClick={addEx}>
        <Plus size={17} /> Übung nachtragen
      </button>
    </Sheet>
  );
}

/** Letzte abgeschlossene Trainings – antippen zum Bearbeiten */
export function WorkoutHistoryCard() {
  useS();
  const list = workoutLog()
    .filter((w) => (w.items || []).length)
    .slice(0, 6);
  if (!list.length) return null;
  return (
    <section class="card">
      <h3 class="h3row">
        <History size={18} /> Letzte Trainings
      </h3>
      <ul class="whist">
        {list.map((w) => {
          const sets = w.items.reduce((a, it) => a + it.sets.length, 0);
          const vol = w.items.reduce((a, it) => a + it.sets.reduce((b, s) => b + (s.w || 0) * (s.r || 0), 0), 0);
          return (
            <li>
              <button class="whist__row" onClick={() => editWorkout(w.date, w.id)} aria-label={`${w.name} vom ${fmtShortDate(w.date)} bearbeiten`}>
                <span class="whist__main">
                  <b>{w.name}</b>
                  <small class="muted">
                    {fmtDayTitle(w.date)} · {w.minutes} Min · {sets} Sätze{vol ? ` · ${vol >= 1000 ? n1(vol / 1000) + ' t' : Math.round(vol) + ' kg'}` : ''}
                    {w.edited ? ' · bearbeitet' : ''}
                    {w.imported ? ' · importiert' : ''}
                  </small>
                </span>
                <Pencil size={16} class="muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
