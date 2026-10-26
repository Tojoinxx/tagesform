import { useState } from 'preact/hooks';
import { useS, S, openSheet, closeSheet, saveActive, saveTraining, toast } from '../lib/store.js';
import { guideOf, imgOf } from '../lib/exguide.js';
import { EXERCISES, SESSIONS } from '../lib/exercises.js';
import { buildSession, swapOptions, itemFor, setupOf, planIds, isCustom, mgOf, sessionOf, prefsOf, exOf, sportExtras, sportOf, isAvailable, isExcluded, excludedMap, equipList, equipLabel, defaultReps, MUSCLE_LABEL, soreOf } from '../lib/training.js';
import { ExHistory } from './progress.jsx';
import { BodyMap, musclesOf } from './bodymap.jsx';
import { getDay } from '../lib/store.js';
import { todayKey, n1, uid, norm } from '../lib/util.js';
import { Sheet, Chip } from './common.jsx';
import { Repeat, ChevronLeft, Play, CalendarDays, Clock, MapPin, TriangleAlert, ExternalLink, Lightbulb, Check, Gauge, Search, Plus, X, ArrowUp, ArrowDown, SlidersHorizontal, Ban, RotateCcw } from 'lucide-preact';
import { nav } from './router.js';

export function startWorkout(sessionId, items, opts = {}) {
  const f = getDay(todayKey()).form;
  // Vor dem Training: kurze Tagesform-Abfrage (einmal pro Tag)
  if (!opts.skipCheck && prefsOf().wellness && !(f && f.at)) {
    openSheet('wellness', { sessionId });
    return;
  }
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
          {it.adaptedFrom && !it.adaptedFrom.quiet && <span class="excard__adapt">statt {it.adaptedFrom.name} – {it.adaptedFrom.why}</span>}
          {(it.ss || it.reset || it.focus || it.plyo) && (
            <span class="excard__tags">
              {it.ss && <span class="tag tag--ss">Supersatz {it.ss}{it.ssPos}</span>}
              {it.plyo && <span class="tag tag--muted">Schnellkraft</span>}
              {it.focus && <span class="tag">Schwerpunkt</span>}
              {it.reset && <span class="tag tag--warn">Reset −10 %</span>}
            </span>
          )}
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
  useS();
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
            {exOf(exId).reps[0]}–{exOf(exId).reps[1]} {ex.unit}
          </span>
        </div>
        <div class="row row--wrap">
          <button class="btn btn--sm" onClick={() => openSheet('exopts', { exId })}>
            <SlidersHorizontal size={15} /> Sätze, Wdh. &amp; Gewicht
          </button>
          <button
            class={'btn btn--sm' + (isExcluded(exId) ? ' btn--warn' : '')}
            onClick={() => {
              const ex2 = isExcluded(exId);
              saveTraining({ excluded: { ...excludedMap(), [exId]: ex2 ? null : true } });
              toast(ex2 ? `${ex.name} wird wieder vorgeschlagen` : `${ex.name} wird nicht mehr vorgeschlagen – die App nimmt eine Alternative`);
            }}
          >
            {isExcluded(exId) ? (
              <>
                <RotateCcw size={15} /> Wieder vorschlagen
              </>
            ) : (
              <>
                <Ban size={15} /> Nicht mehr vorschlagen
              </>
            )}
          </button>
        </div>
        {!isAvailable(exId) && <p class="small muted">Hinweis: Passt nicht zu deiner Ausstattung ({equipLabel()}).</p>}
      </div>
      {(() => {
        const mm = musclesOf([exId], mgOf);
        if (!mm.primary.length) return null;
        return (
          <section class="card bmcard">
            <h3 class="h3row">Trainierte Muskeln</h3>
            <BodyMap sex={S.profile && S.profile.sex === 'w' ? 'w' : 'm'} primary={mm.primary} secondary={mm.secondary} pulse={mm.primary} size="sm" />
            <div class="bmlegend">
              <span>
                <i style={{ background: 'var(--accent)' }} />
                Hauptmuskel: {mm.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
              </span>
              {mm.secondary.length > 0 && (
                <span>
                  <i style={{ background: 'color-mix(in srgb, var(--accent) 38%, var(--line))' }} />
                  hilft mit: {mm.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                </span>
              )}
            </div>
          </section>
        );
      })()}
      <ExHistory exId={exId} />
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
/** Geschätzte Dauer: Satzzeit + deine Pausen (Supersatz: Pause erst nach der 2. Übung) + Aufwärmen */
export const estMinutes = (items) => {
  const pf = prefsOf();
  let t = 5 + (items.some((it) => it.main) ? 3 : 0);
  items.forEach((it) => {
    const n = it.sets.length;
    const rest = (it.plyo ? Math.max(90, pf.restOther) : it.main ? pf.restMain : pf.restOther) / 60;
    t += n * (it.unit === 'Sek.' ? 0.8 : 1) + (it.ss && it.ssPos === 1 ? 0.3 * n : n * rest);
  });
  return Math.max(10, Math.round(t / 5) * 5);
};

/** Einheit ansehen (wie bei MCI): Pills oben, Übungskarten, Starten unten */
const CATS = [
  ['alle', 'Alle'],
  ['brust', 'Brust'],
  ['ruecken', 'Rücken'],
  ['schulter', 'Schultern'],
  ['arme', 'Arme'],
  ['beine', 'Beine'],
  ['po', 'Po'],
  ['rumpf', 'Bauch'],
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
  const restricted = !!equipList();
  const [onlyAvail, setOnlyAvail] = useState(true);
  const all = Object.values(EXERCISES).filter((e) => !exclude.includes(e.id) && (!restricted || !onlyAvail || isAvailable(e.id)));
  const qn = norm(q);
  const match = (e) => {
    if (cat !== 'alle' && catOf(e.id) !== cat) return false;
    if (!qn) return true;
    const g = guideOf(e.id);
    const hay = norm(`${e.name} ${g.group} ${(g.muscles || []).join(' ')} ${e.equip} ${e.aliases || ''}`);
    return qn.split(' ').every((t) => hay.includes(t));
  };
  const list = all.filter(match).sort((a, b) => CATS.findIndex((c) => c[0] === catOf(a.id)) - CATS.findIndex((c) => c[0] === catOf(b.id)) || a.name.localeCompare(b.name, 'de'));
  const sugg = !qn && cat === 'alle' ? suggest.filter((id) => EXERCISES[id] && !exclude.includes(id) && (!restricted || !onlyAvail || isAvailable(id))).map((id) => EXERCISES[id]) : [];
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
              {isExcluded(e.id) ? ' · ausgeschlossen' : ''}
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
      {restricted && (
        <label class="toggle toggle--sm">
          <span>
            <b>Nur mit deiner Ausstattung</b>
            <small class="muted">{equipLabel()}</small>
          </span>
          <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.currentTarget.checked)} />
        </label>
      )}
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
  const tpl = sessionOf(sessionId);
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
  const extras = sportExtras(setup).filter((x) => !ids.includes(x));
  const add = () =>
    openSheet('pick', {
      title: 'Übung hinzufügen',
      exclude: ids,
      suggest: extras,
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
          <CalendarDays size={16} /> {base.cycle.off ? 'Ohne Zyklus' : `Woche ${base.cycle.n}/5 · ${base.cycle.label}`}
        </button>
        <span class="pill">
          <Gauge size={16} /> RIR {base.cycle.rir} · {MODE_LABEL[base.mode] || 'Normal'}
        </span>
        <span class="pill">
          <Clock size={16} /> ~{estMinutes(items)} Minuten
        </span>
        <span class="pill">
          <MapPin size={16} /> {tpl.away ? 'Unterwegs' : equipLabel(setup)}
        </span>
      </div>
      {base.modeLabel && <div class={'notice small ' + (base.mode === 'light' || base.mode === 'comeback' ? 'notice--info' : 'notice--ok')}>{base.modeLabel}</div>}
      {items.length > 0 &&
        (() => {
          const mm = musclesOf(
            items.map((it) => it.exId),
            mgOf,
          );
          return (
            <section class="card bmcard">
              <BodyMap sex={S.profile && S.profile.sex === 'w' ? 'w' : 'm'} primary={mm.primary} secondary={mm.secondary} sore={soreOf(getDay(todayKey()).form)} size="sm" />
              <div class="bmlegend">
                <span>
                  <i style={{ background: 'var(--accent)' }} />
                  trainiert: {mm.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}
                </span>
              </div>
            </section>
          );
        })()}
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
              <button class="btn--link small" onClick={() => openSheet('exopts', { exId: it.exId })}>
                <SlidersHorizontal size={14} /> Einstellen
              </button>
              <button class="btn--link small danger" onClick={() => remove(it)}>
                <X size={14} /> Entfernen
              </button>
              {it.harder && (
                <button
                  class="btn--link small"
                  onClick={() => {
                    const i = idxOf(it);
                    const next = ids.slice();
                    if (i >= 0) next[i] = it.harder;
                    else next.push(it.harder);
                    saveIds(next);
                    toast(`${EXERCISES[it.harder].name} übernommen`);
                  }}
                >
                  <ArrowUp size={14} /> {EXERCISES[it.harder].name}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button class="btn btn--block" onClick={add}>
        <Plus size={18} /> Übung hinzufügen
      </button>
      {(tpl.my || custom) && !tpl.away && extras.length > 0 && (
        <div class="sportsugg">
          <span class="small muted">Passend zu {sportOf(setup).name} {sportOf(setup).emoji}:</span>
          <div class="chips chips--wrap">
            {extras.slice(0, 6).map((x) => (
              <Chip small onClick={() => (saveIds([...ids, x]), toast(`${EXERCISES[x].name} hinzugefügt`))}>
                + {EXERCISES[x].name}
              </Chip>
            ))}
          </div>
        </div>
      )}
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
