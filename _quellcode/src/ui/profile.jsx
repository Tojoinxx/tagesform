import { useState } from 'preact/hooks';
import { useS, saveProfile, saveAi, toast, S } from '../lib/store.js';
import { ACTIVITY, GOALS, PACES, calcTargets, targetsOf } from '../lib/nutrition.js';
import { testKey, aiErrText, hasAi } from '../lib/ai.js';
import { num, n0, n1 } from '../lib/util.js';
import { Seg, Chip, Field, NumInput, Spinner } from './common.jsx';
import { Check, ExternalLink, KeyRound, Sparkles, ChevronRight, Leaf } from 'lucide-preact';

export const DIETS = ['Alles', 'Vegetarisch', 'Vegan', 'Pescetarisch'];

export function BodyFields({ p, set }) {
  return (
    <>
      <Field group label="Geschlecht">
        <Seg
          value={p.sex || 'm'}
          onChange={(v) => set({ sex: v })}
          options={[
            { id: 'm', label: 'Mann' },
            { id: 'w', label: 'Frau' },
            { id: 'd', label: 'Divers' },
          ]}
        />
      </Field>
      <div class="grid3">
        <Field label="Geburtsjahr">
          <NumInput value={p.birthYear} onChange={(v) => set({ birthYear: v })} placeholder="2003" />
        </Field>
        <Field label="Größe">
          <NumInput value={p.heightCm} onChange={(v) => set({ heightCm: v })} suffix="cm" placeholder="180" />
        </Field>
        <Field label="Gewicht">
          <NumInput value={p.weightKg} onChange={(v) => set({ weightKg: v })} suffix="kg" placeholder="78" />
        </Field>
      </div>
    </>
  );
}

