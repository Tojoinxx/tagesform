import { useState } from 'preact/hooks';
import { useS, S, openSheet, saveActive } from '../lib/store.js';
import { guideOf, imgOf } from '../lib/exguide.js';
import { EXERCISES, SESSIONS } from '../lib/exercises.js';
import { buildSession, swapOptions, itemFor, setupOf } from '../lib/training.js';
import { getDay } from '../lib/store.js';
import { todayKey, n1, uid } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { Repeat, ChevronLeft, Play, CalendarDays, Clock, MapPin, TriangleAlert, ExternalLink, Lightbulb, Check } from 'lucide-preact';
import { nav } from './router.js';

export function startWorkout(sessionId, items) {
  const s = buildSession(sessionId);
  saveActive({ id: uid(), sessionId, name: s.name, focus: s.focus, startedAt: Date.now(), dayKey: todayKey(), items: items || s.items, mode: s.mode, modeLabel: s.modeLabel, notes: s.notes });
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

const MODE_LABEL = { normal: 'Normal', light: 'Leicht', push: 'Top-Form' };
const estMinutes = (items) => Math.round(items.reduce((a, it) => a + it.sets.length * (it.main ? 3.2 : 2.4), 0) + 6);

/** Einheit ansehen (wie bei MCI): Pills oben, Übungskarten, Starten unten */
export function SessionPage({ query }) {
  useS();
  const sessionId = (query && query.s) || 'OKA';
  const base = buildSession(sessionId, setupOf(), getDay(todayKey()).form);
  const [items, setItems] = useState(base.items);
  const [swapAt, setSwapAt] = useState(null);
  const tpl = SESSIONS[sessionId];
  const pains = ((getDay(todayKey()).form || {}).pains || []).filter((p) => p.level >= 4).map((p) => p.area);

  const start = () => startWorkout(sessionId, items);

  return (
    <div class="page session">
      <header class="sesshead">
        <button class="iconbtn" onClick={() => history.back()} aria-label="Zurück">
          <ChevronLeft size={24} />
        </button>
        <h1>{tpl.name}</h1>
      </header>
      <div class="pills">
        <span class="pill">
          <CalendarDays size={16} /> {MODE_LABEL[base.mode] || 'Normal'}
        </span>
        <span class="pill">
          <Clock size={16} /> ~{estMinutes(items)} Minuten
        </span>
        <span class="pill">
          <MapPin size={16} /> Im Gym
        </span>
      </div>
      {base.modeLabel && <div class={'notice small ' + (base.mode === 'light' ? 'notice--info' : 'notice--ok')}>{base.modeLabel}</div>}
      {base.notes.map((n) => (
        <div class="notice notice--warn small">
          <TriangleAlert size={15} />
          <span>{n}</span>
        </div>
      ))}
      <div class="exlist">
        {items.map((it, i) => (
          <>
            <ExCard it={it} highlight={i === 0} onSwap={() => setSwapAt(swapAt === i ? null : i)} />
            {swapAt === i && (
              <div class="swaplist">
                <span class="small muted">Tauschen gegen:</span>
                {swapOptions(it.exId, items.map((x) => x.exId))
                  .filter((e) => !pains.includes(e.stress[0]))
                  .map((e) => (
                    <button
                      class="chip chip--sm"
                      onClick={() => {
                        const fresh = itemFor(e.id);
                        setItems(items.map((x, j) => (j === i ? { ...fresh, swappedFrom: x.name } : x)));
                        setSwapAt(null);
                      }}
                    >
                      {e.name}
                    </button>
                  ))}
              </div>
            )}
          </>
        ))}
      </div>
      <div class="startbar">
        <button class="btn startbar__go" onClick={start}>
          Starten <Play size={20} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
