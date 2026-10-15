import { useState, useEffect } from 'preact/hooks';
import { useS, S, saveTraining, saveActive, toast, patchDay, openSheet, getDay } from '../lib/store.js';
import { EXPERIENCE, setupOf, defaultSetup, recommend, buildSession, weekPlan, dayShort, dayName, SPORTS, sportOf, cycleWeek, weekSetup, gameDayForWeek, sessionOf, rotationOf, usesMyPlan, SPORT_PROFILE, TRAIN_GOALS, EQUIP_CATS, EQUIP_PRESETS, FOCUS, LIMIT_AREAS, splitsFor, recommendSplit, fatigueState, goalOf } from '../lib/training.js';
import { TrainingOptionsCard } from './planeditor.jsx';
import { BreakCard, SickPanel, CardioPanel, endBreak, breakEmoji } from './breaks.jsx';
import { ProgressCard } from './progress.jsx';
import { weekStart, addDays, isoWeek } from '../lib/util.js';
import { SESSIONS, ROTATIONS, EXERCISES, SPLITS } from '../lib/exercises.js';
import { todayKey, uid, n1, fmtShortDate } from '../lib/util.js';
import { Chip, Seg, Field } from './common.jsx';
import { OtherTrainingCard, Last7Card, ENERGY } from './form.jsx';
import { Dumbbell, Play, Check, Settings2, ChevronRight, Pencil, Sparkles, TriangleAlert, Info, Download } from 'lucide-preact';
import { nav } from './router.js';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export const fmtTarget = (it) => {
  const sets = it.sets.length;
  const r = it.target.reps;
  const w = it.target.w;
  return `${sets} × ${r} ${it.unit === 'Sek.' ? 'Sek.' : ''}${w ? ` · ${n1(w)} kg` : ''}`.replace('  ', ' ');
};

import { ExCard, ExAnim, startWorkout } from './exui.jsx';
export { startWorkout };

