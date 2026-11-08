import { useEffect, useRef, useState } from 'preact/hooks';
import { useS, S, saveActive, clearActive, patchDay, toast, getDay, openSheet, closeSheet, saveTraining } from '../lib/store.js';
import { EXERCISES } from '../lib/exercises.js';
import { Sheet } from './common.jsx';
import { ExAnim, ExNote } from './exui.jsx';
import { guideOf } from '../lib/exguide.js';
import { swapOptions, itemFor, prefsOf, warmupFor, platesFor, limitsOf, liveAdjust, planIds, repsAt, priMg, MUSCLE_LABEL, applyFeedback, soreOf } from '../lib/training.js';
import { buildSummary } from './progress.jsx';
import { uid, n1, num, vibrate, fmtShortDate } from '../lib/util.js';
import { Check, Plus, Info, Repeat, X, Timer, Flag, Trash2, ExternalLink, Search, Flame } from 'lucide-preact';
import { nav } from './router.js';

/** Batterie wie bei MCI: 0 = leer (am Limit) … 3+ = voll (viel Reserve) */
export function Battery({ v, size = 26 }) {
  const has = v != null && v !== '';
  const n = has ? Math.min(3, Number(v)) : 0;
  const col = !has ? 'var(--line)' : n === 0 ? 'var(--danger)' : n === 1 ? 'var(--c)' : n === 2 ? 'var(--text)' : 'var(--fv)';
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 26 14" aria-hidden="true" class="battery">
      <rect x="1" y="1" width="21" height="12" rx="3" fill="none" stroke={col} stroke-width="1.8" />
      <rect x="22.5" y="4.5" width="2.5" height="5" rx="1" fill={col} />
      {[0, 1, 2].map((k) => k < n && <rect x={3.5 + k * 6} y="3.5" width="4.6" height="7" rx="1.2" fill={col} />)}
      {!has && <text x="11.5" y="10.5" font-size="8" text-anchor="middle" fill="var(--muted)">–</text>}
    </svg>
  );
}

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function lastText(it) {
  if (!it.last) return null;
  const sets = it.last.sets;
  const same = sets.every((s) => s.w === sets[0].w);
  const reps = sets.map((s) => s.r).join(' / ');
  return `${fmtShortDate(it.last.date)}: ${reps} ${it.unit}${sets[0].w ? (same ? ` · ${n1(sets[0].w)} kg` : ` · bis ${n1(Math.max(...sets.map((s) => s.w || 0)))} kg`) : ''}`;
}

