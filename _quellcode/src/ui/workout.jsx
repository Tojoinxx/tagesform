import { useEffect, useRef, useState } from 'preact/hooks';
import { useS, S, saveActive, clearActive, patchDay, toast, getDay, openSheet } from '../lib/store.js';
import { ExAnim } from './exui.jsx';
import { guideOf } from '../lib/exguide.js';
import { swapOptions, itemFor } from '../lib/training.js';
import { uid, n1, num, vibrate, fmtShortDate } from '../lib/util.js';
import { Check, Plus, Info, Repeat, X, Timer, Flag, Trash2, ExternalLink, Search } from 'lucide-preact';
import { nav } from './router.js';

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

export function Workout() {
  const s = useS();
  const [w, setW] = useState(() => (S.active ? JSON.parse(JSON.stringify(S.active)) : null));
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState(null); // {until, total}
  const [swapFor, setSwapFor] = useState(null);
  const [cueFor, setCueFor] = useState(null);
  const saveT = useRef();

  useEffect(() => {
    if (!S.active && !w) nav('/training');
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (rest && now >= rest.until) {
      vibrate([80, 60, 80]);
      setRest(null);
    }
  }, [now]);

  if (!w) return null;

  const persist = (next, immediate) => {
    setW(next);
    clearTimeout(saveT.current);
    if (immediate) saveActive(next);
    else saveT.current = setTimeout(() => saveActive(next), 700);
  };
  const upSet = (i, j, patch, immediate) => {
    const next = { ...w, items: w.items.map((it, a) => (a !== i ? it : { ...it, sets: it.sets.map((st, b) => (b !== j ? st : { ...st, ...patch })) })) };
    persist(next, immediate);
  };
  const toggleDone = (i, j) => {
    const it = w.items[i];
    const st = it.sets[j];
    if (st.done) return upSet(i, j, { done: false }, true);
    const r = st.r === '' || st.r == null ? it.target.reps : num(st.r);
    const wt = st.w === '' || st.w == null ? it.target.w || 0 : num(st.w);
    // Gewicht in die folgenden, noch offenen Sätze übernehmen
    const next = {
      ...w,
      items: w.items.map((x, a) =>
        a !== i ? x : { ...x, sets: x.sets.map((y, b) => (b === j ? { ...y, r, w: wt, done: true } : b > j && !y.done && (y.w === '' || y.w == null || y.w === st.w) ? { ...y, w: wt } : y)) },
      ),
    };
    persist(next, true);
    vibrate(25);
    const secs = it.main ? 120 : 75;
    const allDone = next.items[i].sets.every((x) => x.done);
    if (!(allDone && i === w.items.length - 1)) setRest({ until: Date.now() + secs * 1000, total: secs });
  };
  const addSet = (i) => {
    const it = w.items[i];
    const lastSet = it.sets[it.sets.length - 1] || { w: it.target.w ?? '' };
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets: [...x.sets, { w: lastSet.w, r: '', done: false }] })) }, true);
  };
  const removeSet = (i) => {
    const it = w.items[i];
    if (it.sets.length <= 1) return;
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...x, sets: x.sets.slice(0, -1) })) }, true);
  };
  const swap = (i, exId) => {
    const fresh = itemFor(exId);
    fresh.sets = fresh.sets.slice(0, Math.max(fresh.sets.length, w.items[i].sets.length));
    persist({ ...w, items: w.items.map((x, a) => (a !== i ? x : { ...fresh, swappedFrom: x.name })) }, true);
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
        .map((it) => ({ exId: it.exId, name: it.name, unit: it.unit, sets: it.sets.filter((x) => x.done).map((x) => ({ w: num(x.w), r: num(x.r), done: true })) }))
        .filter((it) => it.sets.length),
    };
    const volume = record.items.reduce((a, it) => a + it.sets.reduce((b, x) => b + x.w * x.r, 0), 0);
    patchDay(w.dayKey, (d) => ({
      workouts: [...(d.workouts || []), record],
      training: [...(d.training || []), { id: uid(), type: 'Kraft', session: w.name, minutes, rpe: w.mode === 'light' ? 'locker' : 'mittel', workoutId: record.id, at: Date.now() }],
    }));
    clearActive();
    toast(`${w.name} gespeichert 💪 ${doneSets} Sätze · ${Math.round(volume).toLocaleString('de-DE')} kg bewegt`);
    nav('/training');
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
          <section class={'card wex' + (allDone ? ' wex--done' : '')} key={it.exId + i}>
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
            {it.adaptedFrom && <div class="badge badge--info">Getauscht statt {it.adaptedFrom.name} – wegen {it.adaptedFrom.why}</div>}
            {it.swappedFrom && <div class="badge badge--info">Statt {it.swappedFrom}</div>}
            {swapFor === i && (
              <div class="swaplist">
                <span class="small muted">Gerät besetzt oder unangenehm? Tauschen gegen:</span>
                {swapOptions(it.exId, w.items.map((x) => x.exId))
                  .filter((e) => !(((getDay(w.dayKey).form || {}).pains || []).some((p) => p.level >= 4 && e.stress[0] === p.area)))
                  .map((e) => (
                  <button class="chip chip--sm" onClick={() => swap(i, e.id)}>
                    {e.name}
                  </button>
                ))}
              </div>
            )}
            <div class="wex__info small">
              {lastText(it) ? <span class="muted">Letztes Mal {lastText(it)}</span> : null}
              {it.note && <span class="wex__note">{it.note}</span>}
              {it.target && it.target.rir != null && it.unit !== 'Sek.' && (
                <span class="wex__rir">
                  Ziel {it.target.reps} Wdh. · aufhören, wenn noch <b>{it.target.rir}</b> {it.target.rir === 1 ? 'Wiederholung' : 'Wiederholungen'} gehen würden
                </span>
              )}
            </div>
            <div class="sets">
              <div class="sets__h small muted">
                <span>Satz</span>
                <span>kg</span>
                <span>{it.unit}</span>
                <span />
              </div>
              {it.sets.map((st, j) => (
                <div class={'sets__row' + (st.done ? ' sets__row--done' : '')}>
                  <span class="sets__n tnum">{j + 1}</span>
                  <input
                    class="input sets__in"
                    inputMode="decimal"
                    value={typeof st.w === 'number' ? String(st.w).replace('.', ',') : st.w ?? ''}
                    placeholder={it.target.w ? n1(it.target.w) : '–'}
                    onInput={(e) => upSet(i, j, { w: e.currentTarget.value })}
                    aria-label={`Gewicht Satz ${j + 1}`}
                  />
                  <input
                    class="input sets__in"
                    inputMode="numeric"
                    value={st.r ?? ''}
                    placeholder={String(it.target.reps)}
                    onInput={(e) => upSet(i, j, { r: e.currentTarget.value })}
                    aria-label={`Wiederholungen Satz ${j + 1}`}
                  />
                  <button class={'setcheck' + (st.done ? ' setcheck--on' : '')} onClick={() => toggleDone(i, j)} aria-label={`Satz ${j + 1} ${st.done ? 'zurücksetzen' : 'abhaken'}`}>
                    <Check size={20} />
                  </button>
                </div>
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
            </div>
          </section>
        );
      })}

      <button
        class="btn btn--block"
        onClick={() =>
          openSheet('pick', {
            title: 'Übung hinzufügen (nur heute)',
            exclude: w.items.map((x) => x.exId),
            onPick: (id) => persist({ ...w, items: [...w.items, itemFor(id)] }, true),
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
