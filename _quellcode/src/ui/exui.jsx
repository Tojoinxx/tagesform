import { useState } from 'preact/hooks';
import { useS, S, openSheet, closeSheet, saveActive, saveTraining, toast } from '../lib/store.js';
import { guideOf, imgOf } from '../lib/exguide.js';
import { EXERCISES, SESSIONS } from '../lib/exercises.js';
import { buildSession, swapOptions, itemFor, setupOf, planIds, isCustom, mgOf } from '../lib/training.js';
import { getDay } from '../lib/store.js';
import { todayKey, n1, uid, norm } from '../lib/util.js';
import { Sheet, Chip } from './common.jsx';
import { Repeat, ChevronLeft, Play, CalendarDays, Clock, MapPin, TriangleAlert, ExternalLink, Lightbulb, Check, Gauge, Search, Plus, X, ArrowUp, ArrowDown } from 'lucide-preact';
import { nav } from './router.js';

export function startWorkout(sessionId, items) {
  const s = buildSession(sessionId);
  // Nach längerer Pause: Zyklus beginnt wieder bei Woche 1
  if (s.comeback && s.comeback.restartCycle && s.comeback.step === 0) saveTraining({ setup: { ...setupOf(), cycleStart: todayKey() } });
  saveActive({ id: uid(), sessionId, name: s.name, focus: s.focus, startedAt: Date.now(), dayKey: todayKey(), items: items || s.items, mode: s.mode, modeLabel: s.modeLabel, notes: s.notes, cycle: s.cycle.n, deload: !!s.cycle.deload, comeback: s.comeback });
  nav('/workout');
}

/** Bewegung als Animation: Start- und Endposition blenden ineinander */
export function ExAnim({ id, size = 'md', play = true }) {
  return (
    <div class={`exanim exanim--${size}${play ? ' exanim--play' : ''}`} aria-hidden="true">
      <img src={imgOf(id, 0)} alt="" loading="lazy" decoding="async" />
      <img src={imgOf(id, 1)} alt="" loading="lazy" decoding="async" />
    </div>
  );
}

export const setsText = (it) => {
  const n = it.sets.length;
  const r = it.target.reps;
  const w = it.target.w;
  return `${n} Sätze × ${r}${it.unit === 'Sek.' ? ' Sek.' : ''}${w ? ` · ${n1(w)} kg` : ''}`;
};

/** Karte im MCI-Stil: Bild links, Muskelgruppe, Name, Sätze, Tauschen rechts */
export function ExCard({ it, onSwap, highlight, compact }) {
  const g = guideOf(it.exId);
  return (
    <div class={'excard' + (highlight ? ' excard--hl' : '') + (compact ? ' excard--c' : '')}>
      <button class="excard__main" onClick={() => openSheet('exercise', { exId: it.exId, item: it })} aria-label={`${it.name} – Ausführung ansehen`}>
        <ExAnim id={it.exId} size={compact ? 'xs' : 'sm'} />
        <span class="excard__txt">
          <span class="excard__group">{g.group}</span>
          <b class="excard__name">{it.name}</b>
          <span class="excard__sets">{setsText(it)}</span>
          {it.adaptedFrom && <span class="excard__adapt">statt {it.adaptedFrom.name} – {it.adaptedFrom.why}</span>}
        </span>
      </button>
      {onSwap && (
        <button class="excard__swap" onClick={onSwap} aria-label={`${it.name} tauschen`}>
          <Repeat size={20} />
        </button>
      )}
    </div>
  );
}

