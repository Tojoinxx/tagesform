import { useState } from 'preact/hooks';
import { useS, S, saveTraining, toast, closeSheet, openSheet, patchDay } from '../lib/store.js';
import { breaksList, breakOn, SPORT_PROFILE } from '../lib/training.js';
import { SESSIONS } from '../lib/exercises.js';
import { todayKey, addDays, uid, fmtShortDate } from '../lib/util.js';
import { Sheet, Seg, Field } from './common.jsx';
import { Thermometer, Palmtree, Trash2, Check, Play } from 'lucide-preact';

const EQUIP = [
  { id: 'koerper', label: 'Nichts dabei', hint: 'Körpergewicht – draußen, im Zimmer, Spielplatz' },
  { id: 'kh', label: 'Kurzhanteln / kleines Hotel-Gym', hint: 'Plan mit Kurzhanteln' },
  { id: 'gym', label: 'Richtiges Gym', hint: 'Normaler Plan läuft weiter' },
  { id: 'frei', label: 'Gar nicht trainieren', hint: 'Erholung – nach dem Urlaub sanfter Wiedereinstieg' },
];

export const breakLabel = (b) => (b.type === 'krank' ? 'Krank' : 'Urlaub');
export const breakEmoji = (t) => (t === 'krank' ? '🤒' : '🏖️');
const fmtRange = (b) => `${fmtShortDate(b.from)}${b.to ? ' – ' + fmtShortDate(b.to) : ' – offen'}`;

function saveBreak(b) {
  const tr = S.training || {};
  saveTraining({ breaks: { ...(tr.breaks || {}), [b.id]: b } });
}
export function endBreak(b, k = todayKey()) {
  const tr = S.training || {};
  // Am selben Tag wieder gesund → Eintrag einfach löschen
  if (b.from >= k) return saveTraining({ breaks: { ...(tr.breaks || {}), [b.id]: null } });
  saveBreak({ ...b, to: addDays(k, -1) });
}
function deleteBreak(b) {
  const tr = S.training || {};
  saveTraining({ breaks: { ...(tr.breaks || {}), [b.id]: null } });
}

