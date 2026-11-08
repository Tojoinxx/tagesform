import { useState } from 'preact/hooks';
import { useS, S, saveTraining, toast, closeSheet, openSheet, saveActive } from '../lib/store.js';
import { setupOf, rotationOf, sessionOf, planIds, prefsOf, DEFAULT_PREFS, exOf, lastFor, usesMyPlan, defaultReps, goalOf, excludedMap, splitsFor, substitute, isAvailable, isExcluded, gridFrom, snapW } from '../lib/training.js';
import { EXERCISES, SESSIONS, SPLITS } from '../lib/exercises.js';
import { uid, todayKey, num, n1 } from '../lib/util.js';
import { Sheet, Chip, Seg, Field, NumInput } from './common.jsx';
import { ExAnim } from './exui.jsx';
import { ChevronLeft, ArrowUp, ArrowDown, Trash2, Plus, Pencil, ChevronRight, Check, RotateCcw, Copy, X } from 'lucide-preact';
import { nav } from './router.js';

const templates = () => {
  const st = setupOf();
  // Vorlagen gleich an deine Ausstattung anpassen (z. B. Zuhause nur Kurzhanteln)
  const fit = (ids) => {
    const out = [];
    ids.forEach((id) => {
      const x = isAvailable(id, st) && !isExcluded(id) ? id : (substitute(id, st, { taken: [...out, ...ids] }) || {}).id;
      if (x && !out.includes(x)) out.push(x);
    });
    return out;
  };
  const splits = splitsFor(st).map((x) => ({ id: x.id, name: x.name, hint: x.hint, sessions: [...new Set(x.rot)].map((sid) => [SESSIONS[sid].name, fit(SESSIONS[sid].ex)]) }));
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
  const duplicate = (id, i) => {
    const my = tr.mySessions[id];
    const ids = planIds(id);
    const sets = Object.fromEntries((my.ex || []).map((e) => [e.id, e.sets]));
    const n = my.name.replace(/\s*\(\d+\)$/, '') + ' (2)';
    const nid = 'my-' + uid().slice(0, 8);
    const r = rot.slice();
    r.splice(i + 1, 0, nid);
    save({ mySessions: { ...tr.mySessions, [nid]: { name: n, short: n.length > 8 ? n.slice(0, 7) + '.' : n, ex: ids.map((x) => ({ id: x, ...(sets[x] ? { sets: sets[x] } : {}) })) } }, myRotation: r });
    toast(`„${my.name}“ kopiert – umbenennen und Übungen anpassen`);
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
          <p class="small muted">Die Einheiten laufen in dieser Reihenfolge im Wechsel. Die App verteilt sie um deinen Sport auf deine Gym-Tage. Mit dem Kopieren-Symbol machst du z. B. aus einem Unterkörper-Tag zwei.</p>
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
                      <button class="iconbtn" onClick={() => duplicate(id, i)} aria-label="Kopieren">
                        <Copy size={17} />
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
  [3, 6],
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
  // Verfügbare Gewichte: frei (Schrittweite), Bereiche (von–bis in Schritten) oder einzeln
  const wc0 = o0.weights || null;
  const [wmode, setWmode] = useState(wc0 ? wc0.mode : 'free');
  const [ranges, setRanges] = useState(() => (wc0 && wc0.ranges ? wc0.ranges.map((g) => ({ from: n1(g.from), to: n1(g.to), step: n1(g.step) })) : [{ from: n1(cur.inc >= 2.5 ? 5 : cur.inc * 2 || 2), to: '100', step: n1(cur.inc || 2.5) }]));
  const [list, setList] = useState(() => (wc0 && wc0.list ? [...wc0.list] : []));
  const [addW, setAddW] = useState('');
  const [allSame, setAllSame] = useState(false);
  const wcfg = wmode === 'ranges' ? { mode: 'ranges', ranges: ranges.map((g) => ({ from: num(g.from), to: num(g.to), step: num(g.step) })) } : wmode === 'list' ? { mode: 'list', list } : null;
  const grid = wcfg ? gridFrom(wcfg) : null;
  const badRange = wmode === 'ranges' && wcfg.ranges.some((g) => !(g.step > 0) || !(g.to >= g.from));
  const last = lastFor(exId);
  const lastW = last ? Math.max(...last.sets.map((x) => x.w || 0)) : null;
  const [w, setW] = useState('');
  const save = () => {
    if (badRange) return toast('Bitte jede Reihe prüfen: „bis“ muss größer als „von“ sein und der Schritt größer 0.');
    if (wcfg && !grid) return toast('Bitte mindestens ein Gewicht angeben – oder „Frei“ wählen.');
    const tr = S.training || {};
    // Nur Abweichungen speichern – so passt sich der Rest weiter an dein Trainingsziel an
    const dr = defaultReps(exId);
    const sameReps = dr && reps[0] === dr[0] && reps[1] === dr[1];
    const mine = sets || !sameReps || inc !== base.inc || wcfg ? { sets: sets || null, reps: sameReps ? null : reps, inc: inc === base.inc ? null : inc, weights: wcfg } : null;
    const exOpts = { ...(tr.exOpts || {}), [exId]: mine };
    // gleiche Gewichte für alle Übungen mit demselben Gerätetyp (z. B. alle Maschinen im Studio)
    let others = 0;
    if (allSame && wcfg)
      for (const e of Object.values(EXERCISES))
        if (e.id !== exId && e.equip === base.equip && e.inc > 0) {
          exOpts[e.id] = { ...(exOpts[e.id] || {}), weights: wcfg };
          others++;
        }
    const patch = { exOpts };
    if (w !== '' && num(w) >= 0) patch.baseline = { ...(tr.baseline || {}), [exId]: { w: num(w), date: todayKey(), at: Date.now(), src: 'manuell', force: true } };
    saveTraining(patch);
    // Läuft gerade ein Training: offene Sätze direkt auf verfügbare Gewichte runden
    const a = S.active;
    if (a && a.items && wcfg) {
      const touched = (id) => id === exId || (allSame && EXERCISES[id] && EXERCISES[id].equip === base.equip);
      let ch = false;
      const items = a.items.map((it) => {
        if (!touched(it.exId) || !it.inc) return it;
        const fix = (w) => (w === '' || w == null || !(Number(w) > 0) ? w : snapW(it.exId, Number(w), it.inc));
        ch = true;
        return { ...it, target: it.target ? { ...it.target, w: fix(it.target.w) } : it.target, sets: it.sets.map((x) => (x.done ? x : { ...x, w: fix(x.w) })) };
      });
      if (ch) saveActive({ ...a, items });
    }
    toast(others ? `Gespeichert – auch für ${others} weitere Übungen (${base.equip})` : 'Gespeichert');
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
        <Field group label="Wiederholungsbereich" hint={`Standard für dein Ziel: ${defaultReps(exId)[0]}–${defaultReps(exId)[1]}. Die App steigert innerhalb dieses Bereichs.`}>
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
        <Field group label="Verfügbare Gewichte" hint="Die App schlägt nur Gewichte vor, die es an deinem Gerät bzw. bei deinen Hanteln wirklich gibt.">
          <Seg
            options={[
              { id: 'free', label: 'Frei' },
              { id: 'ranges', label: 'Bereiche' },
              { id: 'list', label: 'Einzeln' },
            ]}
            value={wmode}
            onChange={setWmode}
          />
          {wmode === 'free' && (
            <>
              <p class="small muted wav__lead">Schritt nach oben:</p>
              <div class="chips chips--wrap">
                {INC_PRESETS.map((v) => (
                  <Chip small active={inc === v} onClick={() => setInc(v)}>
                    +{String(v).replace('.', ',')} kg
                  </Chip>
                ))}
              </div>
            </>
          )}
          {wmode === 'ranges' && (
            <div class="wav">
              <div class="wav__h small muted">
                <span>von</span>
                <span>bis</span>
                <span>Schritte</span>
                <span />
              </div>
              {ranges.map((g, i) => {
                const up = (k, v) => setRanges(ranges.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                return (
                  <div class="wav__row" key={i}>
                    <NumInput value={g.from} onChange={(v) => up('from', v)} suffix="kg" aria-label={`Reihe ${i + 1} von`} />
                    <NumInput value={g.to} onChange={(v) => up('to', v)} suffix="kg" aria-label={`Reihe ${i + 1} bis`} />
                    <NumInput value={g.step} onChange={(v) => up('step', v)} suffix="kg" aria-label={`Reihe ${i + 1} Schritte`} />
                    <button class="iconbtn" onClick={() => setRanges(ranges.filter((_, j) => j !== i))} disabled={ranges.length < 2} aria-label={`Reihe ${i + 1} löschen`}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
              <button
                class="btn btn--block btn--sm"
                onClick={() => {
                  const l = ranges[ranges.length - 1];
                  const to = num(l && l.to) || 0;
                  const st = num(l && l.step) || 2.5;
                  setRanges([...ranges, { from: n1(to + st), to: n1(to + st * 10), step: n1(st) }]);
                }}
              >
                <Plus size={16} /> Reihe hinzufügen
              </button>
            </div>
          )}
          {wmode === 'list' && (
            <div class="wav">
              <div class="row">
                <NumInput value={addW} onChange={setAddW} placeholder="z. B. 17,5" suffix="kg" aria-label="Gewicht hinzufügen" />
                <button
                  class="btn btn--sm"
                  onClick={() => {
                    const v = num(addW);
                    if (!(v > 0)) return;
                    setList([...new Set([...list, v])].sort((a, b) => a - b));
                    setAddW('');
                  }}
                >
                  <Plus size={16} /> Hinzufügen
                </button>
              </div>
            </div>
          )}
          {grid && (
            <>
              <p class="small muted wav__lead">
                Deine Gewichte ({grid.length}){wmode === 'list' ? ' – antippen zum Entfernen' : ''}:
              </p>
              <div class="wav__chips">
                {grid.slice(0, 80).map((v) =>
                  wmode === 'list' ? (
                    <button class="wchip" onClick={() => setList(list.filter((x) => x !== v))} aria-label={`${n1(v)} kg entfernen`}>
                      {n1(v)} <X size={12} />
                    </button>
                  ) : (
                    <span class="wchip">{n1(v)}</span>
                  ),
                )}
                {grid.length > 80 && <span class="small muted">… und {grid.length - 80} weitere</span>}
              </div>
            </>
          )}
          {badRange && <p class="small warn">Eine Reihe passt nicht: „bis“ muss größer als „von“ sein, Schritt größer 0.</p>}
          {wcfg && /Maschine|Kabel|Kurzhantel/.test(base.equip) && (
            <label class="check small">
              <input type="checkbox" checked={allSame} onChange={(e) => setAllSame(e.currentTarget.checked)} /> Für alle Übungen mit „{base.equip}“ übernehmen
            </label>
          )}
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
  const stored = (S.training && S.training.prefs) || {};
  // nur geänderte Werte speichern; der Rest folgt deinem Trainingsziel
  const set = (patch) => saveTraining({ prefs: { ...stored, ...patch } });
  const g = goalOf();
  const ex = Object.keys(excludedMap()).filter((id) => excludedMap()[id] && EXERCISES[id]);
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
      <p class="small muted">Standard für dein Ziel „{g.label}“: {g.text}.</p>
      <Field group label="Pause bei Hauptübungen">
        <Seg value={String(p.restMain)} onChange={(v) => set({ restMain: Number(v) })} options={[60, 90, 120, 150, 180].map((v) => ({ id: String(v), label: v >= 120 ? `${v / 60} Min`.replace('.5', ',5') : `${v} s` }))} />
      </Field>
      <Field group label="Pause bei anderen Übungen">
        <Seg value={String(p.restOther)} onChange={(v) => set({ restOther: Number(v) })} options={[45, 60, 75, 90, 120].map((v) => ({ id: String(v), label: v === 120 ? '2 Min' : `${v} s` }))} />
      </Field>
      <Toggle k="supersets" label="Supersätze (Zeit sparen)" hint="Zwei Nebenübungen für verschiedene Muskeln im Wechsel, Pause erst nach beiden – spart ca. 20–30 % Zeit." />
      <Toggle k="warmup" label="Aufwärmsätze anzeigen" hint="Leichtere Sätze zum Abhaken vor der ersten Übung je Muskel – zählen nicht als Arbeitssätze." />
      <Toggle k="cycle" label="5-Wochen-Zyklus" hint="Intensität steigt über 4 Wochen, Woche 5 Erholung. Aus = gleichbleibend RIR 2." />
      <Toggle k="variety" label="Abwechslung" hint="Nebenübungen wechseln jede zweite Zyklusrunde zu einer Variante. Hauptübungen bleiben – für messbaren Fortschritt." />
      <Toggle k="wellness" label="Wellness-Abfrage vor dem Training" hint="Fitness, Schlaf, Muskelkater, Schmerzen – einmal pro Tag." />
      <Toggle k="rirPrompt" label="RIR nach jedem Satz abfragen" hint="Aus = du kannst RIR trotzdem über das Batterie-Symbol eintragen." />
      <Toggle k="keepAwake" label="Bildschirm im Training anlassen" hint="Das iPhone geht während des Trainings nicht in den Standby." />
      <Toggle k="restSound" label="Ton am Ende der Pause" hint="Kurzer Doppelton (zusätzlich zur Vibration), solange die App offen ist." />
      <Toggle k="rpFeedback" label="Kurz-Feedback nach jeder Übung" hint="Pump, Belastung, Gelenke – 3 Tipps. Daraus passt die App die Sätze pro Muskel an (wie RP Hypertrophy): mehr, wenn es locker war, weniger, wenn es zu viel war." />
      <Toggle k="autoAdjust" label="Sätze live anpassen" hint="War ein Satz viel zu schwer (Limit erreicht oder 2+ Wdh. zu wenig), werden die restlichen Sätze leichter – war der erste viel zu leicht, schwerer." />
      <Toggle k="comeback" label="Wiedereinstieg nach Pausen" hint="Nach 10+ Tagen ohne Training erst leichter starten." />
      {ex.length > 0 && (
        <Field group label="Nicht mehr vorgeschlagen">
          <div class="chips chips--wrap">
            {ex.map((id) => (
              <Chip small onClick={() => (saveTraining({ excluded: { ...excludedMap(), [id]: null } }), toast(`${EXERCISES[id].name} wieder erlaubt`))}>
                {EXERCISES[id].name} ✕
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <button class="btn--link small" onClick={() => (saveTraining({ prefs: Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, null])) }), toast('Standardwerte für dein Ziel'))}>
        Standardwerte wiederherstellen
      </button>
    </section>
  );
}
