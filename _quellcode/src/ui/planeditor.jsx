import { useState } from 'preact/hooks';
import { useS, S, saveTraining, toast, closeSheet, openSheet } from '../lib/store.js';
import { setupOf, rotationOf, sessionOf, planIds, prefsOf, DEFAULT_PREFS, exOf, lastFor, usesMyPlan } from '../lib/training.js';
import { EXERCISES, SESSIONS, SPLITS } from '../lib/exercises.js';
import { uid, todayKey, num, n1 } from '../lib/util.js';
import { Sheet, Chip, Seg, Field, NumInput } from './common.jsx';
import { ExAnim } from './exui.jsx';
import { ChevronLeft, ArrowUp, ArrowDown, Trash2, Plus, Pencil, ChevronRight, Check, RotateCcw } from 'lucide-preact';
import { nav } from './router.js';

const templates = () => {
  const st = setupOf();
  const splits = (SPLITS[st.perWeek] || SPLITS[3]).map((x) => ({ id: x.id, name: x.name, hint: x.hint, sessions: [...new Set(x.rot)].map((sid) => [SESSIONS[sid].name, SESSIONS[sid].ex]) }));
  return [
    { id: 'copy', name: 'Aktuellen Plan übernehmen', hint: 'Deine jetzigen Einheiten als Startpunkt' },
    ...splits,
    { id: 'leer', name: 'Leer starten', hint: 'Eine leere Einheit, Übungen selbst wählen', sessions: [['Einheit 1', []]] },
  ];
};

function applyTemplate(t) {
  const tr = S.training || {};
  let list;
  if (t.id === 'copy') list = [...new Set(rotationOf(setupOf()))].map((sid) => [sessionOf(sid).name, planIds(sid)]);
  else list = t.sessions;
  const mySessions = { ...(tr.mySessions || {}) };
  Object.keys(mySessions).forEach((k) => (mySessions[k] = null));
  const custom = { ...(tr.custom || {}) };
  const rot = list.map(([name, ids]) => {
    const id = 'my-' + uid().slice(0, 8);
    mySessions[id] = { name, short: name.length > 8 ? name.slice(0, 7) + '.' : name, ex: ids.map((x) => ({ id: x })) };
    custom[id] = null;
    return id;
  });
  saveTraining({ mySessions, myRotation: rot, custom, setup: { ...setupOf(), planType: 'eigen' } });
  toast('Eigener Plan erstellt');
}

