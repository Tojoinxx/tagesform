// Statistik › Körper: Trendgewicht, echter Verbrauch, Körpermaße
import { useState } from 'preact/hooks';
import { useS, S, saveProfile, patchDay, toast, openSheet, getDay } from '../lib/store.js';
import { weightTrend, trendPerWeek, expenditure } from '../lib/body.js';
import { calcTargets, targetsOf } from '../lib/nutrition.js';
import { MEASURES, checkList } from '../lib/checks.js';
import { LineChart, dateLbl } from './charts.jsx';
import { NumInput } from './common.jsx';
import { FormCheckCard } from './formcheck.jsx';
import { n0, n1, num, todayKey } from '../lib/util.js';
import { Scale, Flame, Ruler, Plus } from 'lucide-preact';

const sgn = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${String(Math.round(Math.abs(v) * 10 ** d) / 10 ** d).replace('.', ',')}`;
const kc = (v) => Math.round(v).toLocaleString('de-DE');

function TrendCard() {
  useS();
  const [w, setW] = useState('');
  const s = weightTrend(120);
  const tk = todayKey();
  const todayW = getDay(tk).weight;
  const last = s[s.length - 1];
  const rate = trendPerWeek();
  const goal = (S.profile && S.profile.goal) || 'halten';
  const pts = s.slice(-10);
  const note =
    rate == null
      ? 'Wieg dich 3–7× pro Woche morgens nach dem Klo – dann wird der Trend aussagekräftig.'
      : goal === 'abnehmen'
        ? rate < -0.15
          ? 'Du nimmst ab – passt. 0,3–0,8 kg pro Woche sind ideal, um Muskeln zu halten.'
          : 'Trend noch flach – bleib dran oder iss etwas weniger.'
        : goal === 'aufbauen'
          ? rate > 0.4
            ? 'Zunahme recht schnell – etwas weniger essen hält das Fett gering (ideal 0,1–0,3 kg/Woche).'
            : rate > 0.05
              ? 'Saubere Zunahme – genau richtig für Muskelaufbau.'
              : 'Kaum Zunahme – für Muskelaufbau ruhig etwas mehr essen.'
          : Math.abs(rate) <= 0.2
            ? 'Stabil – passt zu deinem Ziel „Halten“.'
            : 'Der Trend bewegt sich – beobachte es noch 1–2 Wochen.';
  return (
    <section class="card">
      <h3 class="h3row">
        <Scale size={18} /> Trendgewicht
      </h3>
      {last ? (
        <>
          <div class="bigstat">
            <b class="tnum">{n1(last.t)} kg</b>
            {rate != null && <span class={'tnum ' + (Math.abs(rate) < 0.05 ? 'muted' : '')}>{sgn(rate, 2)} kg / Woche</span>}
          </div>
          {pts.length >= 2 && <LineChart values={pts.map((p) => p.t)} raw={pts.map((p) => p.w)} labels={pts.map((p) => dateLbl(p.k))} fmt={n1} h={150} />}
          <p class="small muted">Linie = Trend (Tagesschwankungen durch Wasser, Salz & Essen herausgerechnet), graue Punkte = Waage. {note}</p>
        </>
      ) : (
        <p class="small muted">Noch keine Wiegung – trag unten dein Gewicht ein.</p>
      )}
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          const v = num(w);
          if (v > 30 && v < 300) {
            patchDay(tk, { weight: Math.round(v * 10) / 10 });
            setW('');
            toast('Gewicht gespeichert');
          }
        }}
      >
        <NumInput value={w} onChange={setW} placeholder={todayW ? `heute ${n1(todayW)}` : 'Gewicht heute'} suffix="kg" />
        <button class="btn btn--sm" type="submit" disabled={!(num(w) > 30)}>
          Speichern
        </button>
      </form>
    </section>
  );
}

function ExpenditureCard() {
  useS();
  const p = S.profile || {};
  const e = expenditure();
  const t = targetsOf(p);
  const enable = (on) => {
    if (on && !e.ok) return;
    const np = { ...p, tdeeAuto: on, ...(on ? { tdeeLearned: { kcal: e.kcal, at: Date.now() }, kcalAdjust: 0 } : {}) };
    saveProfile(np);
    toast(on ? `Kalorienziel jetzt ${kc(calcTargets(np).kcal)} kcal – passt sich wöchentlich an` : 'Wieder Formel-Schätzung');
  };
  return (
    <section class="card">
      <h3 class="h3row">
        <Flame size={18} /> Dein echter Verbrauch
      </h3>
      {e.ok ? (
        <>
          <div class="bigstat">
            <b class="tnum">~{kc(e.kcal)} kcal</b>
            <span class="muted tnum">Formel: {kc(e.formula)}</span>
          </div>
          <p class="small">
            In den letzten {e.span} Tagen hast du im Schnitt <b>{kc(e.intake)} kcal</b> gegessen und dein Trend hat sich um <b>{sgn(e.deltaKg)} kg</b> verändert. Daraus ergibt sich, was dein Körper wirklich verbraucht{e.conf < 1 ? ' (noch mit der Formel gemittelt – wird mit mehr Tagen genauer)' : ''}.
          </p>
          <label class="toggle">
            <span>
              <b>Kalorienziel daran anpassen</b>
              <small class="muted">Wöchentlich neu berechnet – wie bei MacroFactor. Aktuelles Ziel: {kc(t.kcal)} kcal.</small>
            </span>
            <input type="checkbox" checked={!!p.tdeeAuto} onChange={(ev) => enable(ev.currentTarget.checked)} />
          </label>
        </>
      ) : (
        <>
          <p class="small">Die App lernt aus deinem Gewichtstrend und dem, was du isst, wie viel du wirklich verbrauchst – genauer als jede Formel.</p>
          <p class="small muted">
            Dafür fehlen noch Daten (letzte 4 Wochen): <b>{e.logged}/10</b> Tage vollständig eingetragen, <b>{e.weighIns}/4</b> Wiegungen. Bis dahin gilt die Formel: ~{kc(e.formula)} kcal.
          </p>
          {p.tdeeAuto && (
            <button class="btn btn--sm" onClick={() => enable(false)}>
              Automatik ausschalten
            </button>
          )}
        </>
      )}
    </section>
  );
}

function MeasuresCard() {
  useS();
  const list = checkList().slice().reverse(); // älteste zuerst
  const rows = [
    { id: 'bf', label: 'Körperfett', unit: '%' },
    ...MEASURES.map((m) => ({ id: m.id, label: m.label, unit: 'cm' })),
  ]
    .map((m) => ({ ...m, pts: list.filter((c) => c[m.id] > 0).map((c) => ({ k: c.date, v: c[m.id] })) }))
    .filter((m) => m.pts.length);
  const [open, setOpen] = useState(null);
  return (
    <section class="card">
      <h3 class="h3row">
        <Ruler size={18} /> Körpermaße
      </h3>
      {rows.length ? (
        <ul class="mlist">
          {rows.map((m) => {
            const a = m.pts[0];
            const z = m.pts[m.pts.length - 1];
            const d = z.v - a.v;
            return (
              <li>
                <button class="mlist__row" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                  <span>{m.label}</span>
                  <b class="tnum">
                    {n1(z.v)} {m.unit}
                  </b>
                  <span class={'tnum small ' + (m.pts.length < 2 ? 'muted' : '')}>{m.pts.length < 2 ? 'erste Messung' : `${sgn(d)} ${m.unit} seit ${dateLbl(a.k).join(' ')}`}</span>
                </button>
                {open === m.id && m.pts.length >= 2 && <LineChart values={m.pts.slice(-8).map((p) => p.v)} labels={m.pts.slice(-8).map((p) => dateLbl(p.k))} fmt={n1} h={130} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="small muted">Noch keine Maße. Beim Muskelaufbau sagen Oberarm, Brust und Bauch oft mehr als die Waage.</p>
      )}
      <button class="btn btn--sm" onClick={() => openSheet('formcheck')}>
        <Plus size={15} /> Maße eintragen
      </button>
    </section>
  );
}

export function BodyStats() {
  return (
    <div class="page">
      <header class="pagehead">
        <h1>Körper</h1>
      </header>
      <TrendCard />
      <ExpenditureCard />
      <MeasuresCard />
      <FormCheckCard />
    </div>
  );
}
