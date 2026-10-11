import { useState } from 'preact/hooks';
import { S, saveTraining, patchDay, toast, closeSheet } from '../lib/store.js';
import { parseImport, setupOf } from '../lib/training.js';
import { EXERCISES } from '../lib/exercises.js';
import { todayKey, uid, fmtShortDate, n1 } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { Check } from 'lucide-preact';
import { nav } from './router.js';

/** Plan & Gewichte per Code übernehmen (z. B. aus MCI abgetippt) */
export function ImportSheet() {
  const [text, setText] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [withDone, setWithDone] = useState(true);

  const check = () => {
    try {
      setD(parseImport(text));
      setErr(null);
    } catch (e) {
      setD(null);
      setErr(e.message);
    }
  };

  const apply = () => {
    const tr = S.training || {};
    const custom = { ...(tr.custom || {}) };
    Object.keys(d.sessions).forEach((sid) => (custom[sid] = null));
    const baseline = { ...(tr.baseline || {}) };
    Object.entries(d.baseline || {}).forEach(([id, v]) => {
      const o = typeof v === 'object' ? v : { w: v };
      baseline[id] = { ...o, date: d.date || todayKey(), src: d.src || 'Import' };
    });
    const st = setupOf();
    saveTraining({
      mySessions: { ...(tr.mySessions || {}), ...Object.fromEntries(Object.entries(d.sessions).map(([sid, ss]) => [sid, { name: ss.name, short: ss.short || ss.name, ex: ss.ex.map(([id, sets]) => ({ id, sets: sets || 3 })) }])) },
      myRotation: d.rotation || Object.keys(d.sessions),
      baseline,
      custom,
      setup: { ...st, planType: 'eigen', cycleStart: st.cycleStart || todayKey() },
      createdAt: tr.createdAt || Date.now(),
    });
    if (withDone && d.done) {
      const ss = d.sessions[d.done.session];
      const items = ss.ex
        .filter(([id]) => d.done.sets && d.done.sets[id])
        .map(([id]) => {
          const [w, n] = d.done.sets[id];
          const ex = EXERCISES[id];
          return { exId: id, name: ex.name, unit: ex.unit, sets: Array.from({ length: n }, () => ({ w, r: ex.reps[0], done: true })) };
        });
      const rec = { id: uid(), sessionId: d.done.session, name: ss.name, startedAt: Date.now(), finishedAt: Date.now(), minutes: d.done.minutes || 60, mode: 'normal', imported: true, source: d.src || 'Import', items };
      patchDay(d.done.date, (day) => ({
        workouts: [...(day.workouts || []).filter((w) => !w.imported), rec],
        training: [...(day.training || []).filter((t) => !t.imported), { id: uid(), type: 'Kraft', session: ss.name, minutes: rec.minutes, rpe: 'mittel', workoutId: rec.id, imported: true, at: Date.now() }],
      }));
    }
    toast('Plan & Gewichte übernommen 💪');
    closeSheet();
    nav('/training');
  };

  return (
    <Sheet
      title="Plan übernehmen"
      tall
      footer={
        d ? (
          <button class="btn btn--primary btn--block btn--lg" onClick={apply}>
            <Check size={18} /> Übernehmen
          </button>
        ) : (
          <button class="btn btn--primary btn--block" onClick={check} disabled={!text.trim()}>
            Code prüfen
          </button>
        )
      }
    >
      {!d && (
        <>
          <p class="small muted">Füge hier den Code ein, den du von Claude bekommen hast. Er enthält deine Einheiten, Übungen, Satzzahlen und aktuellen Gewichte.</p>
          <textarea class="input importbox" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Code hier einfügen …" />
          {err && <div class="notice notice--warn small">{err}</div>}
        </>
      )}
      {d && (
        <>
          <div class="notice notice--ok small">
            <Check size={16} />
            <span>
              Code gültig – {Object.keys(d.sessions).length} Einheiten, {Object.keys(d.baseline || {}).length} Startgewichte{d.src ? ` aus ${d.src}` : ''}.
            </span>
          </div>
          {(d.rotation || Object.keys(d.sessions)).map((sid) => {
            const ss = d.sessions[sid];
            return (
              <section class="card">
                <h3 style={{ marginBottom: '6px' }}>{ss.name}</h3>
                <ul class="expv">
                  {ss.ex.map(([id, sets]) => {
                    const b = d.baseline && d.baseline[id];
                    const w = b && (typeof b === 'object' ? b.w : b);
                    return (
                      <li>
                        <span class="expv__name">{EXERCISES[id].name}</span>
                        <span class="expv__t tnum">
                          {sets} Sätze{w ? ` · ${n1(w)} kg` : ' · Gewicht testen'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {d.done && (
            <label class="check">
              <input type="checkbox" checked={withDone} onChange={(e) => setWithDone(e.currentTarget.checked)} />
              {d.sessions[d.done.session].name} vom {fmtShortDate(d.done.date)} als erledigt eintragen
            </label>
          )}
          <p class="small muted">Wiederholungen wurden nicht mit übernommen – die App startet beim unteren Ende des Bereichs und steigert von dort. Dein Tagesform-Plan bleibt erhalten, du kannst unter „Plan anpassen“ jederzeit wechseln.</p>
          <button class="btn--link small" onClick={() => setD(null)}>
            Anderen Code einfügen
          </button>
        </>
      )}
    </Sheet>
  );
}
