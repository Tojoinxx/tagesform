import { useEffect, useState } from 'preact/hooks';
import { useS, closeSheet, addEntries, toast } from '../lib/store.js';
import { MEALS, makeEntry, mealLabel, scale } from '../lib/nutrition.js';
import { hasAi, aiErrText } from '../lib/ai.js';
import { suggestMeals, fallbackSuggestions, suggestContext } from '../lib/aitasks.js';
import { n0, timeOfDayMeal, todayKey, vibrate } from '../lib/util.js';
import { Sheet, Chip, Spinner } from './common.jsx';
import { useAiJob, AiProgress } from './aiprogress.jsx';
import { MealChips } from './addfood.jsx';
import { RefreshCw, Clock, Sparkles, Plus } from 'lucide-preact';
import { nav } from './router.js';

const WISHES = ['Schnell', 'Unterwegs / Bäcker', 'Kantine', 'Kochen', 'Süß', 'Herzhaft', 'Viel Eiweiß', 'Leicht'];

export function SuggestSheet({ dayKey }) {
  useS();
  const [meal, setMeal] = useState(dayKey === todayKey() ? timeOfDayMeal() : 'mittag');
  const [chips, setChips] = useState([]);
  const [have, setHave] = useState('');
  const [res, setRes] = useState({ status: 'idle', list: [] });
  const [seen, setSeen] = useState([]);
  const ctx = suggestContext(dayKey, meal);

  const job = useAiJob();
  const run = async (more = false) => {
    const exclude = more ? [...seen, ...res.list.map((x) => x.title)] : [];
    setRes({ status: 'loading', list: [] });
    if (!hasAi()) {
      const list = fallbackSuggestions({ dayKey, meal, exclude });
      setSeen(exclude);
      setRes({ status: 'done', list, noAi: true });
      return;
    }
    try {
      const list = await suggestMeals({ dayKey, meal, have: have.trim(), chips, exclude }, job.start());
      setSeen(exclude);
      setRes({ status: 'done', list });
    } catch (e) {
      setRes({ status: 'done', list: fallbackSuggestions({ dayKey, meal, exclude }), error: e.aborted ? null : aiErrText(e) });
    }
  };
  useEffect(() => {
    run();
  }, [meal]);

  const take = (sg) => {
    const dish = sg.items.length > 1 ? { id: Math.random().toString(36).slice(2, 12), name: sg.title } : null;
    addEntries(
      dayKey,
      sg.items.map((it) => ({ ...makeEntry({ food: { name: it.name, per100: it.per100, fv: it.fv, unit: it.unit, source: 'ai' }, grams: it.grams, meal, source: 'suggestion' }), ...(dish ? { dish } : {}) })),
    );
    vibrate();
    toast(`„${sg.title}“ → ${mealLabel(meal)}`);
    closeSheet();
  };

  return (
    <Sheet title="Was soll ich essen?" tall>
      <div class="restbar tnum">
        <span>
          Noch offen: <b>{n0(Math.max(0, ctx.rest.kcal))} kcal</b>
        </span>
        <span class="m-p">E {n0(Math.max(0, ctx.rest.p))} g</span>
        <span class="m-c">K {n0(Math.max(0, ctx.rest.c))} g</span>
        <span class="m-f">F {n0(Math.max(0, ctx.rest.f))} g</span>
      </div>
      <MealChips meal={meal} setMeal={setMeal} />
      {hasAi() && (
        <details class="more" open={chips.length > 0 || !!have}>
          <summary>Wünsche &amp; was du da hast</summary>
          <div class="chips chips--wrap">
            {WISHES.map((w) => (
              <Chip small active={chips.includes(w)} onClick={() => setChips((c) => (c.includes(w) ? c.filter((x) => x !== w) : [...c, w]))}>
                {w}
              </Chip>
            ))}
          </div>
          <form
            class="row"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <input class="input" placeholder="z. B. Reis, Eier, Paprika – oder: bin in der Stadt" value={have} onInput={(e) => setHave(e.currentTarget.value)} />
            <button class="btn btn--sm btn--primary" type="submit" aria-label="Vorschläge holen">
              <Sparkles size={16} />
            </button>
          </form>
        </details>
      )}

      {res.status === 'loading' ? (
        hasAi() ? (
          <AiProgress p={job.p} steps={['Deinen Tag zusammenfassen', 'An die KI senden', 'KI sucht passende Gerichte', 'Rezepte & Nährwerte schreiben']} expect={2600} namesLabel="Ideen" onCancel={job.cancel} />
        ) : (
          <div class="loading loading--big">
            <Spinner size={24} /> Suche passende Ideen …
          </div>
        )
      ) : (
        <>
          {res.error && <div class="notice notice--warn small">KI gerade nicht verfügbar ({res.error}) – hier Ideen aus deinen Vorlagen.</div>}
          <ul class="sugg">
            {res.list.map((sg) => (
              <li class="card sugg__card">
                <div class="sugg__head">
                  <h3>{sg.title}</h3>
                  <span class="sugg__kcal tnum">{n0(sg.totals.kcal)} kcal</span>
                </div>
                {sg.why && <p class="sugg__why">{sg.why}</p>}
                <div class="sugg__meta small muted tnum">
                  {sg.minutes != null && (
                    <span>
                      <Clock size={13} /> {sg.minutes ? `${sg.minutes} Min` : 'sofort'}
                    </span>
                  )}
                  <span class="m-p">E {n0(sg.totals.p)} g</span>
                  <span class="m-c">K {n0(sg.totals.c)} g</span>
                  <span class="m-f">F {n0(sg.totals.f)} g</span>
                </div>
                <ul class="sugg__items small">
                  {sg.items.map((it) => (
                    <li>
                      {it.name} <span class="muted">· {n0(it.grams)} {it.unit || 'g'} · {n0(scale(it.per100, it.grams).kcal)} kcal</span>
                    </li>
                  ))}
                </ul>
                <button class="btn btn--sm btn--primary" onClick={() => take(sg)}>
                  <Plus size={16} /> Eintragen
                </button>
              </li>
            ))}
          </ul>
          <button class="btn btn--block" onClick={() => run(true)}>
            <RefreshCw size={16} /> Andere Vorschläge
          </button>
          {res.noAi && (
            <p class="small muted center">
              Mit dem kostenlosen KI-Schlüssel werden die Vorschläge persönlicher (berücksichtigt was du da hast).{' '}
              <button
                class="btn--link"
                onClick={() => {
                  closeSheet();
                  nav('/einstellungen?ki=1');
                }}
              >
                Einrichten
              </button>
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