// ---------- Ton am Pausenende ----------
let actx = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}
function beep() {
  try {
    if (!actx) return;
    const t0 = actx.currentTime;
    [0, 0.22].forEach((d, k) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = k ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(actx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch (e) {}
}

// ---------- Änderungen am Plan erkennen ----------
/** Was wurde heute anders gemacht als geplant? (selbst getauscht, weggelassen, hinzugefügt, Satzzahl geändert) */
const FB_Q = [
  { k: 'pump', q: 'Pump im Muskel', o: [['wenig', 'wenig'], ['gut', 'gut'], ['stark', 'stark']] },
  { k: 'work', q: 'Belastung insgesamt', o: [['leicht', 'zu leicht'], ['passt', 'passt'], ['viel', 'zu viel']] },
  { k: 'joint', q: 'Gelenke', o: [['gut', 'gut'], ['zwickt', 'zwickt'], ['schmerz', 'Schmerz']] },
];
/** Kurz-Feedback nach der letzten Übung eines Muskels (wie RP Hypertrophy) */
function FbCard({ it, onSet }) {
  const fb = it.fb || {};
  const mg = MUSCLE_LABEL[priMg(it.exId)] || 'Muskel';
  const set = (k, v) => {
    const n = { ...fb, [k]: v };
    onSet({ ...n, done: FB_Q.every((x) => n[x.k]) });
  };
  return (
    <div class="fbcard">
      <div class="fbcard__h">
        <b>Kurz-Feedback {mg}</b>
        <button class="btn--link small muted" onClick={() => onSet({ ...fb, done: true, skipped: true })}>
          überspringen
        </button>
      </div>
      {FB_Q.map((x) => (
        <div class="fbcard__q">
          <span class="small">{x.q}</span>
          <div class="fbcard__o">
            {x.o.map(([v, l]) => (
              <button class={'chip chip--sm' + (fb[x.k] === v ? ' chip--on' : '')} onClick={() => set(x.k, v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p class="small muted">Daraus passt die App die Sätze für {mg} beim nächsten Mal an.</p>
    </div>
  );
}

const TYPE_LABEL = { '': 'normaler Satz', drop: 'Dropsatz', fail: 'bis zum Versagen' };

export function planChanges(w) {
  const out = [];
  const plan = planIds(w.sessionId);
  (w.items || []).forEach((it) => {
    const done = (it.sets || []).filter((x) => x.done).length;
    if (it.swappedFromId && it.swappedFromId !== it.exId && plan.includes(it.swappedFromId) && done > 0)
      out.push({ id: 'swap:' + it.swappedFromId, kind: 'swap', from: it.swappedFromId, to: it.exId, text: `${EXERCISES[it.swappedFromId] ? EXERCISES[it.swappedFromId].name : it.swappedFrom} → ${it.name}`, on: true });
    else if (it.added && done > 0 && !plan.includes(it.exId)) out.push({ id: 'add:' + it.exId, kind: 'add', to: it.exId, text: `${it.name} dazu`, on: true });
    else if (!done && !it.added && plan.includes(it.swappedFromId || it.exId)) out.push({ id: 'skip:' + (it.swappedFromId || it.exId), kind: 'skip', from: it.swappedFromId || it.exId, text: `${it.name} weglassen`, on: false });
    if (done > 0 && it.sets0 != null && it.sets.length !== it.sets0 && done === it.sets.length)
      out.push({ id: 'sets:' + it.exId, kind: 'sets', ex: it.exId, n: done, text: `${it.name}: ${done} statt ${it.sets0} Sätze`, on: true });
  });
  return out;
}

/** Nach dem Training: Änderungen fürs nächste Mal übernehmen oder ignorieren */
export function PlanChangesSheet({ sessionId, name, changes: ch0, summary }) {
  const [ch, setCh] = useState(ch0);
  const toggle = (id) => setCh((l) => l.map((c) => (c.id === id ? { ...c, on: !c.on } : c)));
  const next = () => (closeSheet(), setTimeout(() => openSheet('summary', summary), 30));
  const apply = () => {
    const on = ch.filter((c) => c.on);
    const tr = S.training || {};
    let ids = planIds(sessionId);
    const before = ids.join();
    on.forEach((c) => {
      if (c.kind === 'swap') ids = ids.includes(c.to) ? ids.filter((x) => x !== c.from) : ids.map((x) => (x === c.from ? c.to : x));
      if (c.kind === 'skip') ids = ids.filter((x) => x !== c.from);
      if (c.kind === 'add' && !ids.includes(c.to)) ids = [...ids, c.to];
    });
    const patch = {};
    if (ids.join() !== before) patch.custom = { ...(tr.custom || {}), [sessionId]: ids };
    const sets = on.filter((c) => c.kind === 'sets');
    if (sets.length) {
      const exOpts = { ...(tr.exOpts || {}) };
      sets.forEach((c) => (exOpts[c.ex] = { ...(exOpts[c.ex] || {}), sets: c.n }));
      patch.exOpts = exOpts;
    }
    if (Object.keys(patch).length) saveTraining(patch);
    toast(on.length ? `${on.length} ${on.length === 1 ? 'Änderung' : 'Änderungen'} für „${name}“ übernommen` : 'Plan bleibt wie er war');
    next();
  };
  const icon = { swap: '⇄', skip: '−', add: '+', sets: '#' };
  return (
    <Sheet title="Plan fürs nächste Mal anpassen?" onClose={next}>
      <p class="small muted">Du hast heute bei „{name}“ etwas anders gemacht als geplant. Was davon soll ab dem nächsten Mal gelten?</p>
      <ul class="pchg">
        {ch.map((c) => (
          <li>
            <label class="check pchg__row">
              <input type="checkbox" checked={c.on} onChange={() => toggle(c.id)} />
              <span class={'pchg__ic pchg__ic--' + c.kind}>{icon[c.kind]}</span>
              <span>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <button class="btn btn--primary btn--block btn--lg" onClick={apply} disabled={!ch.some((c) => c.on)}>
        <Check size={18} /> Ausgewählte übernehmen
      </button>
      <button class="btn btn--block" style={{ marginTop: '8px' }} onClick={() => (toast('Plan bleibt wie er war'), next())}>
        Ignorieren – war nur heute
      </button>
      <p class="small muted" style={{ marginTop: '10px' }}>Später änderbar unter Training → Einheit ansehen & anpassen.</p>
    </Sheet>
  );
}

export function Workout() {
  const s = useS();
  const [w, setW] = useState(() => (S.active ? JSON.parse(JSON.stringify(S.active)) : null));
  const [now, setNow] = useState(Date.now());
  const [rest, setRestRaw] = useState(() => (S.active && S.active.rest && S.active.rest.until > Date.now() ? S.active.rest : null)); // {until, total}
  const [swapFor, setSwapFor] = useState(null);
  const [cueFor, setCueFor] = useState(null);
  const [rirOpen, setRirOpen] = useState(null); // {i, j}
  const saveT = useRef();

  // App frisch geöffnet: laufendes Training kommt evtl. erst kurz nach dem Start aus der Datenbank
  useEffect(() => {
    if (!w && s.active) setW(JSON.parse(JSON.stringify(s.active)));
    else if (!w && !s.active && s.activeLoaded) nav('/training');
  }, [s.active, s.activeLoaded]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (rest && now >= rest.until) {
      vibrate([80, 60, 80]);
      if (prefsOf().restSound) beep();
      setRest(null);
    }
  }, [now]);
  // Bildschirm bleibt an, solange das Training offen ist (iOS gibt die Sperre beim App-Wechsel frei → neu anfordern)
  useEffect(() => {
    if (!prefsOf().keepAwake || !('wakeLock' in navigator)) return;
    let lock = null;
    let on = true;
    const get = async () => {
      try {
        if (on && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch (e) {}
    };
    get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => {
      on = false;
      document.removeEventListener('visibilitychange', vis);
      try {
        lock && lock.release();
      } catch (e) {}
    };
  }, []);
  // Ton erst nach einem Tipp möglich (iOS) → bei jeder Berührung im Training freischalten
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('click', unlock);
    return () => {
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  if (!w) return null;

  const persist = (next, immediate) => {
    setW(next);
    clearTimeout(saveT.current);
    if (immediate) saveActive(next);
    else saveT.current = setTimeout(() => saveActive(next), 700);
  };
  // Pause auch im gespeicherten Training merken (überlebt Neuladen / App-Wechsel)
  const setRest = (r, base = w) => {
    setRestRaw(r);
    persist({ ...base, rest: r || null }, false);
  };
  const scrollToEx = (i) => setTimeout(() => document.getElementById('wex-' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  const upSet = (i, j, patch, immediate) => {
    const next = { ...w, items: w.items.map((it, a) => (a !== i ? it : { ...it, sets: it.sets.map((st, b) => (b !== j ? st : { ...st, ...patch })) })) };
    persist(next, immediate);
  };
  // Feedback fragen: nach der letzten Übung eines Muskels in dieser Einheit, sobald alle Sätze erledigt sind
  const askFb = (it, i) => {
    if (prefsOf().rpFeedback === false || it.unit !== 'Wdh.' || it.plyo || (it.fb && it.fb.done) || w.deload) return false;
    if (!it.sets.length || !it.sets.every((x) => x.done)) return false;
    const mg = priMg(it.exId);
    return !w.items.some((x, a) => a > i && priMg(x.exId) === mg);
  };
  // Satzart: normal → Dropsatz → bis zum Versagen → normal
  const cycleType = (i, j) => {
    const cur = w.items[i].sets[j].type || '';
    const nt = cur === '' ? 'drop' : cur === 'drop' ? 'fail' : '';
    const it = w.items[i];
    // Dropsatz: ca. 20–25 % leichter als der Satz davor vorschlagen
    const prev = it.sets[j - 1];
    const pw = prev ? num(prev.w) || it.target.w || 0 : 0;
    const patch = { type: nt || null };
    if (nt === 'drop' && pw && !it.sets[j].done) patch.w = Math.max(0, Math.round((pw * 0.75) / (it.inc || 2.5)) * (it.inc || 2.5));
    if (nt === 'fail') patch.rir = 0;
    if (nt === '' && it.sets[j].rir === 0 && cur === 'fail') patch.rir = null;
    upSet(i, j, patch, true);
    toast(nt === 'drop' ? 'Dropsatz: direkt ohne Pause mit weniger Gewicht weiter' : nt === 'fail' ? 'Satz bis zum Versagen (RIR 0)' : 'Normaler Satz');
  };
  // Ziel-Wdh. für einen Satz: bei anderem Gewicht als geplant umgerechnet
  const repsFor = (it, st) => (it.adjusted && Number(st.w) === Number(it.adjusted.to) ? null : repsAt(it, st.w)) ?? it.target.reps;
  // Gewicht tippen: gleich in die folgenden offenen Sätze mit demselben Gewicht übernehmen
  const upW = (i, j, val) => {
    const it = w.items[i];
    const same = (a, b) => String(a ?? '').replace(',', '.') === String(b ?? '').replace(',', '.');
    const old = it.sets[j].w;
    const next = { ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets: x.sets.map((y, b) => (b === j ? { ...y, w: val } : b > j && !y.done && (same(y.w, old) || y.w === '' || y.w == null) ? { ...y, w: val } : y)) })) };
    persist(next, false);
  };
  const toggleDone = (i, j) => {
    const it = w.items[i];
    const st = it.sets[j];
    if (st.done) return upSet(i, j, { done: false }, true);
    const r = st.r === '' || st.r == null ? repsFor(it, st) : num(st.r);
    const wt = st.w === '' || st.w == null ? it.target.w || 0 : num(st.w);
    // Gewicht in die folgenden, noch offenen Sätze übernehmen
    const next = {
      ...w,
      items: w.items.map((x, a) =>
        a !== i ? x : { ...x, sets: x.sets.map((y, b) => (b === j ? { ...y, r, w: wt, done: true } : b > j && !y.done && (y.w === '' || y.w == null || y.w === st.w) ? { ...y, w: wt } : y)) },
      ),
    };
    const pf = prefsOf();
    const askRir = it.unit !== 'Sek.' && !it.plyo && pf.rirPrompt;
    // ohne RIR-Abfrage gleich nach Wiederholungen anpassen, sonst nach der RIR-Antwort
    const next2 = askRir ? next : adjustAfter(next, i, j);
    persist(next2, true);
    vibrate(25);
    if (askRir) setRirOpen({ i, j });
    // Supersatz: nach Übung 1 direkt zur Partner-Übung, Pause erst danach
    const pi = it.ss ? next.items.findIndex((x, a) => a !== i && x.ss === it.ss) : -1;
    if (pi >= 0 && it.ssPos === 1 && next.items[pi].sets.some((x) => !x.done)) {
      setRest(null, next2);
      toast(`Supersatz: direkt weiter mit ${next.items[pi].name}`);
      return scrollToEx(pi);
    }
    const secs = it.plyo ? Math.max(90, pf.restOther) : it.main ? pf.restMain : pf.restOther;
    // Nächster Satz ist ein Dropsatz → keine Pause
    if (it.sets[j + 1] && it.sets[j + 1].type === 'drop' && !it.sets[j + 1].done) {
      setRest(null, next2);
      return;
    }
    const allDone = next.items[i].sets.every((x) => x.done);
    if (!(allDone && i === w.items.length - 1)) setRest({ until: Date.now() + secs * 1000, total: secs }, next2);
    if (pi >= 0 && it.ssPos === 2 && next.items[pi].sets.some((x) => !x.done)) scrollToEx(pi);
  };
  // Live-Anpassung: offene Sätze nach einem zu schweren/zu leichten Satz anpassen (nur Sätze, deren Gewicht du nicht selbst geändert hast)
  const adjustAfter = (base, i, j) => {
    if (!prefsOf().autoAdjust) return base;
    const it = base.items[i];
    const st = it.sets[j];
    if (st.type) return base; // Drop-/Versagenssätze sind gewollt härter bzw. leichter
    const adj = liveAdjust({ ...it, target: { ...it.target, reps: repsFor(it, st) } }, st, j);
    if (!adj) return base;
    const open = it.sets.map((x, b) => b > j && !x.done && (x.w === '' || x.w == null || Number(x.w) === Number(st.w)));
    if (!open.some(Boolean)) return base;
    const kg = String(adj.w).replace('.', ',');
    toast(adj.dir < 0 ? `${adj.why} → nächste Sätze ${kg} kg` : `${adj.why} → nächste Sätze ${kg} kg 💪`);
    return {
      ...base,
      items: base.items.map((x, a) =>
        a !== i ? x : { ...x, sets: x.sets.map((y, b) => (open[b] ? { ...y, w: adj.w } : y)), adjusted: { from: Number(st.w), to: adj.w, why: adj.why, dir: adj.dir, after: j } },
      ),
    };
  };
  const undoAdjust = (i) => {
    const it = w.items[i];
    if (!it.adjusted) return;
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, adjusted: null, sets: x.sets.map((y, b) => (b > x.adjusted.after && !y.done && Number(y.w) === Number(x.adjusted.to) ? { ...y, w: x.adjusted.from } : y)) })) }, true);
  };
  const addSet = (i) => {
    const it = w.items[i];
    const lastSet = it.sets[it.sets.length - 1] || { w: it.target.w ?? '' };
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets0: x.sets0 ?? x.sets.length, sets: [...x.sets, { w: lastSet.w, r: '', done: false }] })) }, true);
  };
  const removeSet = (i) => {
    const it = w.items[i];
    if (it.sets.length <= 1) return;
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets0: x.sets0 ?? x.sets.length, sets: x.sets.slice(0, -1) })) }, true);
  };
  // Aufwärmsätze: Vorschlag, bis man sie anfasst – dann im Training gespeichert. Zählen nicht als Arbeitssätze.
  const warmOf = (it, i) => {
    if (Array.isArray(it.warm)) return it.warm;
    if (!prefsOf().warmup || it.sets.some((x) => x.done)) return [];
    return (warmupFor(it, i, w.items) || []).map((x) => ({ ...x, done: false }));
  };
  const upWarm = (i, j, patch) => {
    const it = w.items[i];
    const cur = warmOf(it, i).map((x, b) => (b === j ? { ...x, ...patch } : x));
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, warm: cur })) }, false);
  };
  const doneWarm = (i, j) => {
    const it = w.items[i];
    const cur = warmOf(it, i).map((x, b) => (b === j ? { ...x, done: !x.done } : x));
    const next = { ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, warm: cur })) };
    persist(next, true);
    vibrate(15);
    // kurze Pause nach Aufwärmsätzen (nicht nach dem letzten, wenn danach direkt gearbeitet wird: 60 s)
    if (cur[j].done) setRest({ until: Date.now() + 60 * 1000, total: 60, warm: true }, next);
  };
  const swap = (i, exId) => {
    const fresh = itemFor(exId);
    const old = w.items[i];
    fresh.sets = Array.from({ length: Math.max(fresh.sets.length, old.sets.length) }, (_, k) => fresh.sets[k] || { ...fresh.sets[0] });
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...fresh, warm: undefined, swappedFrom: x.swappedFrom || x.name, swappedFromId: x.swappedFromId || (x.added ? null : x.exId), added: x.added, ss: old.ss, ssPos: old.ssPos })) }, true);
    setSwapFor(null);
  };

  const elapsed = (now - w.startedAt) / 1000;
  const doneSets = w.items.reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0);
  const totalSets = w.items.reduce((a, it) => a + it.sets.length, 0);

  const finish = () => {
    if (doneSets === 0) {
      if (confirm('Noch kein Satz abgehakt. Training verwerfen?')) {
        clearActive();
        nav('/training');
      }
      return;
    }
    if (doneSets < totalSets && !confirm(`${totalSets - doneSets} Sätze sind noch offen. Trotzdem beenden?`)) return;
    clearTimeout(saveT.current);
    const minutes = Math.max(5, Math.round(elapsed / 60));
    const record = {
      id: w.id || uid(),
      sessionId: w.sessionId,
      name: w.name,
      startedAt: w.startedAt,
      finishedAt: Date.now(),
      minutes,
      mode: w.mode || 'normal',
      deload: !!w.deload,
      comeback: w.comeback || null,
      cycle: w.cycle || null,
      items: w.items
        .map((it) => ({ exId: it.exId, name: it.name, unit: it.unit, targetRir: it.target ? it.target.rir ?? null : null, ...(it.reset ? { reset: true } : {}), ...(it.fb && it.fb.done && !it.fb.skipped ? { fb: it.fb } : {}), sets: it.sets.filter((x) => x.done).map((x) => ({ w: num(x.w), r: num(x.r), rir: x.rir ?? null, done: true, ...(x.type ? { type: x.type } : {}) })) }))
        .filter((it) => it.sets.length),
    };
    // Rekorde & Vergleich vor dem Speichern berechnen (sonst zählt das heutige Training schon mit)
    const summary = buildSummary(w, record);
    // Feedback verrechnen → Sätze pro Muskel fürs nächste Mal
    const fbCh = applyFeedback(record.items, soreOf(getDay(w.dayKey).form));
    if (fbCh.length) summary.fb = fbCh;
    patchDay(w.dayKey, (d) => ({
      workouts: [...(d.workouts || []), record],
      training: [...(d.training || []), { id: uid(), type: 'Kraft', session: w.name, minutes, rpe: w.mode === 'light' ? 'locker' : 'mittel', workoutId: record.id, at: Date.now() }],
    }));
    const changes = planChanges(w);
    clearActive();
    nav('/training');
    if (changes.length) openSheet('planchanges', { sessionId: w.sessionId, name: w.name, changes, summary });
    else openSheet('summary', summary);
  };

  return (
    <div class="page workout">
      <header class="wohead">
        <div>
          <h1>{w.name}</h1>
          <span class="small muted tnum">
            <Timer size={13} /> {mmss(elapsed)} · {doneSets}/{totalSets} Sätze
          </span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={finish}>
          <Flag size={16} /> Beenden
        </button>
      </header>
      <div class="woprogress">
        <div style={{ width: (doneSets / Math.max(1, totalSets)) * 100 + '%' }} />
      </div>
      {w.modeLabel && <div class={'notice small ' + (w.mode === 'light' || w.mode === 'comeback' ? 'notice--info' : 'notice--ok')}>{w.modeLabel}</div>}

      {w.items.map((it, i) => {
        const allDone = it.sets.every((x) => x.done);
        return (
          <section class={'card wex' + (allDone ? ' wex--done' : '') + (it.ss ? ' wex--ss' : '')} key={it.exId + i} id={'wex-' + i}>
            {it.ss && (
              <div class="wex__ss">
                Supersatz {it.ss}
                {it.ssPos} · {it.ssPos === 1 ? 'danach direkt' : 'im Wechsel mit'} {(w.items.find((x, a) => a !== i && x.ss === it.ss) || {}).name}
              </div>
            )}
            <div class="wex__head">
              <button class="wex__thumb" onClick={() => openSheet('exercise', { exId: it.exId, item: it })} aria-label={`${it.name} – Ausführung ansehen`}>
                <ExAnim id={it.exId} size="sm" play={!allDone} />
              </button>
              <div class="wex__title">
                <span class="excard__group">{guideOf(it.exId).group}</span>
                <h3>{it.name}</h3>
                <span class="small muted">
                  {it.equip} · Ziel {it.repRange[0]}–{it.repRange[1]} {it.unit}
                </span>
              </div>
              <div class="wex__btns">
                <button class="iconbtn" onClick={() => openSheet('exercise', { exId: it.exId, item: it })} aria-label="Technik-Tipp">
                  <Info size={18} />
                </button>
                <button class="iconbtn" onClick={() => setSwapFor(swapFor === i ? null : i)} aria-label="Übung tauschen">
                  <Repeat size={18} />
                </button>
              </div>
            </div>
            {it.adaptedFrom && !it.adaptedFrom.quiet && <div class="badge badge--info">Getauscht statt {it.adaptedFrom.name} – wegen {it.adaptedFrom.why}</div>}
            {it.swappedFrom && <div class="badge badge--info">Statt {it.swappedFrom}</div>}
            {swapFor === i && (
              <div class="swaplist">
                <span class="small muted">Gerät besetzt oder unangenehm? Tauschen gegen:</span>
                {swapOptions(
                  it.exId,
                  w.items.map((x) => x.exId),
                  [...((getDay(w.dayKey).form || {}).pains || []).filter((p) => p.level >= 4).map((p) => p.area), ...limitsOf()],
                )
                  .map((e) => (
                  <button class="chip chip--sm" onClick={() => swap(i, e.id)}>
                    {e.name}
                  </button>
                ))}
                <button
                  class="chip chip--sm"
                  onClick={() =>
                    openSheet('pick', {
                      title: `${it.name} tauschen`,
                      exclude: w.items.map((x) => x.exId),
                      suggest: swapOptions(it.exId, w.items.map((x) => x.exId)).map((e) => e.id),
                      onPick: (id) => swap(i, id),
                    })
                  }
                >
                  <Search size={13} /> Andere suchen …
                </button>
              </div>
            )}
            <ExNote exId={it.exId} compact />
            <div class="wex__info small">
              {lastText(it) ? <span class="muted">Letztes Mal {lastText(it)}</span> : null}
              {it.note && <span class="wex__note">{it.note}</span>}
              {(() => {
                const pl = /Langhantel/.test(it.equip || '') && it.target && it.target.w ? platesFor(it.target.w) : null;
                return pl && pl.length ? <span class="muted">Scheiben pro Seite: {pl.map((x) => String(x).replace('.', ',')).join(' + ')} kg (20-kg-Stange)</span> : null;
              })()}
              {it.adjusted && it.sets.some((x, b) => b > it.adjusted.after && !x.done) && (
                <span class={'wex__adj' + (it.adjusted.dir > 0 ? ' wex__adj--up' : '')}>
                  {it.adjusted.dir < 0 ? '↓' : '↑'} {it.adjusted.why} – restliche Sätze {String(it.adjusted.to).replace('.', ',')} kg{' '}
                  <button class="btn--link small" onClick={() => undoAdjust(i)}>
                    rückgängig
                  </button>
                </span>
              )}
              {it.target && it.target.rir != null && it.unit !== 'Sek.' && (
                <span class="wex__rir">
                  Ziel {it.target.reps} Wdh. · aufhören, wenn noch <b>{it.target.rir}</b> {it.target.rir === 1 ? 'Wiederholung' : 'Wiederholungen'} gehen würden
                </span>
              )}
              {(() => {
                const st = it.sets.find((x) => !x.done && repsAt(it, x.w) != null);
                if (!st || (it.adjusted && Number(st.w) === Number(it.adjusted.to))) return null;
                const r = repsAt(it, st.w);
                const nw = Number(String(st.w).replace(',', '.'));
                const [lo, hi] = it.repRange || [0, 99];
                return (
                  <span class="wex__adj wex__adj--info">
                    Mit {String(nw).replace('.', ',')} kg statt {String(it.target.w).replace('.', ',')} kg: Ziel ~{r} Wdh. statt {it.target.reps} – gleiche Anstrengung.
                    {r < lo ? ' Liegt unter deinem Bereich – passt heute trotzdem.' : r > hi ? ' Liegt über deinem Bereich – nächstes Mal wird es schwerer.' : ''}
                  </span>
                );
              })()}
            </div>
            <div class="sets">
              <div class="sets__h small muted">
                <span>Satz</span>
                <span>kg</span>
                <span>{it.unit}</span>
                {it.unit !== 'Sek.' ? (
                  <button class="sets__rirh" onClick={() => openSheet('rir')} aria-label="Was ist RIR?">
                    RIR <Info size={12} />
                  </button>
                ) : (
                  <span />
                )}
                <span />
              </div>
              {warmOf(it, i).map((st, j) => (
                <div class={'sets__row sets__row--warm' + (st.done ? ' sets__row--done' : '')} key={'w' + j}>
                  <span class="sets__n sets__n--warm tnum" title="Aufwärmsatz">
                    <Flame size={12} />
                    {j + 1}
                  </span>
                  <input class="input sets__in" inputMode="decimal" value={String(st.w).replace('.', ',')} onInput={(e) => upWarm(i, j, { w: e.currentTarget.value })} aria-label={`Aufwärmen Nr. ${j + 1}: Gewicht`} />
                  <input class="input sets__in" inputMode="numeric" value={st.r} onInput={(e) => upWarm(i, j, { r: e.currentTarget.value })} aria-label={`Aufwärmen Nr. ${j + 1}: Wiederholungen`} />
                  <span class="sets__warmlbl small">locker</span>
                  <button class={'setcheck setcheck--warm' + (st.done ? ' setcheck--on' : '')} onClick={() => doneWarm(i, j)} aria-label={`Aufwärmen Nr. ${j + 1} ${st.done ? "zurücksetzen" : "erledigt"}`}>
                    <Check size={18} />
                  </button>
                </div>
              ))}
              {warmOf(it, i).length > 0 && !it.sets.some((x) => x.done) && (
                <button class="btn--link small sets__skipwarm" onClick={() => persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, warm: [] })) }, true)}>
                  Aufwärmen überspringen
                </button>
              )}
              {it.sets.map((st, j) => (
                <>
                <div class={'sets__row' + (st.done ? ' sets__row--done' : '')}>
                  <button class={'sets__n sets__type tnum' + (st.type ? ' sets__type--' + st.type : '')} onClick={() => cycleType(i, j)} aria-label={`Satz ${j + 1}: ${TYPE_LABEL[st.type || '']} – Satzart ändern`}>
                    {st.type === 'drop' ? 'D' : st.type === 'fail' ? 'V' : j + 1}
                  </button>
                  <input
                    class="input sets__in"
                    inputMode="decimal"
                    value={typeof st.w === 'number' ? String(st.w).replace('.', ',') : st.w ?? ''}
                    placeholder={it.target.w ? n1(it.target.w) : '–'}
                    onInput={(e) => upW(i, j, e.currentTarget.value)}
                    aria-label={`Gewicht Satz ${j + 1}`}
                  />
                  <input
                    class="input sets__in"
                    inputMode="numeric"
                    value={st.r ?? ''}
                    placeholder={String(repsFor(it, st))}
                    onInput={(e) => upSet(i, j, { r: e.currentTarget.value })}
                    aria-label={`Wiederholungen Satz ${j + 1}`}
                  />
                  {it.unit !== 'Sek.' ? (
                    <button class={'rirbtn' + (rirOpen && rirOpen.i === i && rirOpen.j === j ? ' rirbtn--open' : '')} onClick={() => setRirOpen(rirOpen && rirOpen.i === i && rirOpen.j === j ? null : { i, j })} aria-label={`RIR Satz ${j + 1}: ${st.rir ?? 'leer'}`}>
                      <Battery v={st.rir} />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button class={'setcheck' + (st.done ? ' setcheck--on' : '')} onClick={() => toggleDone(i, j)} aria-label={`Satz ${j + 1} ${st.done ? 'zurücksetzen' : 'abhaken'}`}>
                    <Check size={20} />
                  </button>
                </div>
                {rirOpen && rirOpen.i === i && rirOpen.j === j && (
                  <div class="rirpick">
                    <span class="small">Wie viele Wdh. wären noch gegangen?{it.target && it.target.rir != null ? ` (Ziel: ${it.target.rir})` : ''}</span>
                    <div class="rirpick__opts">
                      {[0, 1, 2, 3].map((v) => (
                        <button
                          class={'rirpick__o' + (st.rir === v ? ' rirpick__o--on' : '')}
                          onClick={() => {
                            const base = { ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets: x.sets.map((y, b) => (b !== j ? y : { ...y, rir: v })) })) };
                            persist(st.done ? adjustAfter(base, i, j) : base, true);
                            setRirOpen(null);
                          }}
                        >
                          <b>{v === 3 ? '3+' : v}</b>
                          <Battery v={v} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </>
              ))}
            </div>
            <div class="row">
              <button class="btn--link small" onClick={() => addSet(i)}>
                <Plus size={14} /> Satz
              </button>
              {it.sets.length > 1 && !it.sets[it.sets.length - 1].done && (
                <button class="btn--link small muted" onClick={() => removeSet(i)}>
                  – Satz
                </button>
              )}
              {i === 0 && !it.sets.some((x) => x.type) && <span class="small muted sets__typehint">Satznummer antippen → Dropsatz / bis zum Versagen</span>}
            </div>
            {askFb(it, i) && <FbCard it={it} onSet={(fb) => persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, fb })) }, true)} />}
          </section>
        );
      })}

      <button
        class="btn btn--block"
        onClick={() =>
          openSheet('pick', {
            title: 'Übung hinzufügen',
            exclude: w.items.map((x) => x.exId),
            onPick: (id) => persist({ ...w, items: [...w.items, { ...itemFor(id), added: true }] }, true),
          })
        }
      >
        <Plus size={18} /> Übung hinzufügen
      </button>
      <button class="btn btn--primary btn--block btn--lg" onClick={finish}>
        <Flag size={18} /> Training beenden & speichern
      </button>
      <button
        class="btn--link small center danger"
        onClick={() => {
          if (confirm('Training wirklich verwerfen? Abgehakte Sätze gehen verloren.')) {
            clearActive();
            nav('/training');
          }
        }}
      >
        <Trash2 size={14} /> Verwerfen
      </button>

      {rest && (
        <div class="restbar-timer" role="timer">
          <div class="restbar-timer__fill" style={{ width: ((rest.until - now) / 1000 / rest.total) * 100 + '%' }} />
          <span class="restbar-timer__t tnum">Pause {mmss((rest.until - now) / 1000)}</span>
          <button class="btn btn--sm btn--ghost" onClick={() => setRest({ ...rest, until: rest.until + 15000, total: rest.total + 15 })}>
            +15 s
          </button>
          <button class="iconbtn" onClick={() => setRest(null)} aria-label="Pause überspringen">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