/** Eigene Einheiten verwalten */
export function PlanEditor() {
  const s = useS();
  const tr = s.training || {};
  const rot = (tr.myRotation || []).filter((id) => tr.mySessions && tr.mySessions[id]);
  const [editName, setEditName] = useState(null);
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const save = (patch) => saveTraining(patch);
  const rename = (id, nm) => {
    const my = tr.mySessions[id];
    const n = nm.trim() || my.name;
    save({ mySessions: { ...tr.mySessions, [id]: { ...my, name: n, short: n.length > 8 ? n.slice(0, 7) + '.' : n } } });
    setEditName(null);
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rot.length) return;
    const r = rot.slice();
    [r[i], r[j]] = [r[j], r[i]];
    save({ myRotation: r });
  };
  const remove = (id) => {
    if (!confirm(`„${tr.mySessions[id].name}“ löschen?`)) return;
    const r = rot.filter((x) => x !== id);
    save({ mySessions: { ...tr.mySessions, [id]: null }, myRotation: r, ...(r.length ? {} : { setup: { ...setupOf(), planType: 'auto' } }) });
  };
  const add = () => {
    const n = newName.trim() || `Einheit ${rot.length + 1}`;
    const id = 'my-' + uid().slice(0, 8);
    save({ mySessions: { ...(tr.mySessions || {}), [id]: { name: n, short: n.length > 8 ? n.slice(0, 7) + '.' : n, ex: [] } }, myRotation: [...rot, id], setup: { ...setupOf(), planType: 'eigen' } });
    setNewName('');
    nav('/einheit?s=' + id);
  };

  return (
    <div class="page">
      <header class="sesshead">
        <button class="iconbtn" onClick={() => nav('/training')} aria-label="Zurück">
          <ChevronLeft size={24} />
        </button>
        <h1>Mein Plan</h1>
      </header>

      {!rot.length ? (
        <>
          <p class="muted">Stell dir deinen Plan selbst zusammen. Wähle einen Startpunkt – Übungen, Sätze und Reihenfolge kannst du danach frei ändern.</p>
          <div class="opts">
            {templates().map((t) => (
              <button class="opt" onClick={() => applyTemplate(t)}>
                <b>{t.name}</b>
                <span>{t.hint}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p class="small muted">Die Einheiten laufen in dieser Reihenfolge im Wechsel. Die App verteilt sie um deinen Sport auf deine Gym-Tage.</p>
          {rot.map((id, i) => {
            const ss = sessionOf(id);
            return (
              <section class="card myses">
                <div class="myses__head">
                  {editName === id ? (
                    <form
                      class="row"
                      style={{ flex: 1 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename(id, name);
                      }}
                    >
                      <input class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} autoFocus aria-label="Name der Einheit" />
                      <button class="btn btn--sm btn--primary" type="submit">
                        <Check size={16} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div class="myses__title">
                        <b>{ss.name}</b>
                        <span class="small muted">{ss.ex.length} Übungen</span>
                      </div>
                      <button
                        class="iconbtn"
                        onClick={() => {
                          setEditName(id);
                          setName(ss.name);
                        }}
                        aria-label="Umbenennen"
                      >
                        <Pencil size={17} />
                      </button>
                      <button class="iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nach oben">
                        <ArrowUp size={17} />
                      </button>
                      <button class="iconbtn" onClick={() => move(i, 1)} disabled={i === rot.length - 1} aria-label="Nach unten">
                        <ArrowDown size={17} />
                      </button>
                      <button class="iconbtn danger" onClick={() => remove(id)} aria-label="Löschen">
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
                <div class="sesscard__thumbs">
                  {ss.ex.slice(0, 6).map((x) => (
                    <ExAnim id={x} size="xs" play={false} />
                  ))}
                </div>
                <button class="btn btn--sm" onClick={() => nav('/einheit?s=' + id)}>
                  Übungen bearbeiten <ChevronRight size={16} />
                </button>
              </section>
            );
          })}
          <form
            class="row"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input class="input" placeholder={`Neue Einheit, z. B. Arme & Schultern`} value={newName} onInput={(e) => setNewName(e.currentTarget.value)} />
            <button class="btn btn--sm btn--primary" type="submit">
              <Plus size={16} /> Einheit
            </button>
          </form>
          <details class="more">
            <summary>Neu anfangen mit einer Vorlage</summary>
            <div class="opts">
              {templates().filter((t) => t.id !== 'copy').map((t) => (
                <button class="opt" onClick={() => confirm('Deine eigenen Einheiten werden ersetzt. Fortfahren?') && applyTemplate(t)}>
                  <b>{t.name}</b>
                  <span>{t.hint}</span>
                </button>
              ))}
            </div>
          </details>
          {!usesMyPlan(setupOf()) && (
            <div class="notice notice--warn small">
              <span>
                Aktuell nutzt du den Tagesform-Plan.{' '}
                <button class="btn--link small" onClick={() => saveTraining({ setup: { ...setupOf(), planType: 'eigen' } })}>
                  Meinen Plan verwenden
                </button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const REP_PRESETS = [
  [5, 8],
  [6, 10],
  [8, 12],
  [10, 15],
  [12, 20],
  [15, 20],
];
const INC_PRESETS = [0.5, 1, 1.25, 2, 2.5, 5];

/** Übung persönlich einstellen: Sätze, Wdh.-Bereich, Steigerung, Gewicht */
export function ExOptsSheet({ exId }) {
  const base = EXERCISES[exId];
  const cur = exOf(exId);
  const o0 = (S.training && S.training.exOpts && S.training.exOpts[exId]) || {};
  const [sets, setSets] = useState(o0.sets || 0);
  const [reps, setReps] = useState(cur.reps);
  const [inc, setInc] = useState(cur.inc);
  const last = lastFor(exId);
  const lastW = last ? Math.max(...last.sets.map((x) => x.w || 0)) : null;
  const [w, setW] = useState('');
  const save = () => {
    const tr = S.training || {};
    const patch = { exOpts: { ...(tr.exOpts || {}), [exId]: { sets: sets || null, reps, inc } } };
    if (w !== '' && num(w) >= 0) patch.baseline = { ...(tr.baseline || {}), [exId]: { w: num(w), date: todayKey(), at: Date.now(), src: 'manuell', force: true } };
    saveTraining(patch);
    toast('Gespeichert');
    closeSheet();
  };
  const reset = () => {
    const tr = S.training || {};
    saveTraining({ exOpts: { ...(tr.exOpts || {}), [exId]: null } });
    toast('Auf Standard zurückgesetzt');
    closeSheet();
  };
  return (
    <Sheet
      title="Übung einstellen"
      footer={
        <div class="row">
          <button class="btn" onClick={reset} aria-label="Zurücksetzen">
            <RotateCcw size={16} />
          </button>
          <button class="btn btn--primary btn--grow" onClick={save}>
            Speichern
          </button>
        </div>
      }
    >
      <div class="row">
        <ExAnim id={exId} size="xs" play={false} />
        <b>{base.name}</b>
      </div>
      <Field group label="Sätze">
        <div class="chips chips--wrap">
          <Chip small active={!sets} onClick={() => setSets(0)}>
            Automatisch
          </Chip>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip small active={sets === n} onClick={() => setSets(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </Field>
      {base.unit !== 'Sek.' && (
        <Field group label="Wiederholungsbereich" hint={`Standard: ${base.reps[0]}–${base.reps[1]}. Die App steigert innerhalb dieses Bereichs.`}>
          <div class="chips chips--wrap">
            {REP_PRESETS.map((r) => (
              <Chip small active={reps[0] === r[0] && reps[1] === r[1]} onClick={() => setReps(r)}>
                {r[0]}–{r[1]}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {base.inc > 0 && (
        <Field group label="Gewichtssteigerung" hint="Kleinster Schritt an deinem Gerät bzw. deinen Hanteln.">
          <div class="chips chips--wrap">
            {INC_PRESETS.map((v) => (
              <Chip small active={inc === v} onClick={() => setInc(v)}>
                +{String(v).replace('.', ',')} kg
              </Chip>
            ))}
          </div>
        </Field>
      )}
      {S.active && <p class="small muted">Gilt ab dem nächsten Training.</p>}
      <Field label="Gewicht für nächstes Mal festlegen (optional)" hint={lastW ? `Aktuell: ${n1(lastW)} kg` : 'Noch kein Gewicht hinterlegt.'}>
        <NumInput value={w} onChange={setW} placeholder={lastW ? n1(lastW) : 'z. B. 40'} suffix="kg" />
      </Field>
    </Sheet>
  );
}

/** Trainings-Optionen (Pausen, Zyklus, Abfragen) */
export function TrainingOptionsCard() {
  useS();
  const p = prefsOf();
  const set = (patch) => saveTraining({ prefs: { ...p, ...patch } });
  const Toggle = ({ k, label, hint }) => (
    <label class="toggle">
      <span>
        <b>{label}</b>
        {hint && <small class="muted">{hint}</small>}
      </span>
      <input type="checkbox" checked={!!p[k]} onChange={(e) => set({ [k]: e.currentTarget.checked })} />
    </label>
  );
  return (
    <section class="card form">
      <h3>Weitere Einstellungen</h3>
      <Field group label="Pause bei Hauptübungen">
        <Seg value={String(p.restMain)} onChange={(v) => set({ restMain: Number(v) })} options={[60, 90, 120, 150, 180].map((v) => ({ id: String(v), label: v >= 120 ? `${v / 60} Min`.replace('.5', ',5') : `${v} s` }))} />
      </Field>
      <Field group label="Pause bei anderen Übungen">
        <Seg value={String(p.restOther)} onChange={(v) => set({ restOther: Number(v) })} options={[45, 60, 75, 90, 120].map((v) => ({ id: String(v), label: v === 120 ? '2 Min' : `${v} s` }))} />
      </Field>
      <Toggle k="cycle" label="5-Wochen-Zyklus" hint="Intensität steigt über 4 Wochen, Woche 5 Erholung. Aus = gleichbleibend RIR 2." />
      <Toggle k="wellness" label="Wellness-Abfrage vor dem Training" hint="Fitness, Schlaf, Muskelkater, Schmerzen – einmal pro Tag." />
      <Toggle k="rirPrompt" label="RIR nach jedem Satz abfragen" hint="Aus = du kannst RIR trotzdem über das Batterie-Symbol eintragen." />
      <Toggle k="comeback" label="Wiedereinstieg nach Pausen" hint="Nach 10+ Tagen ohne Training erst leichter starten." />
      <button class="btn--link small" onClick={() => saveTraining({ prefs: { ...DEFAULT_PREFS } })}>
        Standardwerte wiederherstellen
      </button>
    </section>
  );
}