/** Detailansicht einer Übung */
export function ExerciseSheet({ exId, item }) {
  const ex = EXERCISES[exId];
  const g = guideOf(exId);
  return (
    <Sheet title={ex.name} tall>
      <ExAnim id={exId} size="lg" />
      {g.imageNote && <p class="small muted">{g.imageNote}</p>}
      <div class="exdetail__head">
        <span class="excard__group">{g.group}</span>
        <h2>{ex.name}</h2>
        <div class="chips chips--wrap">
          {g.muscles.map((m) => (
            <span class="tag">{m}</span>
          ))}
          <span class="tag tag--muted">{ex.equip}</span>
          <span class="tag tag--muted">
            {ex.reps[0]}–{ex.reps[1]} {ex.unit}
          </span>
        </div>
        {item && item.last && (
          <p class="small muted">
            Letztes Mal: {item.last.sets.map((s) => s.r).join(' / ')} {ex.unit}
            {item.last.sets[0].w ? ` · ${n1(Math.max(...item.last.sets.map((s) => s.w || 0)))} kg` : ''}
          </p>
        )}
      </div>
      <section class="card exsteps">
        <h3>So geht’s</h3>
        <ol>
          {g.steps.map((s, i) => (
            <li>
              <span class="exsteps__n">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      {g.mistakes.length > 0 && (
        <section class="card exmist">
          <h3>
            <TriangleAlert size={17} /> Achte darauf
          </h3>
          <ul>
            {g.mistakes.map((m) => (
              <li>{m}</li>
            ))}
          </ul>
        </section>
      )}
      {ex.cue && (
        <div class="notice notice--ok small">
          <Lightbulb size={16} />
          <span>{ex.cue}</span>
        </div>
      )}
      <a class="btn btn--block" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' richtige Ausführung')}`} target="_blank" rel="noopener">
        Video ansehen <ExternalLink size={15} />
      </a>
      <p class="small muted center">Bilder: free-exercise-db (Public Domain)</p>
    </Sheet>
  );
}

const MODE_LABEL = { normal: 'Normal', light: 'Leicht', push: 'Top-Form', deload: 'Deload', comeback: 'Wiedereinstieg' };
const estMinutes = (items) => Math.round(items.reduce((a, it) => a + it.sets.length * (it.main ? 3.2 : 2.4), 0) + 6);

/** Einheit ansehen (wie bei MCI): Pills oben, Übungskarten, Starten unten */
const CATS = [
  ['alle', 'Alle'],
  ['brust', 'Brust'],
  ['ruecken', 'Rücken'],
  ['schulter', 'Schultern'],
  ['arme', 'Arme'],
  ['beine', 'Beine'],
  ['po', 'Po'],
  ['rumpf', 'Rumpf'],
];
const catOf = (id) => {
  const pri = mgOf(id).split('|')[0].split(',')[0];
  if (pri === 'bizeps' || pri === 'trizeps') return 'arme';
  if (['quad', 'beinbeuger', 'waden', 'adduktoren'].includes(pri)) return 'beine';
  return pri;
};

/** Übung suchen & auswählen (ganze Bibliothek, Filter nach Muskelgruppe) */
export function ExercisePicker({ title = 'Übung auswählen', exclude = [], suggest = [], onPick }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('alle');
  const all = Object.values(EXERCISES).filter((e) => !exclude.includes(e.id));
  const qn = norm(q);
  const match = (e) => {
    if (cat !== 'alle' && catOf(e.id) !== cat) return false;
    if (!qn) return true;
    const g = guideOf(e.id);
    const hay = norm(`${e.name} ${g.group} ${(g.muscles || []).join(' ')} ${e.equip}`);
    return qn.split(' ').every((t) => hay.includes(t));
  };
  const list = all.filter(match).sort((a, b) => CATS.findIndex((c) => c[0] === catOf(a.id)) - CATS.findIndex((c) => c[0] === catOf(b.id)) || a.name.localeCompare(b.name, 'de'));
  const sugg = !qn && cat === 'alle' ? suggest.filter((id) => EXERCISES[id] && !exclude.includes(id)).map((id) => EXERCISES[id]) : [];
  const Row = ({ e }) => {
    const g = guideOf(e.id);
    return (
      <li class="frow">
        <button
          class="frow__main pickrow"
          onClick={() => {
            onPick && onPick(e.id);
            closeSheet();
          }}
        >
          <ExAnim id={e.id} size="xs" play={false} />
          <span class="frow__name">
            {e.name}
            <small class="muted">
              {g.group} · {e.equip}
            </small>
          </span>
        </button>
      </li>
    );
  };
  return (
    <Sheet title={title} tall>
      <div class="search">
        <Search size={18} class="muted" />
        <input class="search__in" type="search" placeholder="Übung suchen, z. B. Butterfly, Bizeps, Kabel …" value={q} onInput={(e) => setQ(e.currentTarget.value)} autoComplete="off" />
      </div>
      <div class="chips chips--scroll">
        {CATS.map(([id, l]) => (
          <Chip small active={cat === id} onClick={() => setCat(id)}>
            {l}
          </Chip>
        ))}
      </div>
      {sugg.length > 0 && (
        <>
          <h4 class="sect">Passende Alternativen</h4>
          <ul class="flist">
            {sugg.map((e) => (
              <Row e={e} />
            ))}
          </ul>
        </>
      )}
      <h4 class="sect">{qn || cat !== 'alle' ? `${list.length} Treffer` : `Alle Übungen (${list.length})`}</h4>
      <ul class="flist">
        {list.map((e) => (
          <Row e={e} />
        ))}
      </ul>
      {!list.length && <p class="small muted center">Nichts gefunden – versuch einen anderen Begriff.</p>}
    </Sheet>
  );
}

/** Einheit ansehen & dauerhaft anpassen (wie bei MCI): Pills oben, Übungskarten, Starten unten */
export function SessionPage({ query }) {
  useS();
  const sessionId = (query && query.s) || 'OKA';
  const setup = setupOf();
  const base = buildSession(sessionId, setup, getDay(todayKey()).form);
  const items = base.items;
  const tpl = SESSIONS[sessionId];
  const ids = planIds(sessionId, setup);
  const custom = isCustom(sessionId);

  const saveIds = (next) => saveTraining({ custom: { ...((S.training && S.training.custom) || {}), [sessionId]: next } });
  const idxOf = (it) => ids.indexOf(it.adaptedFrom ? it.adaptedFrom.id : it.exId);
  const swap = (it) =>
    openSheet('pick', {
      title: `${it.name} tauschen`,
      exclude: ids,
      suggest: swapOptions(it.adaptedFrom ? it.adaptedFrom.id : it.exId, ids).map((e) => e.id),
      onPick: (id) => {
        const i = idxOf(it);
        const next = ids.slice();
        if (i >= 0) next[i] = id;
        else next.push(id);
        saveIds(next);
        toast('Im Plan gespeichert');
      },
    });
  const remove = (it) => {
    const i = idxOf(it);
    if (i < 0) return;
    saveIds(ids.filter((_, j) => j !== i));
    toast(`${it.name} entfernt`);
  };
  const add = () =>
    openSheet('pick', {
      title: 'Übung hinzufügen',
      exclude: ids,
      onPick: (id) => {
        saveIds([...ids, id]);
        toast('Hinzugefügt');
      },
    });
  const move = (it, dir) => {
    const i = idxOf(it);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    saveIds(next);
  };

  return (
    <div class="page session">
      <header class="sesshead">
        <button class="iconbtn" onClick={() => history.back()} aria-label="Zurück">
          <ChevronLeft size={24} />
        </button>
        <h1>{tpl.name}</h1>
      </header>
      <div class="pills">
        <button class="pill" onClick={() => openSheet('algo')}>
          <CalendarDays size={16} /> Woche {base.cycle.n}/5 · {base.cycle.label}
        </button>
        <span class="pill">
          <Gauge size={16} /> RIR {base.cycle.rir} · {MODE_LABEL[base.mode] || 'Normal'}
        </span>
        <span class="pill">
          <Clock size={16} /> ~{estMinutes(items)} Minuten
        </span>
        <span class="pill">
          <MapPin size={16} /> Im Gym
        </span>
      </div>
      {base.modeLabel && <div class={'notice small ' + (base.mode === 'light' || base.mode === 'comeback' ? 'notice--info' : 'notice--ok')}>{base.modeLabel}</div>}
      {base.notes.map((n) => (
        <div class="notice notice--warn small">
          <TriangleAlert size={15} />
          <span>{n}</span>
        </div>
      ))}
      <div class="exlist">
        {items.map((it, i) => (
          <div class="excard-wrap">
            <ExCard it={it} highlight={i === 0} onSwap={() => swap(it)} />
            <div class="excard-tools">
              <button class="btn--link small" onClick={() => move(it, -1)} disabled={idxOf(it) <= 0} aria-label="Nach oben">
                <ArrowUp size={14} />
              </button>
              <button class="btn--link small" onClick={() => move(it, 1)} disabled={idxOf(it) < 0 || idxOf(it) >= ids.length - 1} aria-label="Nach unten">
                <ArrowDown size={14} />
              </button>
              <button class="btn--link small danger" onClick={() => remove(it)}>
                <X size={14} /> Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
      <button class="btn btn--block" onClick={add}>
        <Plus size={18} /> Übung hinzufügen
      </button>
      <p class="small muted center">
        Änderungen werden dauerhaft in deinem Plan gespeichert.{' '}
        {custom && (
          <button
            class="btn--link small"
            onClick={() => {
              if (confirm(`${tpl.name} auf den Standard-Plan zurücksetzen?`)) {
                saveTraining({ custom: { ...((S.training && S.training.custom) || {}), [sessionId]: null } });
                toast('Zurückgesetzt');
              }
            }}
          >
            Auf Standard zurücksetzen
          </button>
        )}
      </p>
      <div class="startbar">
        <button class="btn startbar__go" onClick={() => startWorkout(sessionId)}>
          Starten <Play size={20} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
