import { useState } from 'preact/hooks';
import { useS, S, saveWeek, patchDay, getDay, toast, setS } from '../lib/store.js';
import { weekStats, weekAdvice } from '../lib/week.js';
import { hasAi, aiErrText } from '../lib/ai.js';
import { weekSummaryAi } from '../lib/aitasks.js';
import { addDays, fmtShortDate, n0, n1, todayKey, weekStart, num } from '../lib/util.js';
import { Spinner, NumInput } from './common.jsx';
import { useAiJob, AiProgress } from './aiprogress.jsx';
import { FormCheckCard } from './formcheck.jsx';
import { ChevronLeft, ChevronRight, PenLine, Flame, Beef, Droplet, Apple, GlassWater, Wheat, Candy, HeartPulse, Sparkles, Check, Scale, RefreshCw } from 'lucide-preact';
import { nav } from './router.js';

const ICONS = { pen: PenLine, flame: Flame, beef: Beef, droplet: Droplet, apple: Apple, glass: GlassWater, wheat: Wheat, candy: Candy, pain: HeartPulse };

function KcalChart({ perDay, target }) {
  const max = Math.max(target * 1.3, ...perDay.map((d) => d.kcal));
  const H = 120;
  return (
    <div class="chart" role="img" aria-label="Kalorien pro Tag">
      <div class="chart__line" style={{ bottom: (target / max) * H + 18 + 'px' }}>
        <span>Ziel</span>
      </div>
      {perDay.map((d) => (
        <div class="chart__col" key={d.key}>
          <div class="chart__barwrap" style={{ height: H + 'px' }}>
            <div
              class={'chart__bar' + (d.kcal > target * 1.1 ? ' chart__bar--hi' : '') + (!d.logged ? ' chart__bar--weak' : '')}
              style={{ height: Math.max(d.kcal ? 3 : 0, (d.kcal / max) * H) + 'px' }}
              title={`${n0(d.kcal)} kcal`}
            />
          </div>
          <span class={'chart__lbl' + (d.key === todayKey() ? ' chart__lbl--today' : '')}>{d.wd}</span>
        </div>
      ))}
    </div>
  );
}

