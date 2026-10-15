// Plan per Link übernehmen: #/?do=plan&x=2&split=okuk2&lauf=1
// Ändert nur das Konto, in dem der Link geöffnet wird – und erst nach Bestätigung.
import { S, saveTraining, toast, closeSheet } from '../lib/store.js';
import { setupOf } from '../lib/training.js';
import { SPLITS } from '../lib/exercises.js';
import { todayKey } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { WeekRhythm } from './training.jsx';
import { nav } from './router.js';
import { Check } from 'lucide-preact';

/** Link-Parameter → Änderungen am Setup (null = ungültig) */
export function planFromQuery(q) {
  const p = {};
  const x = Number(q.x);
  if (q.x != null) {
    if (!(x >= 1 && x <= 6)) return null;
    p.perWeek = x;
  }
  const per = p.perWeek || setupOf().perWeek;
  if (q.split) {
    const ok = (SPLITS[per] || []).some((s) => s.id === q.split);
    if (!ok) return null;
    p.split = q.split;
    p.planType = 'vorlage';
  } else if (p.perWeek) p.split = null; // App wählt die Empfehlung
  if (q.lauf != null) {
    const n = Number(q.lauf);
    if (![0, 1, 2].includes(n)) return null;
    p.cardio = n;
  }
  return Object.keys(p).length ? p : null;
}

export function PlanLinkSheet({ changes }) {
  const cur = setupOf();
  const next = { ...cur, ...changes };
  const splitName = (st) => ((SPLITS[st.perWeek] || []).find((s) => s.id === st.split) || {}).name || 'Empfehlung der App';
  const row = (label, a, b) => (
    <li class="planlink__row">
      <span class="muted">{label}</span>
      <span>
        {a !== b && <s class="muted">{a}</s>} <b>{b}</b>
      </span>
    </li>
  );
  const lauf = (n) => (n ? `bis ${n}× / Woche (optional)` : 'Nein');
  return (
    <Sheet
      title="Plan übernehmen?"
      footer={
        <button
          class="btn btn--primary btn--block btn--lg"
          onClick={() => {
            saveTraining({ setup: { ...next, freqMy: true, cycleStart: todayKey() }, createdAt: (S.training && S.training.createdAt) || Date.now() });
            toast('Plan aktualisiert 💪');
            closeSheet();
            nav('/training');
          }}
        >
          <Check size={18} /> Übernehmen
        </button>
      }
    >
      <p class="small muted">Gilt nur für dein Konto. Gewichte, Verlauf, Sportart und Trainingstage bleiben, wie sie sind.</p>
      <ul class="planlink">
        {row('Krafttraining', `${cur.perWeek}× / Woche`, `${next.perWeek}× / Woche`)}
        {row('Aufteilung', splitName(cur), splitName(next))}
        {row('Laufen', lauf(cur.cardio || 0), lauf(next.cardio || 0))}
      </ul>
      <p class="small muted" style={{ margin: '14px 0 6px' }}>So sieht deine Woche dann aus:</p>
      <WeekRhythm setup={next} />
    </Sheet>
  );
}
