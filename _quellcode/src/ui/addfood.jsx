import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  S,
  useS,
  openSheet,
  closeSheet,
  toast,
  addEntries,
  updateEntry,
  removeEntry,
  rememberFood,
  saveMyPortion,
  recentFoods,
  getDay,
  deleteFood,
} from '../lib/store.js';
import { MEALS, makeEntry, scale, mealLabel, fvFor } from '../lib/nutrition.js';
import { BASE_FOODS } from '../lib/basefoods.js';
import { norm, n0, num, uid, downscaleImage, vibrate, timeOfDayMeal } from '../lib/util.js';
import * as OFF from '../lib/off.js';
import { hasAi, aiErrText } from '../lib/ai.js';
import { analyzeMealPhoto, analyzeMealSpeech, readLabel } from '../lib/aitasks.js';
import { canRecord, startRecording, micErrText } from '../lib/voice.js';
import { useAiJob, AiProgress } from './aiprogress.jsx';
import { Sheet, Chip, Stepper, Spinner, Macros, Field, NumInput, Seg } from './common.jsx';
import { Camera, ScanBarcode, ScanText, Keyboard, Search, Plus, Star, Trash2, Globe, Check, Sparkles, Info, RefreshCw, Mic, Square, X } from 'lucide-preact';
import { nav } from './router.js';

export function MealChips({ meal, setMeal }) {
  return (
    <div class="mealpick" role="radiogroup" aria-label="Mahlzeit">
      {MEALS.map((m) => (
        <button type="button" role="radio" aria-checked={meal === m.id} class={'mealpick__opt' + (meal === m.id ? ' mealpick__opt--on' : '')} onClick={() => setMeal(m.id)}>
          {m.short}
        </button>
      ))}
    </div>
  );
}

/** Suche in eigenen + Grundnahrungsmitteln */
function localSearch(q) {
  const qn = norm(q);
  if (!qn) return { own: [], base: [] };
  const toks = qn.split(' ');
  const hay = (f) => norm(`${f.name} ${f.brand || ''} ${f.aliases || ''}`);
  const score = (f) => {
    const h = hay(f);
    if (!toks.every((t) => h.includes(t))) return null;
    const n = norm(f.name);
    let sc = 0;
    if (n.startsWith(qn)) sc += 4;
    if (n.split(' ').some((w) => w.startsWith(toks[0]))) sc += 2;
    sc += toks.filter((t) => n.includes(t)).length * 0.8; // Treffer im Namen zählen mehr als in Marke/Suchbegriffen
    const compact = n.replace(/[^a-z0-9]/g, '');
    if (toks.length > 1 && toks.some((t, i) => i < toks.length - 1 && compact.includes(t + toks[i + 1]))) sc += 2; // „chicken burger“ → Chickenburger
    sc += Math.log1p(f.uses || 0);
    sc -= n.length / 60;
    return sc;
  };
  const rank = (list) =>
    list
      .map((f) => [score(f), f])
      .filter(([s]) => s !== null)
      .sort((a, b) => b[0] - a[0])
      .map(([, f]) => f);
  const own = rank(Object.values(S.foods).filter((f) => !f.id.startsWith('base:')));
  const used = Object.fromEntries(Object.values(S.foods).map((f) => [f.id, f]));
  const base = rank(BASE_FOODS.map((b) => (used[b.id] ? { ...b, uses: used[b.id].uses, lastGrams: used[b.id].lastGrams, myPortions: used[b.id].myPortions } : b)));
  return { own: own.slice(0, 15), base: base.slice(0, 20) };
}

const withSaved = (food) => {
  const saved = S.foods[food.id];
  return saved ? { ...food, ...saved, per100: saved.per100 || food.per100, portions: food.portions && food.portions.length ? food.portions : saved.portions } : food;
};

function FoodRow({ food, onPick, onQuick }) {
  const v = food.per100;
  return (
    <li class="frow">
      <button class="frow__main" onClick={() => onPick(food)}>
        <span class="frow__name">
          {food.name}
          <small class="muted">
            {food.brand ? food.brand + ' · ' : ''}
            {food.restaurant && food.portions[0] ? `${food.portions[0].label} ≈ ${n0((v.kcal * food.portions[0].g) / 100)} kcal` : `${n0(v.kcal)} kcal / 100 ${food.unit || 'g'}`}
            {food.lastGrams ? ` · zuletzt ${n0(food.lastGrams)} ${food.unit || 'g'}` : ''}
          </small>
        </span>
      </button>
      {onQuick && food.lastGrams ? (
        <button class="frow__quick" onClick={() => onQuick(food)} aria-label={`${food.name} mit ${food.lastGrams} ${food.unit || 'g'} hinzufügen`}>
          <Plus size={18} />
        </button>
      ) : null}
    </li>
  );
}

function PhotoButton({ icon, label, onFile, capture }) {
  const ref = useRef();
  return (
    <>
      <button class="tile" onClick={() => ref.current.click()}>
        {icon}
        <span>{label}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        {...(capture ? { capture: 'environment' } : {})}
        onChange={(e) => {
          const f = e.currentTarget.files && e.currentTarget.files[0];
          e.currentTarget.value = '';
          if (f) onFile(f);
        }}
      />
    </>
  );
}