export function Week({ query }) {
  const s = useS();
  const [start, setStart] = useState(() => {
    const w = weekStart(todayKey());
    return query && query.last ? addDays(w, -7) : w;
  });
  const [ai, setAi] = useState({ status: 'idle' });
  const [w, setW] = useState('');
  const ws = weekStats(start, s.profile);
  const adv = weekAdvice(ws, s.profile);
  const { st, targets: t } = ws;
  const saved = s.weeks[start] && s.weeks[start].ai;
  const isCurrent = start === weekStart(todayKey());
  const prevWs = weekStats(addDays(start, -7), s.profile);

  const headline = !adv.enough ? 'Noch zu wenig Daten' : adv.tips.length === 0 ? 'Starke Woche 💪' : adv.good.length >= adv.tips.length ? 'Solide Woche 👍' : 'Da geht noch was 🙂';

  const job = useAiJob();
  const runAi = async () => {
    setAi({ status: 'loading' });
    try {
      const r = await weekSummaryAi(ws, adv, job.start());
      saveWeek(start, { ai: r, aiAt: Date.now() });
      setAi({ status: 'idle' });
    } catch (e) {
      setAi(e.aborted ? { status: 'idle' } : { status: 'error', error: aiErrText(e) });
    }
  };

  const tk = todayKey();
  const todayWeight = getDay(tk).weight;

  return (
    <div class="page">
      <header class="dayhead">
        <button class="iconbtn" onClick={() => setStart(addDays(start, -7))} aria-label="Vorherige Woche">
          <ChevronLeft size={22} />
        </button>
        <div class="dayhead__title">
          <h1>Wochen-Check</h1>
          <span>
            KW {ws.week} · {fmtShortDate(start)} – {fmtShortDate(addDays(start, 6))}
          </span>
        </div>
        <button class="iconbtn" onClick={() => setStart(addDays(start, 7))} disabled={isCurrent} aria-label="Nächste Woche">
          <ChevronRight size={22} />
        </button>
      </header>

      <section class="card hero">
        {saved ? (
          <>
            <div class="hero__tag">
              <Sparkles size={14} /> KI-Fazit
            </div>
            <h2>{saved.headline}</h2>
            {saved.intro && <p>{saved.intro}</p>}
            <ul class="aitips">
              {saved.tips.map((x) => (
                <li>
                  <span class="aitips__e">{x.emoji}</span>
                  <span>{x.text}</span>
                </li>
              ))}
            </ul>
            {saved.idea && (
              <p class="hero__idea">
                <b>Idee für nächste Woche:</b> {saved.idea}
              </p>
            )}
          </>
        ) : (
          <>
            <h2>{headline}</h2>
            <p class="muted">
              {st.n} von 7 Tagen eingetragen{isCurrent ? ' (Woche läuft noch)' : ''}. {adv.enough ? 'Es zählt der Schnitt – einzelne Ausreißer sind egal.' : ''}
            </p>
          </>
        )}
        {adv.good.length > 0 && (
          <ul class="good">
            {adv.good.map((g) => (
              <li>
                <Check size={16} /> {g}
              </li>
            ))}
          </ul>
        )}
        {hasAi() && adv.enough && (
          <button class="btn btn--sm" onClick={runAi} disabled={ai.status === 'loading'}>
            {ai.status === 'loading' ? <Spinner size={16} /> : saved ? <RefreshCw size={16} /> : <Sparkles size={16} />}
            {saved ? 'Neu zusammenfassen' : 'Mit KI zusammenfassen'}
          </button>
        )}
        {ai.status === 'loading' && <AiProgress p={job.p} steps={['Woche auswerten', 'An die KI senden', 'KI schreibt dein Fazit', 'Fazit formulieren']} expect={900} namesLabel="Thema" onCancel={job.cancel} />}
        {ai.status === 'error' && <div class="notice notice--warn small">{ai.error}</div>}
      </section>

      {adv.tips.length > 0 && <h4 class="sect sect--page">Für nächste Woche</h4>}
      {adv.tips.map((tip) => {
        const I = ICONS[tip.icon] || Sparkles;
        return (
          <section class="card tip" key={tip.id}>
            <span class={'tip__icon tip__icon--' + tip.icon}>
              <I size={20} />
            </span>
            <div>
              <h3>{tip.title}</h3>
              <p>{tip.text}</p>
            </div>
          </section>
        );
      })}

      <h4 class="sect sect--page">Kalorien pro Tag</h4>
      <section class="card">
        <KcalChart perDay={ws.perDay} target={t.kcal} />
      </section>

      <h4 class="sect sect--page">Im Schnitt pro Tag</h4>
      <div class="stats">
        <Stat label="Kalorien" value={n0(st.kcal)} target={`Ziel ${n0(t.kcal)}`} ok={Math.abs(st.kcal - t.kcal) / t.kcal <= 0.1} n={st.n} />
        <Stat label="Eiweiß" value={`${n0(st.p)} g`} target={`Ziel ${t.p} g`} ok={st.p >= t.p * 0.9} n={st.n} />
        <Stat label="Fettanteil" value={`${n0(st.fatPct)} %`} target="ideal 25–35 %" ok={st.fatPct <= 38} n={st.n} />
        <Stat label="Obst & Gemüse" value={`${n1(st.fv)} Port.`} target={`Ziel ${t.fv}`} ok={st.fv >= 4} n={st.n} />
        <Stat label="Wasser" value={st.waterDays ? `${n1(st.water / 1000)} l` : '–'} target={`Ziel ${n1(t.water / 1000)} l`} ok={st.water >= t.water * 0.9} n={st.waterDays} />
        <Stat label="Ballaststoffe" value={`${n0(st.fiber)} g`} target="Ziel 30 g" ok={st.fiber >= 25} n={st.n} />
      </div>

      <h4 class="sect sect--page">Gewicht</h4>
      <section class="card weight">
        <div class="weight__row">
          <Scale size={20} class="muted" />
          <div class="weight__info">
            <b class="tnum">{st.weight ? `Ø ${n1(st.weight)} kg` : 'Diese Woche noch nicht gewogen'}</b>
            {st.weight && prevWs.st.weight ? (
              <span class="small muted tnum">
                {st.weight - prevWs.st.weight >= 0 ? '+' : ''}
                {n1(st.weight - prevWs.st.weight)} kg zur Vorwoche
              </span>
            ) : (
              <span class="small muted">Am besten morgens nach dem Aufstehen, 1–2× pro Woche</span>
            )}
          </div>
        </div>
        {isCurrent && (
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
            <NumInput value={w} onChange={setW} placeholder={todayWeight ? `heute ${n1(todayWeight)}` : 'Gewicht heute'} suffix="kg" />
            <button class="btn btn--sm" type="submit" disabled={!(num(w) > 30)}>
              Speichern
            </button>
          </form>
        )}
      </section>

      <div style={{ height: '14px' }} />
      <FormCheckCard />

      <h4 class="sect sect--page">Tagesform & Training</h4>
      <section class="card">
        <div class="formsum">
          <div>
            <span class="muted small">Trainings</span>
            <b class="tnum">{st.trainings}</b>
          </div>
          <div>
            <span class="muted small">Ø Energie</span>
            <b class="tnum">{st.energy ? n1(st.energy) + ' / 5' : '–'}</b>
          </div>
          <div>
            <span class="muted small">Schmerzen</span>
            <b>{st.pains.length ? st.pains.map((p) => `${p.area} ${p.days}×`).join(', ') : 'keine'}</b>
          </div>
        </div>
        <button class="btn--link small" onClick={() => nav('/training')}>
          Zum Training →
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value, target, ok, n }) {
  return (
    <div class={'stat' + (n ? (ok ? ' stat--ok' : ' stat--warn') : '')}>
      <span class="stat__label">{label}</span>
      <b class="stat__val tnum">{n ? value : '–'}</b>
      <span class="stat__target">{target}</span>
    </div>
  );
}
