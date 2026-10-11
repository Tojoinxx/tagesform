import { useS, getDay, patchDay, openSheet, setS } from '../lib/store.js';
import { daySums, mealSums, MEALS, targetsOf } from '../lib/nutrition.js';
import { addDays, fmtDayTitle, fmtShortDate, liters, n0, todayKey, parseKey, n1, isoWeek, weekStart, WD_SHORT } from '../lib/util.js';
import { weekPlan, setupOf } from '../lib/training.js';
import { SESSIONS } from '../lib/exercises.js';
import { S } from '../lib/store.js';
import { Ring, Bar } from './common.jsx';
import { ChevronLeft, ChevronRight, Plus, Minus, GlassWater, Apple, Sparkles, Sunrise, Sun, Moon, Cookie, ChartColumn, HeartPulse, Dumbbell } from 'lucide-preact';
import { nav } from './router.js';

const MEAL_ICON = { fruehstueck: Sunrise, mittag: Sun, abend: Moon, snacks: Cookie };

export function Today() {
  const s = useS();
  const k = s.day;
  const day = getDay(k);
  const t = targetsOf(s.profile);
  const sum = daySums(day);
  const rest = t.kcal - sum.kcal;
  const isToday = k === todayKey();
  const wd = parseKey(k).getDay();
  const showWeekBanner = isToday && (wd === 0 || wd === 1);
  const formMissing = isToday && !(day.form && day.form.at);

  return (
    <div class="page">
      <header class="dayhead">
        <button class="iconbtn" onClick={() => setS({ day: addDays(k, -7) })} aria-label="Vorherige Woche">
          <ChevronLeft size={22} />
        </button>
        <button class="dayhead__title" onClick={() => setS({ day: todayKey() })}>
          <h1>{fmtDayTitle(k)}</h1>
          <span>
            {fmtDayTitle(k) !== fmtShortDate(k) ? fmtShortDate(k) + ' · ' : ''}KW {isoWeek(k)}
          </span>
        </button>
        <button class="iconbtn" onClick={() => setS({ day: addDays(k, 7) })} aria-label="Nächste Woche">
          <ChevronRight size={22} />
        </button>
      </header>
      <WeekStrip k={k} target={t.kcal} />

      <section class="card summary">
        <div class="summary__top">
          <div class="summary__side">
            <span class="muted">Gegessen</span>
            <b class="tnum">{n0(sum.kcal)}</b>
          </div>
          <Ring value={sum.kcal} max={t.kcal}>
            <b class="ring__big tnum">{n0(Math.abs(rest))}</b>
            <span class="ring__small">{rest >= 0 ? 'kcal übrig' : 'kcal drüber'}</span>
          </Ring>
          <div class="summary__side">
            <span class="muted">Ziel</span>
            <b class="tnum">{n0(t.kcal)}</b>
          </div>
        </div>
        <div class="summary__bars">
          <Bar label="Eiweiß" value={sum.p} max={t.p} color="var(--p)" />
          <Bar label="Kohlenhydrate" value={sum.c} max={t.c} color="var(--c)" />
          <Bar label="Fett" value={sum.f} max={t.f} color="var(--f)" />
        </div>
      </section>

      <div class="duo">
        <section class="card mini">
          <div class="mini__head">
            <GlassWater size={18} color="var(--water)" />
            <span>Wasser</span>
          </div>
          <div class="mini__val tnum">
            <b>{liters(sum.water)}</b> / {liters(t.water)}
          </div>
          <div class="mini__track">
            <div style={{ width: Math.min(100, (sum.water / t.water) * 100) + '%', background: 'var(--water)' }} />
          </div>
          <div class="mini__btns">
            <button class="btn btn--ghost btn--sm" onClick={() => patchDay(k, (d) => ({ waterMl: Math.max(0, (d.waterMl || 0) - 250) }))} aria-label="250 ml weniger">
              <Minus size={16} />
            </button>
            <button class="btn btn--water btn--sm" onClick={() => patchDay(k, (d) => ({ waterMl: (d.waterMl || 0) + 250 }))}>
              <Plus size={16} /> 250 ml
            </button>
          </div>
        </section>
        <section class="card mini">
          <div class="mini__head">
            <Apple size={18} color="var(--fv)" />
            <span>Obst &amp; Gemüse</span>
          </div>
          <div class="mini__val tnum">
            <b>{n1(sum.fv)}</b> / {t.fv} Port.
          </div>
          <div class="dots" aria-hidden="true">
            {Array.from({ length: t.fv }, (_, i) => (
              <span class={'dot' + (sum.fv >= i + 1 ? ' dot--on' : sum.fv > i ? ' dot--half' : '')} />
            ))}
          </div>
          <div class="mini__btns">
            <button class="btn btn--ghost btn--sm" disabled={!(day.fvExtra > 0)} onClick={() => patchDay(k, (d) => ({ fvExtra: Math.max(0, (d.fvExtra || 0) - 1) }))} aria-label="Eine Portion weniger">
              <Minus size={16} />
            </button>
            <button class="btn btn--fv btn--sm" onClick={() => patchDay(k, (d) => ({ fvExtra: (d.fvExtra || 0) + 1 }))}>
              <Plus size={16} /> Portion
            </button>
          </div>
        </section>
      </div>

      <button class="card cta" onClick={() => openSheet('suggest', { dayKey: k })}>
        <span class="cta__icon">
          <Sparkles size={22} />
        </span>
        <span class="cta__text">
          <b>Was soll ich jetzt essen?</b>
          <span>{rest > 0 ? `Vorschläge passend zu ${n0(rest)} kcal und ${n0(Math.max(0, t.p - sum.p))} g Eiweiß` : 'Leichte Ideen für den Rest des Tages'}</span>
        </span>
        <ChevronRight size={20} class="muted" />
      </button>

      {showWeekBanner && (
        <button class="card cta cta--week" onClick={() => nav('/woche' + (wd === 1 ? '?last=1' : ''))}>
          <span class="cta__icon">
            <ChartColumn size={22} />
          </span>
          <span class="cta__text">
            <b>{wd === 0 ? 'Dein Wochen-Check ist da' : 'Rückblick auf letzte Woche'}</b>
            <span>Was lief gut, was du nächste Woche anders machen kannst</span>
          </span>
          <ChevronRight size={20} class="muted" />
        </button>
      )}

      {formMissing && (
        <button class="card cta cta--form" onClick={() => nav('/training')}>
          <span class="cta__icon">
            <HeartPulse size={22} />
          </span>
          <span class="cta__text">
            <b>Wie fühlst du dich heute?</b>
            <span>Kurzer Check – dein Training passt sich daran an</span>
          </span>
          <ChevronRight size={20} class="muted" />
        </button>
      )}

      {MEALS.map((m) => {
        const ms = mealSums(day, m.id);
        const entries = (day.entries || []).filter((e) => e.meal === m.id);
        const Icon = MEAL_ICON[m.id];
        return (
          <section class="card meal" key={m.id}>
            <div class="meal__head">
              <Icon size={20} class="meal__icon" />
              <div class="meal__title">
                <h3>{m.label}</h3>
                <span class="muted tnum">{entries.length ? `${n0(ms.kcal)} kcal · E ${n0(ms.p)} g` : 'Noch nichts eingetragen'}</span>
              </div>
              <button class="addbtn" onClick={() => openSheet('add', { dayKey: k, meal: m.id })} aria-label={`${m.label} hinzufügen`}>
                <Plus size={22} />
              </button>
            </div>
            {entries.length > 0 && (
              <ul class="entries">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button class="entry" onClick={() => openSheet('entry', { dayKey: k, id: e.id })}>
                      <span class="entry__name">
                        {e.name}
                        <small class="muted">
                          {e.grams ? `${n0(e.grams)} ${e.unit || 'g'}` : ''}
                          {e.brand ? ` · ${e.brand}` : ''}
                        </small>
                      </span>
                      <span class="entry__kcal tnum">{n0(e.kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p class="foot-note muted">Ernährung muss nicht perfekt sein – es zählt der Wochenschnitt.</p>
    </div>
  );
}

function MiniRing({ pct, over, size = 36 }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="wk__svg">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" stroke-width="3.5" />
      {pct > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? 'var(--kcal)' : 'var(--accent)'} stroke-width="3.5" stroke-linecap="round" stroke-dasharray={`${c * Math.min(1, pct)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
    </svg>
  );
}

/** Wochenkalender: Kalorien-Ring, Training & Handball pro Tag */
function WeekStrip({ k, target }) {
  const ws = weekStart(k);
  const today = todayKey();
  const hasPlan = !!(S.training && S.training.setup);
  const setup = setupOf();
  const plan = hasPlan ? weekPlan(setup) : [];
  return (
    <div class="wk" role="tablist" aria-label="Woche">
      {Array.from({ length: 7 }, (_, i) => {
        const key = addDays(ws, i);
        const d = parseKey(key);
        const wd = d.getDay();
        const day = getDay(key);
        const sum = daySums(day);
        const workouts = day.workouts || [];
        const hbDone = (day.training || []).some((t) => /Handball/.test(t.type));
        const hbPlanned = hasPlan && ((setup.handballDays || []).includes(wd) || setup.gameDay === wd);
        const gym = plan.find((p) => p.d === wd);
        return (
          <button
            role="tab"
            aria-selected={key === k}
            class={'wk__d' + (key === k ? ' wk__d--sel' : '') + (key === today ? ' wk__d--today' : '') + (key > today ? ' wk__d--future' : '')}
            onClick={() => setS({ day: key })}
            aria-label={`${fmtDayTitle(key)}: ${n0(sum.kcal)} kcal`}
          >
            <span class="wk__wd">{WD_SHORT[wd]}</span>
            <span class="wk__ringwrap">
              <MiniRing pct={sum.kcal / target} over={sum.kcal > target * 1.1} />
              <span class="wk__num tnum">{d.getDate()}</span>
            </span>
            <span class="wk__ic">
              {workouts.length > 0 ? (
                <span class="wk__tag wk__tag--done">
                  <Dumbbell size={11} /> ✓
                </span>
              ) : hbDone || hbPlanned ? (
                <span class={'wk__tag' + (hbDone ? ' wk__tag--done' : '')}>{setup.gameDay === wd ? 'Spiel' : '🤾'}</span>
              ) : gym && key >= today ? (
                <span class="wk__tag wk__tag--plan">{SESSIONS[gym.sessionId].short}</span>
              ) : (
                <span class="wk__tag wk__tag--empty">·</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