// =============== Hinzufügen ===============
export function AddSheet({ dayKey, meal: meal0, q: q0 = '' }) {
  useS();
  const [meal, setMeal] = useState(meal0);
  const [q, setQ] = useState(q0);
  const [off, setOff] = useState({ status: 'idle', list: [], q: '' });
  const local = useMemo(() => localSearch(q), [q, S.foods]);
  const recents = recentFoods(25);
  const back = { name: 'add', props: { dayKey, meal, q } };

  const pick = (food) => openSheet('amount', { dayKey, meal, food: withSaved(food), back });
  const quick = (food) => {
    const f = rememberFood(withSaved(food), food.lastGrams);
    addEntries(dayKey, [makeEntry({ food: f, grams: food.lastGrams, meal })]);
    vibrate();
    toast(`${food.name} (${n0(food.lastGrams)} ${food.unit || 'g'}) → ${mealLabel(meal)}`);
  };
  const searchOnline = async () => {
    if (q.trim().length < 2) return;
    setOff({ status: 'loading', list: [], q });
    try {
      const list = await OFF.search(q);
      setOff({ status: 'done', list, q });
    } catch (e) {
      setOff({ status: 'error', list: [], q, error: navigator.onLine === false ? 'Du bist offline.' : 'Online-Suche gerade nicht erreichbar. Versuch es gleich nochmal.' });
    }
  };

  return (
    <Sheet title={`${mealLabel(meal)} hinzufügen`} tall>
      <MealChips meal={meal} setMeal={setMeal} />
      <div class="tiles">
        <PhotoButton icon={<Camera size={22} />} label="Foto vom Essen" onFile={(file) => openSheet('photo', { dayKey, meal, file })} />
        <button class="tile" onClick={() => openSheet('barcode', { dayKey, meal })}>
          <ScanBarcode size={22} />
          <span>Barcode</span>
        </button>
        <PhotoButton icon={<ScanText size={22} />} label="Nährwert­tabelle" onFile={(file) => openSheet('label', { dayKey, meal, file })} />
        <button class="tile" onClick={() => openSheet('custom', { dayKey, meal, back })}>
          <Keyboard size={22} />
          <span>Manuell</span>
        </button>
      </div>

      <form
        class="search"
        onSubmit={(e) => {
          e.preventDefault();
          searchOnline();
        }}
      >
        <Search size={18} class="muted" />
        <input class="search__in" type="search" placeholder="Suchen oder sprechen …" value={q} onInput={(e) => setQ(e.currentTarget.value)} enterKeyHint="search" autoComplete="off" />
        <button type="button" class="search__mic" aria-label="Essen per Sprache eintragen" onClick={() => openSheet('voice', { dayKey, meal, back })}>
          <Mic size={20} />
        </button>
      </form>

      {!q.trim() && (
        <>
          {recents.length > 0 ? (
            <>
              <h4 class="sect">Zuletzt gegessen</h4>
              <ul class="flist">
                {recents.map((f) => (
                  <FoodRow food={f} onPick={pick} onQuick={quick} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <h4 class="sect">Häufige Grundnahrungsmittel</h4>
              <ul class="flist">
                {['reis', 'nudeln', 'haehnchen', 'ei', 'haferflocken', 'skyr', 'banane', 'apfel', 'vollkornbrot', 'brezel'].map((id) => (
                  <FoodRow food={BASE_FOODS.find((b) => b.id === 'base:' + id)} onPick={pick} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {q.trim() && (
        <>
          {local.own.length > 0 && (
            <>
              <h4 class="sect">Meine Lebensmittel</h4>
              <ul class="flist">
                {local.own.map((f) => (
                  <FoodRow food={f} onPick={pick} onQuick={quick} />
                ))}
              </ul>
            </>
          )}
          {[
            ['Bäckerei & Backshop', local.base.filter((f) => f.cat === 'bakery')],
            ['Restaurants & Fast Food', local.base.filter((f) => f.cat === 'restaurant')],
            ['Grundnahrungsmittel', local.base.filter((f) => !f.restaurant)],
          ].map(
            ([label, list]) =>
              list.length > 0 && (
                <>
                  <h4 class="sect">{label}</h4>
                  <ul class="flist">
                    {list.map((f) => (
                      <FoodRow food={f} onPick={pick} onQuick={quick} />
                    ))}
                  </ul>
                </>
              ),
          )}
          {hasAi() && (
            <button class="btn btn--block btn--ghostai" onClick={() => openSheet('voice', { dayKey, meal, back, text: q.trim() })}>
              <Sparkles size={18} /> „{q.trim()}“ von der KI schätzen lassen
            </button>
          )}
          <h4 class="sect">Online-Datenbank (Open Food Facts)</h4>
          {off.status === 'idle' || off.q !== q ? (
            <button class="btn btn--block" onClick={searchOnline} disabled={off.status === 'loading'}>
              <Globe size={18} /> „{q.trim()}“ online suchen
            </button>
          ) : off.status === 'loading' ? (
            <div class="loading">
              <Spinner /> Suche läuft …
            </div>
          ) : off.status === 'error' ? (
            <div class="notice notice--warn">
              {off.error}{' '}
              <button class="btn--link" onClick={searchOnline}>
                Nochmal
              </button>
            </div>
          ) : off.list.length ? (
            <ul class="flist">
              {off.list.map((f) => (
                <FoodRow food={f} onPick={pick} />
              ))}
            </ul>
          ) : (
            <div class="notice">
              Nichts gefunden. Scanne den Barcode, fotografiere die Nährwerttabelle oder lege es{' '}
              <button class="btn--link" onClick={() => openSheet('custom', { dayKey, meal, prefill: { name: q.trim() }, back })}>
                selbst an
              </button>
              .
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

// =============== Menge wählen / Eintrag bearbeiten ===============
export function AmountSheet({ dayKey, meal: meal0, food: food0, entry, back }) {
  useS();
  const food = food0 || entryFood(entry);
  const saved = food.id ? S.foods[food.id] : null;
  const myPortions = (saved && saved.myPortions) || food.myPortions || [];
  const portions = food.portions || (saved && saved.portions) || [];
  const unit = food.unit || 'g';
  const defaultG = entry ? entry.grams : food.lastGrams || (myPortions[0] && myPortions[0].g) || (portions[0] && portions[0].g) || 100;
  const [g, setG] = useState(defaultG || 100);
  const [meal, setMeal] = useState(entry ? entry.meal : meal0);
  const [naming, setNaming] = useState(false);
  const [pname, setPname] = useState('Meine Portion');
  const v = scale(food.per100, g);

  const submit = () => {
    if (entry) {
      updateEntry(dayKey, entry.id, { ...scale(food.per100, g), grams: Math.round(g), meal, fv: fvFor(entry.fvFood, g) });
      toast('Gespeichert');
    } else {
      const remembered = food.source === 'ai' ? food : rememberFood(food, g);
      addEntries(dayKey, [makeEntry({ food: remembered, grams: g, meal })]);
      vibrate();
      toast(`${food.name} → ${mealLabel(meal)}`);
    }
    closeSheet();
  };

  return (
    <Sheet
      title={entry ? 'Eintrag bearbeiten' : 'Menge'}
      onBack={back ? () => openSheet(back.name, back.props) : undefined}
      footer={
        <div class="row">
          {entry && (
            <button
              class="btn btn--danger-ghost"
              onClick={() => {
                removeEntry(dayKey, entry.id);
                toast('Gelöscht');
                closeSheet();
              }}
              aria-label="Eintrag löschen"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button class="btn btn--primary btn--grow" onClick={submit} disabled={!(g > 0)}>
            {entry ? 'Speichern' : `Hinzufügen · ${n0(v.kcal)} kcal`}
          </button>
        </div>
      }
    >
      <div class="food-head">
        <h3>{food.name}</h3>
        <span class="muted">
          {food.brand ? food.brand + ' · ' : ''}
          {n0(food.per100.kcal)} kcal / 100 {unit}
        </span>
      </div>
      <MealChips meal={meal} setMeal={setMeal} />
      <Stepper value={g} onChange={setG} step={g >= 100 ? 10 : 5} unit={unit} big />
      {(myPortions.length > 0 || portions.length > 0) && (
        <div class="chips chips--wrap">
          {myPortions.map((p) => (
            <Chip small active={g === p.g} onClick={() => setG(p.g)}>
              <Star size={12} /> {p.label} · {p.g} {unit}
            </Chip>
          ))}
          {portions.map((p) => (
            <Chip small active={g === p.g} onClick={() => setG(p.g)}>
              {p.label} · {p.g} {unit}
            </Chip>
          ))}
          <Chip small active={g === 100} onClick={() => setG(100)}>
            100 {unit}
          </Chip>
        </div>
      )}
      <div class="kv">
        <div class="kv__big">
          <b class="tnum">{n0(v.kcal)}</b> kcal
        </div>
        <div class="kv__grid tnum">
          <span>
            <i class="sw sw--p" />
            Eiweiß <b>{n0(v.p)} g</b>
          </span>
          <span>
            <i class="sw sw--c" />
            Kohlenhydr. <b>{n0(v.c)} g</b>
          </span>
          <span>
            <i class="sw sw--f" />
            Fett <b>{n0(v.f)} g</b>
          </span>
          {v.fiber > 0 && (
            <span>
              Ballaststoffe <b>{n0(v.fiber)} g</b>
            </span>
          )}
        </div>
      </div>
      {food.source !== 'ai' && food.id && (
        <div class="portion-save">
          {naming ? (
            <form
              class="row"
              onSubmit={(e) => {
                e.preventDefault();
                saveMyPortion(food, pname.trim() || 'Meine Portion', g);
                setNaming(false);
                toast('Portion gespeichert');
              }}
            >
              <input class="input" value={pname} onInput={(e) => setPname(e.currentTarget.value)} aria-label="Name der Portion" />
              <button class="btn btn--sm" type="submit">
                <Check size={16} /> Speichern
              </button>
            </form>
          ) : (
            <button class="btn--link small" onClick={() => setNaming(true)}>
              <Star size={14} /> {n0(g)} {unit} als „Meine Portion“ merken
            </button>
          )}
          <p class="small muted">Tipp: Wieg deine typische Portion (z. B. Reis auf deinem Teller) einmal ab und speichere sie – dann musst du nie wieder schätzen.</p>
        </div>
      )}
    </Sheet>
  );
}

function entryFood(e) {
  const saved = e.foodId ? S.foods[e.foodId] : null;
  return {
    id: e.foodId || null,
    name: e.name,
    brand: e.brand,
    per100: e.per100,
    unit: e.unit || 'g',
    fv: e.fvFood,
    portions: saved ? saved.portions : [],
    myPortions: saved ? saved.myPortions : [],
    source: e.foodId ? 'custom' : 'ai',
  };
}

/** Eintrag öffnen: mit per100 → Mengen-Editor, sonst einfacher Editor */
export function EntrySheet({ dayKey, id }) {
  useS();
  const e = (getDay(dayKey).entries || []).find((x) => x.id === id);
  useEffect(() => {
    if (!e) closeSheet();
  }, [!!e]);
  if (!e) return null;
  if (e.per100 && e.grams > 0) return <AmountSheet dayKey={dayKey} entry={e} />;
  return <QuickEditSheet dayKey={dayKey} entry={e} />;
}

function QuickEditSheet({ dayKey, entry }) {
  const [f, setF] = useState({ name: entry.name, kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f });
  const [meal, setMeal] = useState(entry.meal);
  const up = (k) => (v) => setF({ ...f, [k]: v });
  return (
    <Sheet
      title="Eintrag bearbeiten"
      footer={
        <div class="row">
          <button
            class="btn btn--danger-ghost"
            onClick={() => {
              removeEntry(dayKey, entry.id);
              toast('Gelöscht');
              closeSheet();
            }}
            aria-label="Eintrag löschen"
          >
            <Trash2 size={18} />
          </button>
          <button
            class="btn btn--primary btn--grow"
            onClick={() => {
              updateEntry(dayKey, entry.id, { name: f.name, kcal: Math.round(num(f.kcal)), p: num(f.p), c: num(f.c), f: num(f.f), meal });
              toast('Gespeichert');
              closeSheet();
            }}
          >
            Speichern
          </button>
        </div>
      }
    >
      <MealChips meal={meal} setMeal={setMeal} />
      <Field label="Name">
        <input class="input" value={f.name} onInput={(e) => up('name')(e.currentTarget.value)} />
      </Field>
      <div class="grid2">
        <Field label="Kalorien">
          <NumInput value={f.kcal} onChange={up('kcal')} suffix="kcal" />
        </Field>
        <Field label="Eiweiß">
          <NumInput value={f.p} onChange={up('p')} suffix="g" />
        </Field>
        <Field label="Kohlenhydrate">
          <NumInput value={f.c} onChange={up('c')} suffix="g" />
        </Field>
        <Field label="Fett">
          <NumInput value={f.f} onChange={up('f')} suffix="g" />
        </Field>
      </div>
    </Sheet>
  );
}

// =============== Eigenes Produkt / Schnell-Eintrag ===============
export function CustomSheet({ dayKey, meal: meal0, barcode, prefill = {}, back, fromLabel }) {
  const [mode, setMode] = useState(barcode || fromLabel || prefill.per100 ? 'product' : 'quick');
  const [meal, setMeal] = useState(meal0);
  const p100 = prefill.per100 || {};
  const [f, setF] = useState({
    name: prefill.name || '',
    brand: prefill.brand || '',
    kcal: p100.kcal ?? '',
    p: p100.p ?? '',
    c: p100.c ?? '',
    f: p100.f ?? '',
    fiber: p100.fiber ?? '',
    sugar: p100.sugar ?? '',
    serving: prefill.servingG || '',
    unit: prefill.unit || 'g',
    fv: false,
  });
  const up = (k) => (v) => setF((o) => ({ ...o, [k]: v }));
  const valid = f.name.trim() && num(f.kcal) >= 0 && String(f.kcal) !== '';

  const save = () => {
    if (mode === 'quick') {
      addEntries(dayKey, [
        { id: uid(), meal, name: f.name.trim(), brand: '', grams: 0, unit: 'g', per100: null, kcal: Math.round(num(f.kcal)), p: num(f.p), c: num(f.c), f: num(f.f), fiber: 0, sugar: 0, fv: 0, source: 'manual', at: Date.now() },
      ]);
      toast(`${f.name.trim()} → ${mealLabel(meal)}`);
      closeSheet();
      return;
    }
    const portions = [];
    if (num(f.serving) > 0) portions.push({ label: '1 Portion', g: Math.round(num(f.serving)) });
    if (prefill.packageG > 0) portions.push({ label: 'Ganze Packung', g: prefill.packageG });
    const food = rememberFood(
      {
        id: barcode ? 'bc:' + barcode : 'custom:' + uid(),
        name: f.name.trim(),
        brand: f.brand.trim(),
        barcode: barcode || null,
        per100: { kcal: Math.round(num(f.kcal)), p: num(f.p), c: num(f.c), f: num(f.f), fiber: num(f.fiber), sugar: num(f.sugar) },
        portions,
        unit: f.unit,
        fv: f.fv,
        source: 'custom',
      },
      0,
    );
    toast('Produkt gespeichert – nächstes Mal findest du es sofort');
    openSheet('amount', { dayKey, meal, food });
  };

  return (
    <Sheet
      title={mode === 'quick' ? 'Schnell eintragen' : 'Produkt anlegen'}
      onBack={back ? () => openSheet(back.name, back.props) : undefined}
      footer={
        <button class="btn btn--primary btn--block" disabled={!valid} onClick={save}>
          {mode === 'quick' ? 'Eintragen' : 'Speichern & Menge wählen'}
        </button>
      }
    >
      {!barcode && !fromLabel && (
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { id: 'quick', label: 'Nur Kalorien' },
            { id: 'product', label: 'Produkt (pro 100 g)' },
          ]}
        />
      )}
      {fromLabel && (
        <div class="notice notice--ok">
          <Sparkles size={16} />
          <span>Werte von der Nährwerttabelle gelesen – kurz prüfen.</span>
        </div>
      )}
      {barcode && <p class="small muted">Barcode {barcode} – wird mit dem Produkt gespeichert.</p>}
      {mode === 'quick' && <MealChips meal={meal} setMeal={setMeal} />}
      <Field label="Name">
        <input class="input" value={f.name} placeholder={mode === 'quick' ? 'z. B. Kantine Schnitzel mit Pommes' : 'z. B. High Protein Pudding'} onInput={(e) => up('name')(e.currentTarget.value)} />
      </Field>
      {mode === 'product' && (
        <Field label="Marke (optional)">
          <input class="input" value={f.brand} onInput={(e) => up('brand')(e.currentTarget.value)} />
        </Field>
      )}
      {mode === 'product' && (
        <div class="row row--center">
          <span class="small muted">Werte pro 100</span>
          <Seg
            value={f.unit}
            onChange={up('unit')}
            options={[
              { id: 'g', label: 'g' },
              { id: 'ml', label: 'ml' },
            ]}
          />
        </div>
      )}
      <div class="grid2">
        <Field label="Kalorien">
          <NumInput value={f.kcal} onChange={up('kcal')} suffix="kcal" placeholder="0" />
        </Field>
        <Field label="Eiweiß">
          <NumInput value={f.p} onChange={up('p')} suffix="g" placeholder="0" />
        </Field>
        <Field label="Kohlenhydrate">
          <NumInput value={f.c} onChange={up('c')} suffix="g" placeholder="0" />
        </Field>
        <Field label="Fett">
          <NumInput value={f.f} onChange={up('f')} suffix="g" placeholder="0" />
        </Field>
        {mode === 'product' && (
          <>
            <Field label="Ballaststoffe">
              <NumInput value={f.fiber} onChange={up('fiber')} suffix="g" placeholder="0" />
            </Field>
            <Field label="davon Zucker">
              <NumInput value={f.sugar} onChange={up('sugar')} suffix="g" placeholder="0" />
            </Field>
            <Field label="Portionsgröße (optional)">
              <NumInput value={f.serving} onChange={up('serving')} suffix={f.unit} placeholder="z. B. 150" />
            </Field>
          </>
        )}
      </div>
      {mode === 'product' && (
        <label class="check">
          <input type="checkbox" checked={f.fv} onChange={(e) => up('fv')(e.currentTarget.checked)} /> Zählt als Obst / Gemüse
        </label>
      )}
    </Sheet>
  );
}

// =============== Foto vom Essen ===============
function basePortionsFor(name) {
  const n = norm(name).split(' ')[0];
  if (!n || n.length < 3) return null;
  const b = BASE_FOODS.find((x) => norm(x.name).split(' ')[0] === n);
  return b && b.portions.length ? b.portions.slice(0, 3) : null;
}

/** Von der KI erkannte Komponenten: an/aus, Name, Menge, Portionen */
function AiItems({ items, setItem, meal, setMeal, title, hint }) {
  return (
    <>
      <MealChips meal={meal} setMeal={setMeal} />
      <h4 class="sect">{title}</h4>
      <ul class="ailist">
        {items.map((it) => {
          const v = scale(it.per100, it.grams);
          const bp = basePortionsFor(it.name);
          return (
            <li class={'aiitem' + (it.on ? '' : ' aiitem--off')} key={it.id}>
              <div class="aiitem__top">
                <label class="check check--inline">
                  <input type="checkbox" checked={it.on} onChange={(e) => setItem(it.id, { on: e.currentTarget.checked })} aria-label={`${it.name} übernehmen`} />
                </label>
                <input class="aiitem__name" value={it.name} onInput={(e) => setItem(it.id, { name: e.currentTarget.value })} aria-label="Name" />
                <span class="aiitem__kcal tnum">{n0(v.kcal)} kcal</span>
              </div>
              <div class="aiitem__amt">
                <Stepper value={it.grams} onChange={(g) => setItem(it.id, { grams: g })} step={10} />
                {it.confidence === 'niedrig' && <span class="badge badge--warn">Menge unsicher</span>}
              </div>
              {bp && (
                <div class="chips chips--wrap">
                  {bp.map((p) => (
                    <Chip small active={it.grams === p.g} onClick={() => setItem(it.id, { grams: p.g })}>
                      {p.label} · {p.g} g
                    </Chip>
                  ))}
                </div>
              )}
              <Macros v={v} compact />
            </li>
          );
        })}
      </ul>
      {hint && (
        <div class="notice">
          <Info size={16} />
          <span>{hint}</span>
        </div>
      )}
    </>
  );
}

export function PhotoSheet({ dayKey, meal: meal0, file }) {
  const [img, setImg] = useState(null);
  const [state, setState] = useState({ status: 'prep' });
  const [items, setItems] = useState([]);
  const [meal, setMeal] = useState(meal0);
  const [note, setNote] = useState('');

  const job = useAiJob();
  const run = async (image, hint, o = job.start()) => {
    setState({ status: 'loading' });
    try {
      const r = await analyzeMealPhoto(image, hint, o);
      setItems(r.items.map((it) => ({ ...it, id: uid(), on: true })));
      setState({ status: 'done', title: r.title, hint: r.hint });
    } catch (e) {
      setState({ status: 'error', error: aiErrText(e), noKey: e.noKey });
    }
  };
  useEffect(() => {
    (async () => {
      try {
        const o = hasAi() ? job.start() : null;
        const im = await downscaleImage(file, 1280);
        setImg(im);
        if (!hasAi()) setState({ status: 'error', noKey: true, error: 'Für die Foto-Erkennung brauchst du einmalig einen kostenlosen KI-Schlüssel.' });
        else run(im, undefined, o);
      } catch (e) {
        setState({ status: 'error', error: 'Das Bild konnte nicht gelesen werden.' });
      }
    })();
  }, [file]);

  const chosen = items.filter((i) => i.on);
  const total = chosen.reduce((a, it) => a + scale(it.per100, it.grams).kcal, 0);
  const setItem = (id, patch) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = () => {
    addEntries(
      dayKey,
      chosen.map((it) => makeEntry({ food: { name: it.name, per100: it.per100, fv: it.fv, source: 'ai' }, grams: it.grams, meal, source: 'ai-photo' })),
    );
    vibrate();
    toast(`${chosen.length} ${chosen.length === 1 ? 'Eintrag' : 'Einträge'} → ${mealLabel(meal)}`);
    closeSheet();
  };

  return (
    <Sheet
      title="Foto vom Essen"
      tall
      footer={
        state.status === 'done' && (
          <button class="btn btn--primary btn--block" disabled={!chosen.length} onClick={save}>
            Eintragen · {n0(total)} kcal
          </button>
        )
      }
    >
      {img && <img class="photo" src={img.dataUrl} alt="Dein Essen" />}
      {state.status === 'loading' || state.status === 'prep' ? (
        <AiProgress p={job.p} steps={['Foto vorbereiten', 'An die KI senden', 'KI erkennt, was auf dem Teller ist', 'Mengen & Nährwerte berechnen']} expect={700} onCancel={job.cancel} />
      ) : state.status === 'error' ? (
        <div class="notice notice--warn">
          <p>{state.error}</p>
          {state.noKey ? (
            <button
              class="btn btn--sm"
              onClick={() => {
                closeSheet();
                nav('/einstellungen?ki=1');
              }}
            >
              KI einrichten (2 Minuten, kostenlos)
            </button>
          ) : (
            img && (
              <button class="btn btn--sm" onClick={() => run(img, note)}>
                <RefreshCw size={16} /> Nochmal versuchen
              </button>
            )
          )}
        </div>
      ) : (
        <>
          <AiItems items={items} setItem={setItem} meal={meal} setMeal={setMeal} title={state.title} hint={state.hint} />
          <details class="more">
            <summary>Nicht richtig erkannt?</summary>
            <p class="small muted">Schreib kurz dazu, was drauf ist – dann wird es genauer. Tipp für die Menge: Gabel oder Hand mit aufs Foto.</p>
            <div class="row">
              <input class="input" placeholder="z. B. Hähnchen-Curry mit Basmatireis" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
              <button class="btn btn--sm" onClick={() => img && run(img, note)}>
                <RefreshCw size={16} />
              </button>
            </div>
          </details>
          <p class="small muted">Die KI schätzt – Mengen kurz prüfen. Fotos gehen dafür an Google Gemini.</p>
        </>
      )}
    </Sheet>
  );
}

// =============== Nährwerttabelle fotografieren ===============
export function LabelSheet({ dayKey, meal, file, barcode, name }) {
  const [state, setState] = useState({ status: 'loading' });
  const [img, setImg] = useState(null);
  const job = useAiJob();
  useEffect(() => {
    (async () => {
      try {
        const o = hasAi() ? job.start() : null;
        const im = await downscaleImage(file, 1600, 0.85);
        setImg(im);
        if (!hasAi()) {
          setState({ status: 'error', noKey: true, error: 'Zum Auslesen der Tabelle brauchst du einmalig einen kostenlosen KI-Schlüssel. Du kannst die Werte aber auch selbst eintippen.' });
          return;
        }
        const r = await readLabel(im, o);
        if (!r.readable || !(r.per100.kcal > 0)) {
          setState({ status: 'error', error: 'Die Tabelle war nicht gut lesbar. Versuch ein schärferes Foto (gerade, ohne Spiegelung) oder tipp die Werte ab.' });
          return;
        }
        openSheet('custom', { dayKey, meal, barcode, fromLabel: true, prefill: { ...r, name: r.name || name || '' } });
      } catch (e) {
        setState({ status: 'error', error: aiErrText(e), noKey: e.noKey });
      }
    })();
  }, [file]);
  return (
    <Sheet title="Nährwerttabelle">
      {img && <img class="photo photo--sm" src={img.dataUrl} alt="Nährwerttabelle" />}
      {state.status === 'loading' ? (
        <AiProgress p={job.p} steps={['Foto vorbereiten', 'An die KI senden', 'KI liest die Tabelle', 'Werte übernehmen']} expect={260} onCancel={job.cancel} />
      ) : (
        <div class="notice notice--warn">
          <p>{state.error}</p>
          <div class="row">
            {state.noKey && (
              <button
                class="btn btn--sm"
                onClick={() => {
                  closeSheet();
                  nav('/einstellungen?ki=1');
                }}
              >
                KI einrichten
              </button>
            )}
            <button class="btn btn--sm" onClick={() => openSheet('custom', { dayKey, meal, barcode, prefill: { name: name || '' } })}>
              <Keyboard size={16} /> Selbst eintippen
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// =============== Barcode ===============
export function BarcodeSheet({ dayKey, meal }) {
  const video = useRef();
  const ctrl = useRef(null);
  const [state, setState] = useState({ status: 'starting' });
  const [code, setCode] = useState('');
  const labelInput = useRef();
  const imgInput = useRef();

  const stop = () => {
    try {
      ctrl.current && ctrl.current.stop();
    } catch (e) {}
    ctrl.current = null;
  };

  const lookup = async (raw) => {
    const c = String(raw).replace(/\D/g, '');
    if (c.length < 6) return;
    stop();
    vibrate(40);
    setCode(c);
    setState({ status: 'lookup', code: c });
    const own = Object.values(S.foods).find((f) => f.barcode === c);
    if (own) return openSheet('amount', { dayKey, meal, food: own });
    try {
      const p = await OFF.byBarcode(c);
      if (p && !p.incomplete) return openSheet('amount', { dayKey, meal, food: withSaved(p) });
      setState({ status: 'notfound', code: c, name: p && p.name });
    } catch (e) {
      setState({ status: 'neterror', code: c });
    }
  };

  const start = async () => {
    setState({ status: 'starting' });
    try {
      const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const hints = new Map();
      hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E, lib.BarcodeFormat.CODE_128]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
      ctrl.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        video.current,
        (res) => {
          if (res && ctrl.current) lookup(res.getText());
        },
      );
      setState({ status: 'scanning' });
    } catch (e) {
      console.warn(e);
      setState({ status: 'nocam', error: e && e.name === 'NotAllowedError' ? 'Kein Kamerazugriff erlaubt.' : 'Kamera nicht verfügbar.' });
    }
  };

  const fromImage = async (file) => {
    try {
      const [{ BrowserMultiFormatReader }] = await Promise.all([import('@zxing/browser')]);
      const url = URL.createObjectURL(file);
      const res = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      lookup(res.getText());
    } catch (e) {
      toast('Kein Barcode auf dem Foto erkannt', 'error');
    }
  };

  useEffect(() => {
    start();
    return stop;
  }, []);

  const scanning = state.status === 'scanning' || state.status === 'starting';
  return (
    <Sheet
      title="Barcode scannen"
      onClose={() => {
        stop();
        closeSheet();
      }}
      onBack={() => {
        stop();
        openSheet('add', { dayKey, meal });
      }}
    >
      <div class={'scanner' + (scanning ? '' : ' scanner--hidden')}>
        <video ref={video} playsInline muted autoPlay />
        <div class="scanner__frame" />
        {state.status === 'starting' && (
          <div class="scanner__msg">
            <Spinner /> Kamera startet …
          </div>
        )}
      </div>
      {scanning && <p class="small muted center">Barcode ins Feld halten – wird automatisch erkannt.</p>}
      {state.status === 'nocam' && (
        <div class="notice notice--warn">
          {state.error} Du kannst ein Foto vom Barcode machen oder die Nummer eintippen.
          <div class="row" style={{ marginTop: '8px' }}>
            <button class="btn btn--sm" onClick={() => imgInput.current.click()}>
              <Camera size={16} /> Foto vom Barcode
            </button>
            <button class="btn btn--sm" onClick={start}>
              <RefreshCw size={16} /> Kamera erneut
            </button>
          </div>
        </div>
      )}
      {state.status === 'lookup' && (
        <div class="loading loading--big">
          <Spinner size={24} /> Suche Produkt {state.code} …
        </div>
      )}
      {(state.status === 'notfound' || state.status === 'neterror') && (
        <div class="card notfound">
          <h3>{state.status === 'notfound' ? 'Produkt nicht gefunden' : 'Online-Datenbank nicht erreichbar'}</h3>
          <p class="muted">
            {state.status === 'notfound'
              ? `${state.name ? '„' + state.name + '“ hat keine Nährwerte' : 'Der Barcode ' + state.code + ' ist noch nicht in der Datenbank'}. Leg es einmal an – danach findest du es per Scan sofort.`
              : 'Du kannst das Produkt trotzdem anlegen.'}
          </p>
          <button class="btn btn--primary btn--block" onClick={() => labelInput.current.click()}>
            <ScanText size={18} /> Nährwerttabelle fotografieren
          </button>
          <button class="btn btn--block" onClick={() => openSheet('custom', { dayKey, meal, barcode: state.code, prefill: { name: state.name || '' } })}>
            <Keyboard size={18} /> Werte selbst eintippen
          </button>
          <button class="btn--link small" onClick={start}>
            Anderen Barcode scannen
          </button>
        </div>
      )}
      <form
        class="row manual-code"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <input class="input" inputMode="numeric" placeholder="Nummer eintippen" value={code} onInput={(e) => setCode(e.currentTarget.value)} aria-label="Barcode-Nummer" />
        <button class="btn btn--sm" type="submit" disabled={code.replace(/\D/g, '').length < 6}>
          Suchen
        </button>
      </form>
      <input
        ref={labelInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files && e.currentTarget.files[0];
          e.currentTarget.value = '';
          if (f) openSheet('label', { dayKey, meal, file: f, barcode: state.code, name: state.name });
        }}
      />
      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files && e.currentTarget.files[0];
          e.currentTarget.value = '';
          if (f) fromImage(f);
        }}
      />
    </Sheet>
  );
}

// =============== Per Sprache eintragen ===============
const fmtSec = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export function VoiceSheet({ dayKey, meal: meal0, back, text: text0 = '' }) {
  const [meal, setMeal] = useState(meal0 || timeOfDayMeal());
  const [state, setState] = useState({ status: 'idle' });
  const [items, setItems] = useState([]);
  const [text, setText] = useState(text0);
  const [level, setLevel] = useState(0);
  const [ms, setMs] = useState(0);
  const rec = useRef(null);
  const ai = hasAi();
  const mealTouched = useRef(false); // gesagte Mahlzeit („zum Frühstück“) gewinnt, außer man tippt selbst eine an

  useEffect(() => () => rec.current && rec.current.cancel(), []);
  useEffect(() => {
    if (state.status !== 'rec') return;
    const t0 = Date.now();
    const iv = setInterval(() => setMs(Date.now() - t0), 250);
    return () => clearInterval(iv);
  }, [state.status]);

  const job = useAiJob();
  const [mode, setMode] = useState('text');
  const analyze = async (input, o = job.start()) => {
    setMode(input.audio ? 'audio' : 'text');
    setState({ status: 'loading' });
    try {
      const r = await analyzeMealSpeech(input, o);
      if (r.transcript) setText(r.transcript);
      if (r.meal && !mealTouched.current) setMeal(r.meal);
      if (!r.items.length) {
        setState({ status: 'error', error: r.transcript ? `Verstanden: „${r.transcript}“ – darin habe ich kein Essen gefunden. Versuch es nochmal oder korrigier den Text.` : 'Ich habe nichts verstanden. Sprich etwas näher am Handy und nochmal versuchen.' });
        return;
      }
      setItems(r.items.map((it) => ({ ...it, id: uid(), on: true })));
      setState({ status: 'done', title: r.title, hint: r.hint });
    } catch (e) {
      setState({ status: 'error', error: aiErrText(e), noKey: e.noKey });
    }
  };

  const start = async () => {
    setLevel(0);
    setMs(0);
    try {
      rec.current = await startRecording({ onLevel: setLevel, maxMs: 60000, onAuto: () => stop() });
      vibrate();
      setState({ status: 'rec' });
    } catch (e) {
      setState({ status: 'error', error: micErrText(e), mic: true });
    }
  };
  const stop = async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    const o = job.start();
    setMode('audio');
    setState({ status: 'loading' });
    const audio = await r.stop();
    if (audio.ms < 700 || !audio.base64) {
      setState({ status: 'error', error: 'Das war zu kurz – halt den Knopf nicht gedrückt, sondern tippe einmal, sprich und tippe dann auf „Fertig“.' });
      return;
    }
    analyze({ audio: { mime: audio.mime, base64: audio.base64 } }, o);
  };
  const cancelRec = () => {
    rec.current && rec.current.cancel();
    rec.current = null;
    setState({ status: 'idle' });
  };

  useEffect(() => {
    if (text0 && ai) analyze({ text: text0 });
  }, []);

  const chosen = items.filter((i) => i.on);
  const total = chosen.reduce((a, it) => a + scale(it.per100, it.grams).kcal, 0);
  const setItem = (id, patch) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const save = () => {
    addEntries(
      dayKey,
      chosen.map((it) => makeEntry({ food: { name: it.name, per100: it.per100, fv: it.fv, source: 'ai' }, grams: it.grams, meal, source: text0 ? 'ai-text' : 'ai-voice' })),
    );
    vibrate();
    toast(`${chosen.length} ${chosen.length === 1 ? 'Eintrag' : 'Einträge'} → ${mealLabel(meal)}`);
    closeSheet();
  };
  const setMealT = (m) => ((mealTouched.current = true), setMeal(m));

  if (!ai) {
    return (
      <Sheet title="Per Sprache eintragen" onBack={back ? () => openSheet(back.name, back.props) : undefined}>
        <div class="notice">
          <p>Fürs Sprechen wertet die KI aus, was du sagst – dafür brauchst du einmalig den kostenlosen KI-Schlüssel.</p>
          <button
            class="btn btn--sm"
            onClick={() => {
              closeSheet();
              nav('/einstellungen?ki=1');
            }}
          >
            KI einrichten (2 Minuten, kostenlos)
          </button>
        </div>
        <p class="small muted">Ohne KI: Tipp ins Suchfeld und dann aufs Mikrofon der iPhone-Tastatur – so kannst du einzelne Lebensmittel diktieren.</p>
      </Sheet>
    );
  }

  const recording = state.status === 'rec';
  return (
    <Sheet
      title={text0 ? 'KI-Schätzung' : 'Per Sprache eintragen'}
      tall
      onBack={back && !recording ? () => openSheet(back.name, back.props) : undefined}
      footer={
        state.status === 'done' && (
          <button class="btn btn--primary btn--block" disabled={!chosen.length} onClick={save}>
            Eintragen · {n0(total)} kcal
          </button>
        )
      }
    >
      {(state.status === 'idle' || recording || (state.status === 'error' && !text)) && (
        <div class="voice">
          {canRecord() ? (
            <>
              <button class={'voice__btn' + (recording ? ' voice__btn--on' : '')} style={{ '--lvl': recording ? level : 0 }} onClick={recording ? stop : start} aria-label={recording ? 'Aufnahme beenden' : 'Aufnahme starten'}>
                {recording ? <Square size={30} fill="currentColor" /> : <Mic size={34} />}
              </button>
              <p class="voice__state">{recording ? <>Ich höre zu … <span class="tnum">{fmtSec(ms)}</span></> : 'Tippen und sagen, was du gegessen hast'}</p>
              {recording ? (
                <div class="row" style={{ justifyContent: 'center' }}>
                  <button class="btn btn--sm" onClick={cancelRec}>
                    <X size={16} /> Abbrechen
                  </button>
                  <button class="btn btn--sm btn--primary" onClick={stop}>
                    <Check size={16} /> Fertig
                  </button>
                </div>
              ) : (
                <p class="small muted center">z. B. „Zum Frühstück zwei Scheiben Vollkornbrot mit Butter und Gouda, dazu ein Glas Orangensaft“</p>
              )}
            </>
          ) : (
            <p class="small muted">Aufnehmen geht in diesem Browser nicht – schreib es einfach unten rein (oder nutz das Mikrofon der Tastatur).</p>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <AiProgress
          p={job.p}
          steps={mode === 'audio' ? ['Aufnahme umwandeln', 'An die KI senden', 'KI hört zu & versteht', 'Lebensmittel & Mengen'] : ['Text vorbereiten', 'An die KI senden', 'KI versteht, was du gegessen hast', 'Lebensmittel & Mengen']}
          expect={600}
          onCancel={job.cancel}
        />
      )}

      {state.status === 'error' && (
        <div class="notice notice--warn">
          <p>{state.error}</p>
          {state.noKey && (
            <button
              class="btn btn--sm"
              onClick={() => {
                closeSheet();
                nav('/einstellungen?ki=1');
              }}
            >
              KI einrichten
            </button>
          )}
        </div>
      )}

      {state.status === 'done' && <AiItems items={items} setItem={setItem} meal={meal} setMeal={setMealT} title={state.title} hint={state.hint} />}

      {!recording && state.status !== 'loading' && (
        <details class="more" open={state.status !== 'idle' || !canRecord()}>
          <summary>{text ? 'Verstanden – Text korrigieren' : 'Lieber schreiben'}</summary>
          <textarea class="input voice__text" rows={3} placeholder="z. B. 250 g Spaghetti Bolognese und ein Apfel" value={text} onInput={(e) => setText(e.currentTarget.value)} />
          <div class="row">
            <button class="btn btn--sm" disabled={text.trim().length < 2} onClick={() => analyze({ text: text.trim() })}>
              <RefreshCw size={16} /> {state.status === 'done' ? 'Neu auswerten' : 'Auswerten'}
            </button>
            {state.status !== 'idle' && canRecord() && (
              <button class="btn btn--sm" onClick={start}>
                <Mic size={16} /> Nochmal sprechen
              </button>
            )}
          </div>
        </details>
      )}
      {state.status === 'done' && <p class="small muted">Die KI schätzt – Mengen kurz prüfen. Die Aufnahme geht dafür an Google Gemini und wird nicht gespeichert.</p>}
    </Sheet>
  );
}