/** Krank melden oder Urlaub eintragen */
export function BreakSheet({ type: type0 = 'krank', edit }) {
  const t = todayKey();
  const [b, setB] = useState(() => edit || { id: uid().slice(0, 8), type: type0, from: t, to: type0 === 'urlaub' ? addDays(t, 7) : null, fever: false, equip: 'koerper', perWeek: 2, run: 1 });
  const set = (p) => setB((o) => ({ ...o, ...p }));
  const valid = b.from && (b.type === 'krank' || (b.to && b.to >= b.from));
  return (
    <Sheet
      title={b.type === 'krank' ? 'Krank melden' : 'Urlaub eintragen'}
      footer={
        <button
          class="btn btn--primary btn--block btn--lg"
          disabled={!valid}
          onClick={() => {
            saveBreak(b);
            toast(b.type === 'krank' ? 'Gute Besserung! Training pausiert.' : 'Urlaub eingetragen 🏖️');
            closeSheet();
          }}
        >
          <Check size={18} /> Speichern
        </button>
      }
    >
      <Seg
        value={b.type}
        onChange={(v) => set({ type: v, to: v === 'urlaub' ? b.to || addDays(b.from, 7) : null })}
        options={[
          { id: 'krank', label: '🤒 Krank' },
          { id: 'urlaub', label: '🏖️ Urlaub' },
        ]}
      />
      <div class="row">
        <Field label={b.type === 'krank' ? 'Krank seit' : 'Von'}>
          <input class="input" type="date" value={b.from} onInput={(e) => set({ from: e.currentTarget.value })} />
        </Field>
        <Field label={b.type === 'krank' ? 'Bis (optional)' : 'Bis'}>
          <input class="input" type="date" value={b.to || ''} min={b.from} onInput={(e) => set({ to: e.currentTarget.value || null })} />
        </Field>
      </div>
      {b.type === 'krank' ? (
        <>
          <label class="toggle">
            <span>
              <b>Fieber oder Beschwerden unterhalb des Halses</b>
              <small class="muted">Husten, Gliederschmerzen, Magen-Darm. Dann wird der Wiedereinstieg vorsichtiger.</small>
            </span>
            <input type="checkbox" checked={!!b.fever} onChange={(e) => set({ fever: e.currentTarget.checked })} />
          </label>
          <p class="small muted">Kein Enddatum? Kein Problem – tippe einfach auf „Wieder gesund“, sobald es dir besser geht. Danach startest du automatisch leichter.</p>
        </>
      ) : (
        <>
          <Field group label="Was hast du im Urlaub zur Verfügung?">
            <div class="opts">
              {EQUIP.map((x) => (
                <button type="button" class={'opt' + (b.equip === x.id ? ' opt--on' : '')} onClick={() => set({ equip: x.id })} aria-pressed={b.equip === x.id}>
                  <b>{x.label}</b>
                  <span>{x.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          {(b.equip === 'koerper' || b.equip === 'kh') && (
            <Field group label="Kraft-Einheiten pro Woche" hint="2× reicht, um die Muskeln zu erhalten – wenn die Sätze fordernd sind.">
              <Seg value={String(b.perWeek)} onChange={(v) => set({ perWeek: Number(v) })} options={[1, 2, 3].map((n) => ({ id: String(n), label: n + '×' }))} />
            </Field>
          )}
          {b.equip !== 'gym' && b.equip !== 'frei' && (
            <Field group label="Laufen pro Woche">
              <Seg value={String(b.run)} onChange={(v) => set({ run: Number(v) })} options={[0, 1, 2].map((n) => ({ id: String(n), label: n ? n + '×' : 'Nein' }))} />
            </Field>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Übersicht: Krank melden / Urlaub, laufende & geplante Pausen */
export function BreakCard() {
  useS();
  const t = todayKey();
  const list = breaksList().filter((b) => !b.to || b.to >= t);
  return (
    <section class="card brkcard">
      <div class="row">
        <button class="btn btn--grow" onClick={() => openSheet('break', { type: 'krank' })}>
          <Thermometer size={17} /> Krank melden
        </button>
        <button class="btn btn--grow" onClick={() => openSheet('break', { type: 'urlaub' })}>
          <Palmtree size={17} /> Urlaub
        </button>
      </div>
      {list.map((b) => (
        <div class="brkrow">
          <span>
            {breakEmoji(b.type)} <b>{breakLabel(b)}</b> <span class="small muted">{fmtRange(b)}</span>
            {b.type === 'urlaub' && <small class="muted"> · {(EQUIP.find((x) => x.id === b.equip) || EQUIP[0]).label}</small>}
          </span>
          <button class="iconbtn danger" onClick={() => confirm(`${breakLabel(b)} (${fmtRange(b)}) löschen?`) && deleteBreak(b)} aria-label="Eintrag löschen">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </section>
  );
}

/** Kopf der Heute-Karte bei Krankheit */
export function SickPanel({ rec }) {
  const b = rec.brk;
  return (
    <>
      <div class="today-tr__head">
        <span class="today-tr__badge">
          🤒<small>Tag {rec.sinceDays}</small>
        </span>
        <div>
          <h2>Gute Besserung!</h2>
          <p class="muted small">Training ist pausiert{b.to ? ` bis ${fmtShortDate(b.to)}` : ''}. Erholung geht jetzt vor.</p>
        </div>
      </div>
      <div class="notice notice--info small">
        <span>
          {b.fever ? (
            <>
              <b>Mit Fieber oder Beschwerden unterhalb des Halses: kein Sport.</b> Training mit Infekt belastet Herz und Immunsystem (Risiko Herzmuskelentzündung). Viel trinken, schlafen, normal essen.
            </>
          ) : (
            <>
              <b>Faustregel „Neck Check“:</b> Nur Schnupfen oder Halskratzen ohne Fieber → ein lockerer Spaziergang ist ok. Fieber, Husten, Gliederschmerzen → komplett pausieren.
            </>
          )}
        </span>
      </div>
      <p class="small muted">Wenn du wieder fit bist, startet die App automatisch leichter ({b.fever ? '2 Einheiten ca. 20 % / 10 % leichter' : 'ab 3 Tagen krank: 1 Einheit ca. 10 % leichter'}), Sprünge erst danach.</p>
      <button class="btn btn--primary btn--block" onClick={() => (endBreak(b), toast('Willkommen zurück! 💪'))}>
        <Check size={18} /> Wieder gesund
      </button>
    </>
  );
}

/** Lauf-Einheit im Urlaub: Anleitung + als erledigt eintragen */
export function CardioPanel({ sessionId }) {
  const ss = SESSIONS[sessionId];
  const [min, setMin] = useState(ss.minutes || 30);
  const done = () => {
    const k = todayKey();
    const id = uid();
    patchDay(k, (d) => ({
      workouts: [...(d.workouts || []), { id, sessionId, name: ss.name, startedAt: Date.now() - min * 60000, finishedAt: Date.now(), minutes: min, mode: 'normal', items: [] }],
      training: [...(d.training || []), { id: uid(), type: 'Laufen', session: ss.name, minutes: min, rpe: sessionId === 'LAUF2' ? 'hart' : 'locker', workoutId: id, at: Date.now() }],
    }));
    toast('Lauf eingetragen 🏃');
  };
  return (
    <>
      <ol class="cardio">
        {ss.steps.map((x, i) => (
          <li>
            <span class="exsteps__n">{i + 1}</span>
            <span>{x}</span>
          </li>
        ))}
      </ol>
      <div class="row">
        <Field group label="Dauer (Minuten)">
          <Seg value={String(min)} onChange={(v) => setMin(Number(v))} options={[20, 30, 40, 50, 60].map((n) => ({ id: String(n), label: String(n) }))} />
        </Field>
      </div>
      <button class="btn btn--primary btn--block" onClick={done}>
        <Check size={18} /> Gelaufen – eintragen
      </button>
    </>
  );
}

export { SPORT_PROFILE, breakOn };