export function ActivityFields({ p, set }) {
  return (
    <>
      <Field group label="Dein Alltag (ohne Sport)">
        <div class="opts">
          {ACTIVITY.map((a) => (
            <button type="button" class={'opt' + (p.activity === a.id ? ' opt--on' : '')} onClick={() => set({ activity: a.id })} aria-pressed={p.activity === a.id}>
              <b>{a.label}</b>
              <span>{a.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field group label="Trainingstage pro Woche" hint="Gym, Handball, Laufen – alles zusammen">
        <div class="chips">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
            <Chip active={num(p.trainingDays) === d && p.trainingDays !== undefined && p.trainingDays !== ''} onClick={() => set({ trainingDays: d })}>
              {d}
            </Chip>
          ))}
        </div>
      </Field>
    </>
  );
}

export function GoalFields({ p, set }) {
  return (
    <>
      <Field group label="Dein Ziel">
        <div class="opts">
          {GOALS.map((g) => (
            <button type="button" class={'opt' + (p.goal === g.id ? ' opt--on' : '')} onClick={() => set({ goal: g.id })} aria-pressed={p.goal === g.id}>
              <b>{g.label}</b>
              <span>{g.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      {p.goal && p.goal !== 'halten' && (
        <Field group label="Tempo">
          <Seg value={p.pace || 'entspannt'} onChange={(v) => set({ pace: v })} options={PACES.map((x) => ({ id: x.id, label: x.label }))} />
        </Field>
      )}
    </>
  );
}

const TFIELDS = [
  ['kcal', 'Kalorien', 'kcal'],
  ['p', 'Eiweiß', 'g'],
  ['c', 'Kohlenhydrate', 'g'],
  ['f', 'Fett', 'g'],
  ['water', 'Wasser', 'ml'],
  ['fv', 'Obst & Gemüse', 'Port.'],
];

export function TargetsCard({ p, set }) {
  const auto = calcTargets(p);
  const t = targetsOf(p);
  const manual = !!p.targetsManual;
  return (
    <div class="targets">
      <div class="targets__grid">
        {TFIELDS.map(([k, label, unit]) => (
          <div class="tgt">
            <span class="tgt__label">{label}</span>
            {manual ? (
              <NumInput value={(p.targets && p.targets[k]) ?? t[k]} onChange={(v) => set({ targets: { ...t, ...(p.targets || {}), [k]: num(v) } })} suffix={unit} />
            ) : (
              <b class="tgt__val tnum">
                {k === 'water' ? n1(t[k] / 1000) + ' l' : `${n0(t[k])} ${unit}`}
              </b>
            )}
          </div>
        ))}
      </div>
      <p class="small muted">
        Grundlage: Grundumsatz nach Mifflin-St Jeor × Alltag + Training ≈ {n0(auto.tdee)} kcal Verbrauch
        {p.goal === 'abnehmen' ? ', davon ein moderates Defizit' : p.goal === 'aufbauen' ? ', plus kleiner Überschuss' : ''}. Eiweiß {p.goal === 'abnehmen' ? '2,0' : p.goal === 'aufbauen' ? '1,8' : '1,6'} g pro kg Körpergewicht.
      </p>
      <label class="check">
        <input type="checkbox" checked={manual} onChange={(e) => set({ targetsManual: e.currentTarget.checked, targets: e.currentTarget.checked ? { ...auto } : null })} /> Zielwerte selbst festlegen
      </label>
    </div>
  );
}

export function PrefsFields({ p, set }) {
  const pr = p.prefs || {};
  const up = (patch) => set({ prefs: { ...pr, ...patch } });
  return (
    <>
      <Field group label="Ernährungsweise">
        <div class="chips chips--wrap">
          {DIETS.map((d) => (
            <Chip small active={(pr.diet || 'Alles') === d} onClick={() => up({ diet: d })}>
              {d}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Was isst du gern?" hint="Hilft bei den Essensvorschlägen">
        <input class="input" value={pr.likes || ''} placeholder="z. B. Reis, Hähnchen, Pasta, Döner, Skyr" onInput={(e) => up({ likes: e.currentTarget.value })} />
      </Field>
      <Field label="Was magst du nicht / verträgst du nicht?">
        <input class="input" value={pr.dislikes || ''} placeholder="z. B. Pilze, Fisch" onInput={(e) => up({ dislikes: e.currentTarget.value })} />
      </Field>
      <Field label="Sonst noch was? (optional)">
        <input class="input" value={pr.notes || ''} placeholder="z. B. mittags meist Kantine, kaum Zeit zum Kochen" onInput={(e) => up({ notes: e.currentTarget.value })} />
      </Field>
    </>
  );
}

export function AiSetup({ compact }) {
  const s = useS();
  const [key, setKey] = useState('');
  const [st, setSt] = useState({ status: 'idle' });
  const connected = hasAi();
  const test = async () => {
    setSt({ status: 'loading' });
    try {
      const models = await testKey(key || (s.ai && s.ai.apiKey) || '');
      setSt({ status: 'ok', model: models[0] });
      setKey('');
      toast('KI verbunden ✨');
    } catch (e) {
      setSt({ status: 'error', error: aiErrText(e) });
    }
  };
  return (
    <div class="aisetup">
      {connected && (
        <div class="notice notice--ok">
          <Check size={16} />
          <span>
            KI verbunden{s.ai.models && s.ai.models[0] ? ` (${s.ai.models[0]})` : ''}. Foto-Erkennung, Nährwerttabelle, Vorschläge und Wochen-Fazit sind aktiv.
          </span>
        </div>
      )}
      {!compact && !connected && (
        <p class="small muted">
          Für Foto-Scan, Nährwerttabellen und persönliche Vorschläge nutzt die App Google Gemini. Den Schlüssel bekommst du kostenlos, ohne Kreditkarte.
        </p>
      )}
      {(!connected || !compact) && (
        <ol class="steps">
          <li>
            <a class="btn btn--sm" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
              Google AI Studio öffnen <ExternalLink size={14} />
            </a>
            <span class="small muted"> und mit deinem Google-Konto anmelden.</span>
          </li>
          <li class="small">Auf „API-Schlüssel erstellen“ tippen und den Schlüssel kopieren.</li>
          <li class="small">Hier einfügen und prüfen:</li>
        </ol>
      )}
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          test();
        }}
      >
        <div class="numin">
          <input class="input" type="password" autoComplete="off" placeholder={connected ? 'Neuen Schlüssel einfügen' : 'AIza…'} value={key} onInput={(e) => setKey(e.currentTarget.value.trim())} aria-label="KI-Schlüssel" />
        </div>
        <button class="btn btn--sm btn--primary" type="submit" disabled={st.status === 'loading' || (!key && !connected)}>
          {st.status === 'loading' ? <Spinner size={16} /> : <KeyRound size={16} />} {key || !connected ? 'Prüfen' : 'Testen'}
        </button>
      </form>
      {st.status === 'error' && <div class="notice notice--warn small">{st.error}</div>}
      <p class="small muted">
        Der Schlüssel wird nur in deinem Konto gespeichert und auf deine Geräte synchronisiert. Im kostenlosen Tarif darf Google Eingaben zur Verbesserung nutzen – also keine privaten Fotos, nur Essen und Verpackungen.
      </p>
      {connected && !compact && (
        <button
          class="btn--link small danger"
          onClick={() => {
            if (confirm('KI-Schlüssel entfernen?')) saveAi({ apiKey: null, models: null });
          }}
        >
          Schlüssel entfernen
        </button>
      )}
    </div>
  );
}
