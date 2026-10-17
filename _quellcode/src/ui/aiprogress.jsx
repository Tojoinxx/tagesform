// Fortschritt bei KI-Anfragen: Schritte, Balken, was die KI gerade tut, Zeit & Abbrechen
import { useEffect, useRef, useState } from 'preact/hooks';
import { Check, X, Loader } from 'lucide-preact';

const ORDER = { prep: 0, send: 1, think: 2, write: 3 };

/** Hook: start() liefert { onProgress, signal } für askJson, cancel() bricht ab */
export function useAiJob() {
  const [p, setP] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => ctl.current && ctl.current.abort(), []);
  const start = () => {
    if (ctl.current) ctl.current.abort();
    const c = new AbortController();
    ctl.current = c;
    setP({ step: 'prep', t0: Date.now(), thoughts: [], names: [], chars: 0, retries: 0, model: '' });
    return {
      signal: c.signal,
      onProgress: (e) => {
        if (c.signal.aborted) return;
        setP((o) => {
          if (!o) return o;
          const n = { ...o, model: e.model || o.model };
          if (e.step === 'retry') {
            n.retries = o.retries + 1;
            n.retryNote = e.reason;
            n.step = 'send';
            n.chars = 0;
            n.names = [];
            return n;
          }
          // Schritte nur vorwärts
          if (ORDER[e.step] != null && ORDER[e.step] >= ORDER[o.step]) n.step = e.step;
          if (e.step === 'think' && e.thought && o.thoughts[o.thoughts.length - 1] !== e.thought) n.thoughts = [...o.thoughts, e.thought].slice(-4);
          if (e.step === 'write') {
            n.chars = e.chars || o.chars;
            if (e.names && e.names.length) n.names = e.names;
          }
          return n;
        });
      },
    };
  };
  const stage = (step) => setP((o) => (o ? { ...o, step } : o));
  const cancel = () => ctl.current && ctl.current.abort();
  const end = () => setP(null);
  return { p, start, stage, cancel, end };
}

const fmt = (ms) => `${Math.floor(ms / 1000)} s`;

/**
 * steps: 4 Texte für prep/send/think/write, z. B. ['Foto vorbereiten', 'An die KI senden', 'KI erkennt das Essen', 'Mengen & Nährwerte']
 * expect: erwartete Länge der Antwort in Zeichen (für den Balken beim Schreiben)
 * namesLabel: Text vor erkannten Namen („Erkannt“, „Ideen“)
 */
export function AiProgress({ p, steps, expect = 900, namesLabel = 'Erkannt', onCancel, compact }) {
  const [now, setNow] = useState(Date.now());
  const maxPct = useRef(0);
  const seenRetries = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, []);
  if (!p) return null;
  const el = now - p.t0;
  const idx = ORDER[p.step] || 0;
  // Balken: vorbereiten 0–8 %, senden/denken wächst mit der Zeit bis 60 %, schreiben 60–97 % nach Länge
  let pct;
  if (idx === 0) pct = 3 + Math.min(5, el / 300);
  else if (idx < 3) pct = 8 + 52 * (1 - Math.exp(-el / 9000));
  else pct = 60 + 37 * Math.min(1, p.chars / expect);
  if (p.retries !== seenRetries.current) {
    // neuer Versuch: Balken etwas zurück, aber nicht auf null
    seenRetries.current = p.retries;
    maxPct.current = Math.min(maxPct.current, 30);
  }
  maxPct.current = Math.max(maxPct.current, pct);
  const show = Math.min(97, maxPct.current);
  const slow = el > 25000;
  const lastThought = p.thoughts[p.thoughts.length - 1];

  return (
    <div class={'aiprog' + (compact ? ' aiprog--compact' : '')} role="status" aria-live="polite">
      <div class="aiprog__bar" aria-label={`Fortschritt ${Math.round(show)} %`}>
        <span style={{ width: show + '%' }} />
      </div>
      <div class="aiprog__meta small muted tnum">
        <span>{fmt(el)}</span>
        {p.model && <span>{p.model}</span>}
      </div>
      {!compact && (
        <ol class="aiprog__steps">
          {steps.map((label, i) => (
            <li class={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}>
              <span class="aiprog__ic">{i < idx ? <Check size={14} /> : i === idx ? <Loader size={14} class="spin" /> : <span class="aiprog__dot" />}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}
      {idx === 2 && lastThought && (
        <p class="aiprog__live">
          <span aria-hidden="true">💭 </span>
          {lastThought}
        </p>
      )}
      {idx === 3 && p.names.length > 0 && (
        <p class="aiprog__live">
          {namesLabel}: <b>{p.names.join(', ')}</b>
        </p>
      )}
      {p.retries > 0 && <p class="small aiprog__warn">⚠️ Erster Versuch hat nicht geklappt{p.retryNote ? ` (${p.retryNote})` : ''} – neuer Versuch{p.model ? ` mit ${p.model}` : ''}.</p>}
      {slow && <p class="small muted">Dauert gerade länger als üblich – die KI ist wohl ausgelastet. Spätestens nach ca. 1½ Min. bekommst du eine Antwort oder eine Meldung.</p>}
      {onCancel && (
        <button class="btn btn--sm aiprog__cancel" onClick={onCancel}>
          <X size={16} /> Abbrechen
        </button>
      )}
    </div>
  );
}