export function SetupCard({ onDone, initial, embedded, fresh }) {
  const [st, setSt] = useState(() => initial || { ...defaultSetup(), goal: S.profile && S.profile.goal === 'abnehmen' ? 'fit' : 'muskel' });
  const set = (p) => setSt((o) => ({ ...o, ...p }));
  const toggleDay = (d) => set({ handballDays: st.handballDays.includes(d) ? st.handballDays.filter((x) => x !== d) : [...st.handballDays, d] });
  const gymDays = st.gymDays || [];
  const myRot = (S.training && S.training.myRotation) || [];
  const hasMy = myRot.length > 0;
  const toggleGym = (d) => set({ gymDays: gymDays.includes(d) ? gymDays.filter((x) => x !== d) : [...gymDays, d] });
  const sp = st.sport === 'andere' ? { ...SPORTS.find((x) => x.id === 'andere'), name: (st.sportName || '').trim() || 'Sport' } : SPORTS.find((x) => x.id === st.sport) || SPORTS[0];
  const list = splitsFor(st);
  const rec = recommendSplit(st);
  const splitSel = st.split && list.some((x) => x.id === st.split) ? st.split : rec.id;
  const eq = Array.isArray(st.equip) ? st.equip : null;
  const preset = !eq ? 'studio' : (EQUIP_PRESETS.find((p) => p.cats && p.cats.length === eq.length && p.cats.every((c) => eq.includes(c))) || { id: 'custom' }).id;
  const toggleEq = (c) => {
    const cur = eq || EQUIP_CATS.map((x) => x.id);
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
    set({ equip: next.length === EQUIP_CATS.length ? null : next, split: null });
  };
  const focus = st.focus || [];
  const toggleFocus = (id) => {
    if (focus.includes(id)) return set({ focus: focus.filter((x) => x !== id), split: null });
    if (focus.length >= 3) return toast('Höchstens 3 Schwerpunkte – sonst ist es kein Schwerpunkt mehr 😉');
    set({ focus: [...focus, id], split: null });
  };
  const limits = st.limits || [];
  const toggleLimit = (a) => set({ limits: limits.includes(a) ? limits.filter((x) => x !== a) : [...limits, a] });
  return (
    <section class="card form">
      {!embedded && (
        <>
          <h3>
            <Sparkles size={18} /> {fresh ? 'Neuen Plan erstellen' : 'Dein Trainingsplan'}
          </h3>
          <p class="small muted">Ich baue dir einen Plan, der zu deinem Ziel, deiner Ausstattung und deinem Sport passt – und sich an Tagesform und Schmerzen anpasst.</p>
        </>
      )}
      <Field group label="Was ist dein Ziel?">
        <div class="opts opts--grid2">
          {TRAIN_GOALS.map((g) => (
            <button type="button" class={'opt' + ((st.goal || 'muskel') === g.id ? ' opt--on' : '')} onClick={() => set({ goal: g.id, split: null })} aria-pressed={(st.goal || 'muskel') === g.id}>
              <b>{g.label}</b>
              <span>{g.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field group label="Trainingserfahrung mit Krafttraining">
        <div class="opts opts--row">
          {EXPERIENCE.map((x) => (
            <button type="button" class={'opt' + (st.experience === x.id ? ' opt--on' : '')} onClick={() => set({ experience: x.id, split: null })} aria-pressed={st.experience === x.id}>
              <b>{x.label}</b>
              <span>{x.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field group label="Wo trainierst du?" hint={preset === 'studio' ? 'Alle Geräte verfügbar.' : 'Übungen, für die dir Geräte fehlen, ersetzt die App automatisch.'}>
        <div class="opts opts--grid2">
          {EQUIP_PRESETS.map((p) => (
            <button type="button" class={'opt' + (preset === p.id ? ' opt--on' : '')} onClick={() => set({ equip: p.cats ? [...p.cats] : null, split: null })} aria-pressed={preset === p.id}>
              <b>{p.label}</b>
              <span>{p.hint}</span>
            </button>
          ))}
        </div>
        {preset !== 'studio' && (
          <div class="chips chips--wrap" style={{ marginTop: '8px' }}>
            {EQUIP_CATS.map((c) => (
              <Chip small active={!eq || eq.includes(c.id)} onClick={() => toggleEq(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}
      </Field>
      <Field group label="Wie oft willst du pro Woche trainieren?">
        <Seg value={String(st.perWeek)} onChange={(v) => set({ perWeek: Number(v), split: null })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: n + '×' }))} />
      </Field>
      <Field group label="Plan-Vorschläge" hint="Übungen, Sätze und Reihenfolge kannst du danach jederzeit anpassen.">
        <div class="opts">
          {list.map((x) => {
            const on = st.planType !== 'eigen' && splitSel === x.id;
            return (
              <button type="button" class={'opt' + (on ? ' opt--on' : '')} onClick={() => set({ split: x.id, planType: 'auto' })} aria-pressed={on}>
                <b>
                  {x.name}
                  {rec.id === x.id && <span class="tag tag--star">⭐ Empfohlen</span>}
                </b>
                <span>{rec.id === x.id ? `Für dich: ${rec.why}.` : x.hint}</span>
                <span class="opt__sess">{x.rot.map((id) => SESSIONS[id].short).join(' · ')}</span>
              </button>
            );
          })}
          {embedded && <p class="small muted">Nichts Passendes dabei? Nach der Einführung kannst du unter Training → „Eigenen Plan zusammenstellen“ alles selbst festlegen.</p>}
          {!embedded && (
            <button type="button" class={'opt' + (st.planType === 'eigen' ? ' opt--on' : '')} onClick={() => set({ planType: 'eigen' })} aria-pressed={st.planType === 'eigen'}>
              <b>Eigener Plan</b>
              <span>{hasMy ? myRot.map((x) => sessionOf(x).name).join(' · ') : 'Einheiten und Übungen selbst zusammenstellen'}</span>
            </button>
          )}
        </div>
      </Field>
      <Field group label="Zeit pro Einheit">
        <Seg
          value={String(st.minutes)}
          onChange={(v) => set({ minutes: Number(v) })}
          options={[
            { id: '45', label: '45 Min' },
            { id: '60', label: '60 Min' },
            { id: '75', label: '75+ Min' },
          ]}
        />
      </Field>
      <Field group label="Vereinssport / weitere Sportart" hint="Plan legt keine schweren Beine direkt davor und ergänzt passende Vorbeugeübungen">
        <div class="chips chips--wrap">
          {SPORTS.map((x) => (
            <Chip small active={st.sport === x.id} onClick={() => set({ sport: x.id, split: null, ...(x.id === 'keiner' ? { handballDays: [], gameDay: null } : {}), ...(x.games ? {} : { gameDay: null }) })}>
              {x.emoji ? x.emoji + ' ' : ''}
              {x.name}
            </Chip>
          ))}
        </div>
      </Field>
      {st.sport === 'andere' && (
        <Field label="Welche Sportart?">
          <input class="input" value={st.sportName || ''} placeholder="z. B. Badminton, Klettern" onInput={(e) => set({ sportName: e.currentTarget.value })} />
        </Field>
      )}
      {st.sport !== 'keiner' && SPORT_PROFILE[st.sport] && (
        <label class="toggle">
          <span>
            <b>Plan auf {sp.name} zuschneiden</b>
            <small class="muted">Baut passende Übungen ein: {SPORT_PROFILE[st.sport].focus}.</small>
          </span>
          <input type="checkbox" checked={st.sportFocus !== false} onChange={(e) => set({ sportFocus: e.currentTarget.checked })} />
        </label>
      )}
      {st.sport !== 'keiner' && (
        <Field group label={`${sp.name}-Training an`}>
          <div class="daypick">
            {WEEK.map((d) => (
              <button type="button" class={'daypick__d' + (st.handballDays.includes(d) ? ' daypick__d--on' : '')} onClick={() => toggleDay(d)} aria-pressed={st.handballDays.includes(d)}>
                {dayShort(d)}
              </button>
            ))}
          </div>
        </Field>
      )}
      {st.sport !== 'keiner' && sp.games && (
        <Field group label="Saison" hint="In der Saison plant die App um deine Spiele herum (Tag davor frei, Beine mit Abstand, etwas weniger Beinvolumen).">
          <Seg
            value={st.season === 'off' ? 'off' : 'on'}
            onChange={(v) => set({ season: v })}
            options={[
              { id: 'on', label: 'Saison läuft' },
              { id: 'off', label: 'Vorbereitung / Pause' },
            ]}
          />
        </Field>
      )}
      {st.sport !== 'keiner' && sp.games && st.season !== 'off' && (
        <Field group label="Spiele meistens am" hint="Einzelne Wochen (Auswärtsspiel, spielfrei) stellst du im Training-Tab um.">
          <Seg
            value={String(st.gameDay ?? 'x')}
            onChange={(v) => set({ gameDay: v === 'x' ? null : Number(v) })}
            options={[
              { id: 'x', label: 'Wechselnd' },
              { id: '5', label: 'Fr' },
              { id: '6', label: 'Sa' },
              { id: '0', label: 'So' },
            ]}
          />
        </Field>
      )}
      <Field group label="Zusätzlich Laufen (optional)" hint="Zählt nicht zum Pflicht-Ziel: Die App schlägt den Lauf an freien Tagen vor – nicht am Spieltag und nicht am Tag davor. Wenn die Zeit fehlt, einfach auslassen.">
        <Seg value={String(st.cardio || 0)} onChange={(v) => set({ cardio: Number(v) })} options={[0, 1, 2].map((n) => ({ id: String(n), label: n ? `bis ${n}× / Woche` : 'Nein' }))} />
      </Field>
      <Field group label="Wann kannst du ins Gym?" hint={gymDays.length ? `${gymDays.length} Tage ausgewählt – die App plant nur hier.` : 'Nichts gewählt = flexibel: 1–2 Tage unter der Woche, Rest am Wochenende.'}>
        <div class="daypick">
          {WEEK.map((d) => {
            const blocked = st.handballDays.includes(d);
            return (
              <button type="button" disabled={blocked} class={'daypick__d' + (gymDays.includes(d) ? ' daypick__d--on' : '')} onClick={() => toggleGym(d)} aria-pressed={gymDays.includes(d)}>
                {dayShort(d)}
              </button>
            );
          })}
        </div>
      </Field>
      <details class="more" open={focus.length > 0 || limits.length > 0}>
        <summary>Schwerpunkte & Beschwerden {focus.length + limits.length ? `(${focus.length + limits.length})` : ''}</summary>
        <Field group label="Schwerpunkt-Muskeln (max. 3)" hint="Bekommen 1 Satz mehr und eine passende Zusatzübung.">
          <div class="chips chips--wrap">
            {FOCUS.map((f) => (
              <Chip small active={focus.includes(f.id)} onClick={() => toggleFocus(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field group label="Dauerhafte Beschwerden" hint="Übungen, die diese Stellen stark belasten, tauscht die App gegen schonende Varianten.">
          <div class="chips chips--wrap">
            {LIMIT_AREAS.map((x) => (
              <Chip small active={limits.includes(x)} onClick={() => toggleLimit(x)}>
                {x}
              </Chip>
            ))}
          </div>
        </Field>
      </details>
      <button
        class="btn btn--primary btn--block btn--lg"
        onClick={() => {
          const split = st.planType === 'eigen' ? st.split || null : splitSel;
          // Neuer Plan: Zyklus startet neu, eigene Änderungen an Vorlagen-Einheiten werden zurückgesetzt (Gewichte & Verlauf bleiben)
          const custom = fresh ? Object.fromEntries(Object.keys((S.training && S.training.custom) || {}).filter((k) => SESSIONS[k]).map((k) => [k, null])) : undefined;
          saveTraining({ setup: { ...st, split, freqMy: true, cycleStart: fresh ? todayKey() : st.cycleStart || todayKey() }, ...(custom ? { custom: { ...S.training.custom, ...custom } } : {}), createdAt: (S.training && S.training.createdAt) || Date.now() });
          toast(fresh ? 'Neuer Plan gestartet 💪' : initial ? 'Plan aktualisiert' : 'Plan erstellt 💪');
          onDone && onDone();
          if (st.planType === 'eigen' && !hasMy) nav('/plan');
        }}
      >
        <Check size={18} /> {fresh ? 'Neuen Plan starten' : initial ? 'Plan aktualisieren' : embedded ? 'Plan erstellen & weiter' : 'Plan erstellen'}
      </button>
      <button type="button" class="btn--link small center" onClick={() => openSheet('import')}>
        <Download size={14} /> Plan & Gewichte aus einer anderen App übernehmen (Code)
      </button>
    </section>
  );
}

/** Optionaler Lauf an freien Tagen */
function CardioBonus({ id, cardio }) {
  const [open, setOpen] = useState(false);
  const ss = SESSIONS[id];
  return (
    <div class="cardiobonus">
      <button class="cardiobonus__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span class="cardiobonus__ic">🏃</span>
        <span>
          <b>Optional: {ss.name}</b>
          <small class="muted">
            {ss.focus} · {cardio.done}/{cardio.n} diese Woche – nur wenn du Zeit & Lust hast
          </small>
        </span>
        <ChevronRight size={18} class={open ? 'rot90' : ''} />
      </button>
      {open && <CardioPanel sessionId={id} key={id} />}
    </div>
  );
}

/** Ermüdung erkannt → Entlastungswoche anbieten */
function FatigueNotice() {
  useS();
  const f = fatigueState();
  if (!f) return null;
  const ws = weekStart(todayKey());
  return (
    <div class="notice notice--info small fatigue">
      <span>
        <b>Zeit für eine Entlastungswoche?</b> {f.why}. Eine leichtere Woche jetzt (halbe Sätze, ~10 % weniger) bringt dich schneller zurück in Form als Durchziehen.
      </span>
      <div class="row">
        <button class="btn btn--sm btn--primary" onClick={() => (saveTraining({ deloadWeek: ws, setup: { ...setupOf(), cycleStart: addDays(ws, 7) } }), toast('Diese Woche wird leichter – ab nächster Woche startet ein neuer Zyklus'))}>
          Ja, diese Woche leichter
        </button>
        <button class="btn btn--sm" onClick={() => saveTraining({ fatigueDismissed: ws })}>
          Nein, normal weiter
        </button>
      </div>
    </div>
  );
}

function WeekRhythm({ setup: base }) {
  const setup = weekSetup(base);
  const plan = weekPlan(setup);
  const today = new Date().getDay();
  return (
    <>
    {plan.dropped && plan.dropped.length > 0 && !(setup.blocked || []).length && (
      <div class="notice notice--warn small" style={{ marginBottom: '10px' }}>
        <span>
          Mit diesen Tagen passt {plan.dropped.map((x) => sessionOf(x).name).join(', ')} nirgends hin, ohne dass Beine direkt vor Training oder Spiel liegen – also {plan.length}× Gym diese Woche.
        </span>
      </div>
    )}
    <div class="rhythm">
      {WEEK.map((d) => {
        const p = plan.find((x) => x.d === d);
        const hb = (setup.handballDays || []).includes(d);
        const game = setup.gameDay === d;
        return (
          <div class={'rhythm__d' + (d === today ? ' rhythm__d--today' : '') + (p ? ' rhythm__d--gym' : hb || game ? ' rhythm__d--hb' : '')}>
            <span class="rhythm__wd">{dayShort(d)}</span>
            <span class="rhythm__what">{setup.breakDays && setup.breakDays[d] ? breakEmoji(setup.breakDays[d]) : p ? sessionOf(p.sessionId).short : game ? 'Spiel' : hb ? sportOf(setup).emoji || '🏅' : '–'}</span>
          </div>
        );
      })}
    </div>
    </>
  );
}

function GamesCard({ setup }) {
  useS();
  const sp = sportOf(setup);
  const ws = weekStart(todayKey());
  const weeks = [ws, addDays(ws, 7)];
  const set = (w, v) => saveTraining({ games: { ...((S.training && S.training.games) || {}), [w]: v } });
  return (
    <section class="card form">
      <h3>{sp.emoji} Spiele</h3>
      {weeks.map((w, i) => {
        const cur = gameDayForWeek(setup, w);
        return (
          <div class="gamerow">
            <span class="small">
              <b>{i === 0 ? 'Diese Woche' : 'Nächste Woche'}</b>
              <span class="muted"> · KW {isoWeek(w)}</span>
            </span>
            <div class="chips">
              {[
                ['none', 'Keins'],
                [5, 'Fr'],
                [6, 'Sa'],
                [0, 'So'],
              ].map(([v, l]) => (
                <Chip small active={v === 'none' ? cur == null : cur === v} onClick={() => set(w, v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </div>
        );
      })}
      <p class="small muted">Tag vor dem Spiel bleibt frei, Beine mit mindestens 48 h Abstand, Tag danach Regeneration.</p>
    </section>
  );
}

function ExercisePreview({ items }) {
  return (
    <ul class="expv">
      {items.map((it) => (
        <li>
          <span class="expv__name">
            {it.name}
            {it.adaptedFrom && (
              <small class="badge badge--info">
                statt {it.adaptedFrom.name} ({it.adaptedFrom.why})
              </small>
            )}
          </span>
          <span class="expv__t tnum">{fmtTarget(it)}</span>
        </li>
      ))}
    </ul>
  );
}

function TodayCard({ setup }) {
  const s = useS();
  const rec = recommend(setup);
  const [pick, setPick] = useState(null);
  if (rec.status === 'sick')
    return (
      <section class="card today-tr">
        <SickPanel rec={rec} />
      </section>
    );
  if (rec.status === 'urlaub-frei')
    return (
      <section class="card today-tr">
        <div class="today-tr__head">
          <span class="today-tr__badge">🏖️</span>
          <div>
            <h2>Schönen Urlaub!</h2>
            <p class="muted small">Kein Training geplant{rec.brk.to ? ` bis ${fmtShortDate(rec.brk.to)}` : ''} – genieß die Erholung. Danach startest du automatisch sanft wieder ein.</p>
          </div>
        </div>
        <button class="btn--link small" onClick={() => endBreak(rec.brk)}>
          Urlaub vorzeitig beenden
        </button>
      </section>
    );
  const away = !!rec.brk;
  const sessionId = pick || rec.sessionId;
  const tpl = sessionOf(sessionId);
  const sess = buildSession(sessionId, setup);
  const showPlan = rec.status === 'train' || rec.status === 'free' || rec.status === 'urlaub' || pick;

  return (
    <section class={'card today-tr' + (away ? ' today-tr--away' : '')}>
      <div class="today-tr__head">
        <span class="today-tr__badge tnum">
          {rec.doneThisWeek}/{rec.perWeek}
          <small>{away ? 'Urlaub diese Woche' : 'Gym diese Woche'}</small>
        </span>
        <div>
          {rec.status === 'game' && !pick ? (
            <>
              <h2>Spieltag {sportOf(setup).emoji}</h2>
              <p class="muted small">Viel Erfolg! Kein Gym heute. Danach: Eiweiß, Kohlenhydrate, Schlaf.</p>
            </>
          ) : rec.status === 'pregame' && !pick ? (
            <>
              <h2>Morgen Spiel – heute frei</h2>
              <p class="muted small">Frische Beine sind wichtiger. Höchstens 10–15 Min. lockere Mobility.</p>
            </>
          ) : rec.status === 'handball' && !pick ? (
            <>
              <h2>
                Heute {sportOf(setup).name} {sportOf(setup).emoji}
              </h2>
              <p class="muted small">Kein Gym nötig – trag das Training danach unten ein.</p>
            </>
          ) : rec.status === 'done' && !pick ? (
            <>
              <h2>Heute erledigt ✓</h2>
              <p class="muted small">{rec.doneToday.name} – stark! Jetzt Eiweiß und Schlaf.</p>
            </>
          ) : rec.status === 'urlaub-ziel' && !pick ? (
            <>
              <h2>Urlaubsziel erreicht 🏖️</h2>
              <p class="muted small">Damit bleiben deine Muskeln erhalten. Genieß den Rest der Woche – oder:</p>
            </>
          ) : rec.status === 'goal' && !pick ? (
            <>
              <h2>Wochenziel erreicht</h2>
              <p class="muted small">Regeneration ist auch Training. Wenn du trotzdem willst:</p>
            </>
          ) : (
            <>
              <span class="small muted">{pick ? 'Gewählt' : away ? '🏖️ Urlaubs-Training – wann es passt' : rec.status === 'free' ? 'Kein fester Gym-Tag – wenn du Zeit hast' : 'Heute dran'}</span>
              <h2>{sess.name}</h2>
              <p class="muted small">{sess.focus}</p>
            </>
          )}
        </div>
      </div>

      {showPlan && (
        <>
          {(() => {
            const f = getDay(todayKey()).form;
            if (!f || !f.at || f.skipped) return null;
            const e = ENERGY[(f.energy || 3) - 1];
            return (
              <button class="formline" onClick={() => openSheet('wellness', {})}>
                <span>{e.e}</span>
                <span class="small">
                  Tagesform: <b>{e.l}</b>
                  {(f.pains || []).length ? ' · ' + f.pains.map((p) => `${p.area} ${p.level}/10`).join(', ') : ''}
                </span>
                <span class="small muted">ändern</span>
              </button>
            );
          })()}
          {!tpl.away && <button class={'cyclechip' + (sess.cycle && sess.cycle.deload ? ' cyclechip--deload' : '')} onClick={() => openSheet('algo')}>
            {sess.cycle.off ? 'Gleichbleibend' : `Woche ${sess.cycle.n}/5 · ${sess.cycle.label}`} · RIR {sess.cycle.rir} <Info size={14} />
          </button>}
          {tpl.away && !tpl.cardio && <div class="notice notice--ok small"><span>Erhaltungs-Training: Weniger Volumen reicht, solange die Sätze fordernd sind – so verlierst du im Urlaub weder Kraft noch Muskeln.</span></div>}
          {!pick && rec.reasons.filter((r) => rec.status !== 'free' || !r.startsWith('Kein fester')).map((r) => <div class="notice small"><span>{r}</span></div>)}
          {!away && <FatigueNotice />}
          {sess.modeLabel && (
            <div class={'notice small ' + (sess.mode === 'light' || sess.mode === 'comeback' ? 'notice--info' : 'notice--ok')}>
              <span>{sess.modeLabel}</span>
            </div>
          )}
          {sess.notes.map((n) => (
            <div class="notice notice--warn small">
              <TriangleAlert size={15} />
              <span>{n}</span>
            </div>
          ))}
          {tpl.cardio ? <CardioPanel sessionId={sessionId} key={sessionId} /> : <>
          <div class="exlist exlist--c">
            {sess.items.map((it) => (
              <ExCard it={it} compact />
            ))}
          </div>
          <div class="row">
            <button class="btn btn--grow" onClick={() => nav('/einheit?s=' + sessionId)}>
              Ansehen & anpassen
            </button>
            <button class="btn btn--primary btn--grow" onClick={() => startWorkout(sessionId)}>
              <Play size={18} fill="currentColor" /> Starten
            </button>
          </div>
          </>}
        </>
      )}
      {!showPlan && rec.status === 'urlaub-ziel' && (
        <button class="btn btn--block" onClick={() => setPick(rec.sessionId)}>
          {sessionOf(rec.sessionId).name} trotzdem machen
        </button>
      )}
      {rec.cardioToday && !pick && <CardioBonus id={rec.cardioToday} cardio={rec.cardio} />}
      {!showPlan && rec.status === 'goal' && (
        <button class="btn btn--block" onClick={() => setPick(rec.sessionId)}>
          {sessionOf(rec.sessionId).name} trotzdem machen
        </button>
      )}
      {!showPlan && (rec.status === 'handball' || rec.status === 'pregame') && (
        <button class="btn--link small" onClick={() => setPick(rec.sessionId)}>
          Trotzdem ins Gym ({sessionOf(rec.sessionId).name})
        </button>
      )}
      {showPlan && (
        <div class="chips chips--wrap">
          <span class="small muted">Lieber was anderes:</span>
          {[...new Set(rec.rot)]
            .filter((x) => x !== sessionId)
            .map((x) => (
              <Chip small onClick={() => setPick(x)}>
                {sessionOf(x).name}
              </Chip>
            ))}
        </div>
      )}
      {away && (
        <button class="btn--link small" onClick={() => confirm('Urlaub beenden und zum normalen Plan zurück?') && endBreak(rec.brk)}>
          Urlaub beenden
        </button>
      )}
    </section>
  );
}

function PlanOverview({ setup, onNew }) {
  const rot = [...new Set(rotationOf(setup))];
  const mine = usesMyPlan(setup);
  return (
    <div class="sesslist">
      {rot.map((id) => {
        const sess = buildSession(id, setup);
        return (
          <button class="card sesscard" onClick={() => nav('/einheit?s=' + id)}>
            <div class="sesscard__thumbs">
              {sess.items.slice(0, 3).map((it) => (
                <ExAnim id={it.exId} size="xs" play={false} />
              ))}
            </div>
            <div class="sesscard__txt">
              <b>{sess.name}</b>
              <span class="small muted">
                {sess.focus} · {sess.items.length} Übungen
              </span>
            </div>
            <ChevronRight size={20} class="muted" />
          </button>
        );
      })}
      <button class="btn btn--block" onClick={() => nav('/plan')}>
        <Pencil size={16} /> {mine ? 'Meinen Plan bearbeiten' : 'Eigenen Plan zusammenstellen'}
      </button>
      <button class="btn btn--block" onClick={onNew}>
        <Sparkles size={16} /> Neuen Trainingsplan erstellen
      </button>
    </div>
  );
}

export function Training() {
  const s = useS();
  const [editing, setEditing] = useState(false);
  const [fresh, setFresh] = useState(false);
  const myKey = (s.training && s.training.myRotation && s.training.myRotation.join(',')) || '';
  useEffect(() => (setEditing(false), setFresh(false)), [myKey]);
  const hasSetup = !!(s.training && s.training.setup);
  const setup = setupOf();

  return (
    <div class="page">
      <header class="pagehead">
        <h1>Training</h1>
        <div class="row">
          <button class="iconbtn" onClick={() => openSheet('algo')} aria-label="So funktioniert der Trainingsplan">
            <Info size={21} />
          </button>
          {hasSetup && (
            <button class="iconbtn" onClick={() => setEditing(!editing)} aria-label="Plan anpassen">
              <Settings2 size={20} />
            </button>
          )}
        </div>
      </header>

      {s.active && (
        <button class="card cta cta--live" onClick={() => nav('/workout')}>
          <span class="cta__icon">
            <Dumbbell size={22} />
          </span>
          <span class="cta__text">
            <b>{s.active.name} läuft</b>
            <span>Weiter trainieren →</span>
          </span>
        </button>
      )}

      {fresh && hasSetup && (
        <>
          <SetupCard fresh initial={{ ...setup, split: null, planType: 'auto', cycleStart: null }} onDone={() => (setFresh(false), window.scrollTo(0, 0))} />
          <button class="btn btn--block" onClick={() => setFresh(false)}>
            Abbrechen
          </button>
        </>
      )}
      {!fresh && (!hasSetup || editing) && <SetupCard initial={hasSetup ? setup : null} onDone={() => setEditing(false)} />}
      {hasSetup && editing && !fresh && <TrainingOptionsCard />}

      {hasSetup && !editing && !fresh && (
        <>
          {!s.active && <TodayCard setup={setup} />}
          <BreakCard />
          <h4 class="sect sect--page">Dein Wochenrhythmus</h4>
          <section class="card">
            <WeekRhythm setup={setup} />
            <p class="small muted" style={{ marginTop: '10px' }}>
              {sportOf(setup).id !== 'keiner' ? `Schwere Beine nie am Tag vor ${sportOf(setup).name} oder Spiel. ` : ''}
              {setup.cardio ? `Dazu bis ${setup.cardio}× Laufen als Bonus an freien Tagen. ` : ''}Hast du an einem Tag keine Zeit, nimmst du einfach die nächste Einheit – die App merkt sich, wo du stehst.
            </p>
          </section>
          {sportOf(setup).games && setup.season !== 'off' && <GamesCard setup={setup} />}
          <OtherTrainingCard />
          <h4 class="sect sect--page">Alle Einheiten</h4>
          <PlanOverview setup={setup} onNew={() => (setFresh(true), setEditing(false), window.scrollTo(0, 0))} />
          <ProgressCard />
          <Last7Card />
        </>
      )}
    </div>
  );
}
