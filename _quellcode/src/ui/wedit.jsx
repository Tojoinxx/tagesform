// Abgeschlossene Trainings nachträglich bearbeiten: Gewichte, Wdh., RIR, Sätze, Übungen, Dauer
import { useState } from 'preact/hooks';
import { useS, S, getDay, patchDay, toast, openSheet, closeSheet, saveTraining, saveActive } from '../lib/store.js';
import { Sheet } from './common.jsx';
import { workoutLog, exOf } from '../lib/training.js';
import { NumInput } from './common.jsx';
import { fmtDayTitle, fmtShortDate, num, n1 } from '../lib/util.js';
import { Pencil, Plus, Trash2, X, History } from 'lucide-preact';
import { ExAnim } from './exui.jsx';
import { guideOf } from '../lib/exguide.js';

const str = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

/** Satzwerte als Text fürs Bearbeiten (Komma statt Punkt) */
const toDraft = (w) => ({
  minutes: String(w.minutes || ''),
  items: (w.items || []).map((it) => ({ ...it, sets: it.sets.map((s) => ({ w: str(s.w), r: str(s.r), rir: s.rir ?? null, ...(s.type ? { type: s.type } : {}) })) })),
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
    .map((it) => ({ ...it, sets: it.sets.map((s) => ({ w: num(s.w), r: num(s.r), rir: s.rir ?? null, done: true, ...(s.type ? { type: s.type } : {}) })).filter((s) => s.r > 0) }))
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
            <ExAnim id={it.exId} size="xs" play={false} />
            <div class="wed__ext">
              <span class="excard__group">{guideOf(it.exId).group}</span>
              <h3>{it.name}</h3>
            </div>
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
                <span class={'sets__n tnum' + (s.type ? ' sets__type--' + s.type : '')}>{s.type === 'drop' ? 'D' : s.type === 'fail' ? 'V' : j + 1}</span>
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

/**
 * Gewichte einer Übung im Verlauf korrigieren – z. B. Stange vergessen (nur Scheiben gezählt → +20 kg).
 * Wirkt auf ausgewählte Trainings, den Startwert und ein laufendes Training.
 */
export function WeightFixSheet({ exId }) {
  useS();
  const ex = exOf(exId);
  const bar = /Langhantel/.test(ex.equip || '');
  const [delta, setDelta] = useState(bar ? '20' : '');
  const list = workoutLog().filter((w) => (w.items || []).some((it) => it.exId === exId && (it.sets || []).length));
  const [sel, setSel] = useState(() => Object.fromEntries(list.map((w) => [w.date + '|' + w.id, true])));
  const base = S.training && S.training.baseline && S.training.baseline[exId];
  const [fixBase, setFixBase] = useState(!!(base && base.w != null));
  const act = S.active && S.active.items && S.active.items.find((it) => it.exId === exId);
  const [fixAct, setFixAct] = useState(!!act);
  const d = num(delta);
  const n = Object.values(sel).filter(Boolean).length;
  const add = (w) => Math.max(0, Math.round(((Number(w) || 0) + d) * 100) / 100);
  const apply = () => {
    if (!d) return toast('Bitte angeben, um wie viel kg korrigiert werden soll');
    if (!n && !fixBase && !fixAct) return toast('Nichts ausgewählt');
    for (const w of list) {
      if (!sel[w.date + '|' + w.id]) continue;
      patchDay(w.date, (day) => ({
        workouts: (day.workouts || []).map((x) => (x.id !== w.id ? x : { ...x, edited: Date.now(), items: x.items.map((it) => (it.exId !== exId ? it : { ...it, sets: it.sets.map((s) => ({ ...s, w: add(s.w) })) })) })),
      }));
    }
    if (fixBase && base) saveTraining({ baseline: { ...S.training.baseline, [exId]: { ...base, w: add(base.w) } } });
    if (fixAct && act) {
      const a = S.active;
      saveActive({
        ...a,
        items: a.items.map((it) => {
          if (it.exId !== exId) return it;
          const f = (w) => (w === '' || w == null ? w : add(String(w).replace(',', '.')));
          return { ...it, target: it.target ? { ...it.target, w: add(it.target.w) } : it.target, sets: it.sets.map((s) => ({ ...s, w: f(s.w) })) };
        }),
      });
    }
    closeSheet();
    toast(`${ex.name}: ${n} ${n === 1 ? 'Training' : 'Trainings'} um ${d > 0 ? '+' : ''}${n1(d)} kg korrigiert ✓`);
  };
  return (
    <Sheet
      title="Gewichte korrigieren"
      tall
      footer={
        <button class="btn btn--primary btn--block btn--lg" onClick={apply} disabled={!d}>
          {d ? `${d > 0 ? '+' : ''}${n1(d)} kg bei ${n} ${n === 1 ? 'Training' : 'Trainings'} übernehmen` : 'Korrektur eingeben'}
        </button>
      }
    >
      <p>
        <b>{ex.name}</b>
      </p>
      {bar && (
        <p class="small">
          Die App rechnet bei Langhantel-Übungen immer mit dem <b>Gesamtgewicht inkl. Stange (20 kg)</b>. Wenn du nur die Scheiben gezählt hast (z. B. 35 statt 55 kg), korrigiere hier mit <b>+20 kg</b>.
        </p>
      )}
      <label class="field">
        <span class="small muted">Jeden Satz ändern um</span>
        <div class="row">
          {bar && (
            <button class={'chip chip--sm' + (d === 20 ? ' chip--on' : '')} onClick={() => setDelta('20')}>
              +20 kg (Stange)
            </button>
          )}
          <NumInput value={delta} onChange={setDelta} suffix="kg" placeholder="z. B. 20 oder -10" aria-label="Korrektur in kg" />
        </div>
      </label>
      <h4 class="sect">Welche Trainings?</h4>
      <div class="row small">
        <button class="btn--link small" onClick={() => setSel(Object.fromEntries(list.map((w) => [w.date + '|' + w.id, true])))}>
          alle
        </button>
        <button class="btn--link small" onClick={() => setSel({})}>
          keine
        </button>
      </div>
      <ul class="wfix">
        {list.map((w) => {
          const key = w.date + '|' + w.id;
          const it = w.items.find((x) => x.exId === exId);
          const ws = [...new Set(it.sets.map((s) => Number(s.w) || 0))];
          return (
            <li>
              <label class="wfix__row">
                <input type="checkbox" checked={!!sel[key]} onChange={(e) => setSel({ ...sel, [key]: e.currentTarget.checked })} />
                <span class="wfix__main">
                  <b>{fmtDayTitle(w.date)}</b>
                  <small class="muted">
                    {it.sets.length} Sätze · {ws.map((x) => n1(x)).join(' / ')} kg
                    {sel[key] && d ? <span class="wfix__to"> → {ws.map((x) => n1(add(x))).join(' / ')} kg</span> : null}
                  </small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {base && base.w != null && (
        <label class="check small">
          <input type="checkbox" checked={fixBase} onChange={(e) => setFixBase(e.currentTarget.checked)} /> Auch den Startwert aus dem Import korrigieren ({n1(base.w)} → {n1(add(base.w))} kg)
        </label>
      )}
      {act && (
        <label class="check small">
          <input type="checkbox" checked={fixAct} onChange={(e) => setFixAct(e.currentTarget.checked)} /> Auch im laufenden Training anpassen
        </label>
      )}
      <p class="small muted">Danach richten sich Vorschläge, Rekorde, Kraftverlauf und Kraftniveau nach den korrigierten Werten.</p>
    </Sheet>
  );
}
