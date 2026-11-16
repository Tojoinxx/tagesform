// Zyklus-Rückblick: Bilanz der letzten 5 Wochen + gezielte Vorschläge (statt alle paar Wochen einen neuen Plan)
import { useState } from 'preact/hooks';
import { useS, openSheet, closeSheet, toast } from '../lib/store.js';
import { Sheet, Chip } from './common.jsx';
import { cycleReview, applyReview, reviewDue, setupOf, FOCUS, cycleWeek } from '../lib/training.js';
import { TrendingUp, Minus, Repeat, ChevronRight, ClipboardCheck } from 'lucide-preact';

const kg = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Karte im Training-Tab, wenn ein Rückblick ansteht */
export function ReviewCard() {
  useS();
  const key = reviewDue();
  if (!key) return null;
  const cw = cycleWeek();
  return (
    <button class="card cta cta--review" onClick={() => openSheet('cyclereview', { rkey: key })}>
      <span class="cta__icon">
        <ClipboardCheck size={22} />
      </span>
      <span class="cta__text">
        <b>Zyklus-Rückblick</b>
        <span>{cw.index === 4 ? 'Deload-Woche: 5 Wochen geschafft – kurz Bilanz ziehen und den Plan gezielt nachschärfen' : 'Neuer Zyklus: Bilanz der letzten Wochen und Vorschläge für deinen Plan'}</span>
      </span>
      <ChevronRight size={20} class="muted" />
    </button>
  );
}

export function CycleReviewSheet({ rkey }) {
  useS();
  const [r] = useState(() => cycleReview());
  const st = setupOf();
  const [on, setOn] = useState(() => Object.fromEntries(r.sug.map((s) => [s.id, s.on])));
  const [focus, setFocus] = useState(st.focus || []);
  const [minutes, setMinutes] = useState(st.minutes || 60);
  const picked = r.sug.filter((s) => on[s.id]);
  const focusChanged = JSON.stringify([...focus].sort()) !== JSON.stringify([...(st.focus || [])].sort());
  const changed = picked.length > 0 || focusChanged || minutes !== (st.minutes || 60);
  const done = (apply) => {
    const setup = {};
    if (apply && focusChanged) setup.focus = focus;
    if (apply && minutes !== (st.minutes || 60)) setup.minutes = minutes;
    applyReview(apply ? picked : [], Object.keys(setup).length ? { setup } : {}, rkey || null);
    closeSheet();
    toast(apply && changed ? 'Plan angepasst – gilt ab dem nächsten Training' : 'Plan bleibt, wie er ist');
  };
  const rate = r.planned ? Math.min(100, Math.round((r.sessions / r.planned) * 100)) : 0;
  return (
    <Sheet
      title="Zyklus-Rückblick"
      tall
      footer={
        <div class="rev__foot">
          <button class="btn btn--primary btn--block" onClick={() => done(true)} disabled={!changed}>
            Änderungen übernehmen
          </button>
          <button class="btn btn--block" onClick={() => done(false)}>
            Plan so weiterführen
          </button>
        </div>
      }
    >
      <div class="rev__stats">
        <div>
          <b class="tnum">
            {r.sessions}
            <small> / {r.planned}</small>
          </b>
          <span>Einheiten in {r.weeks} {r.weeks === 1 ? 'Woche' : 'Wochen'}</span>
        </div>
        <div>
          <b class="tnum">{r.up.length}</b>
          <span>Übungen gesteigert</span>
        </div>
        <div>
          <b class="tnum">{r.flat.length}</b>
          <span>ohne Fortschritt</span>
        </div>
      </div>
      <p class="small muted">
        {rate >= 85 ? 'Stark – du hast fast alles durchgezogen.' : rate >= 60 ? 'Solide. Mit ein, zwei Einheiten mehr geht es noch schneller voran.' : 'Du hast deutlich weniger geschafft als geplant – überleg unten, ob weniger Zeit pro Einheit oder weniger Tage besser zu deinem Alltag passen.'}
      </p>

      {r.up.length > 0 && (
        <>
          <h4 class="sect">Das lief gut</h4>
          <ul class="rev__list">
            {r.up.slice(0, 8).map((e) => (
              <li>
                <TrendingUp size={16} class="rev__up" />
                <span>{e.name}</span>
                <b class="tnum rev__up">{e.dW > 0 ? `+${kg(e.dW)} kg` : `+${kg(e.dR)} Wdh.`}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.flat.length > 0 && (
        <>
          <h4 class="sect">Hier hat sich wenig getan</h4>
          <ul class="rev__list">
            {r.flat.slice(0, 6).map((e) => (
              <li>
                <Minus size={16} class="muted" />
                <span>{e.name}</span>
                <span class="small muted tnum">{e.lastW ? `${kg(e.lastW)} kg` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.mus.length > 0 && (
        <>
          <h4 class="sect">Sätze pro Muskel und Woche</h4>
          <ul class="rev__list">
            {r.mus.map((m) => (
              <li>
                <span>{m.label}</span>
                <span class={'small tnum ' + (m.low ? 'rev__low' : 'muted')}>
                  Ø {kg(m.avg)} – Ziel {m.t[0]}–{m.t[1]} {m.low ? '(zu wenig)' : '(sehr viel)'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 class="sect">Vorschläge für den nächsten Zyklus</h4>
      {r.sug.length ? (
        <ul class="rev__sug">
          {r.sug.map((s) => (
            <li>
              <label class="rev__sugrow">
                <input type="checkbox" checked={!!on[s.id]} onChange={(e) => setOn({ ...on, [s.id]: e.currentTarget.checked })} />
                <span>
                  <b>
                    {s.kind === 'swap' && <Repeat size={14} />} {s.title}
                  </b>
                  <small class="muted">{s.why}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p class="small">Nichts zu ändern – dein Plan funktioniert. Bleib bei deinen Übungen und steigere weiter: Das bringt mehr als ein neuer Plan.</p>
      )}

      <h4 class="sect">Passt noch alles?</h4>
      <p class="small muted">Schwerpunkt (höchstens 3) – dort plant die App etwas mehr Sätze ein:</p>
      <div class="chips chips--wrap">
        {FOCUS.map((f) => (
          <Chip small active={focus.includes(f.id)} onClick={() => setFocus(focus.includes(f.id) ? focus.filter((x) => x !== f.id) : focus.length >= 3 ? focus : [...focus, f.id])}>
            {f.label}
          </Chip>
        ))}
      </div>
      <p class="small muted rev__q">Zeit pro Einheit:</p>
      <div class="chips chips--wrap">
        {[45, 60, 75, 90].map((m) => (
          <Chip small active={minutes === m} onClick={() => setMinutes(m)}>
            {m} Min.
          </Chip>
        ))}
      </div>
      <p class="small muted rev__q">Andere Trainingstage oder ein anderer Split? Das stellst du im Training-Tab unter „Plan &amp; Einstellungen“ um. Deine Hauptübungen bleiben bewusst gleich, solange sie laufen – so bleibt dein Fortschritt messbar.</p>
    </Sheet>
  );
}
