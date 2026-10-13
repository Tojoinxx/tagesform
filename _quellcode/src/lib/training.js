// Trainingsplan-Logik: Wochenrhythmus um den Vereinssport, 5-Wochen-Zyklus, Anpassung an Tagesform & Schmerzen, Progression
import { S, getDay } from './store.js';
import { EXERCISES, SESSIONS, ROTATIONS, SPLITS } from './exercises.js';
import { addDays, parseKey, todayKey, weekStart, WD_SHORT, WD_LONG, dateKey } from './util.js';

export const EXPERIENCE = [
  { id: 'anfaenger', label: 'Einsteiger', hint: 'unter 1 Jahr regelmäßig' },
  { id: 'fortgeschritten', label: 'Fortgeschritten', hint: '1–3 Jahre' },
  { id: 'erfahren', label: 'Erfahren', hint: 'über 3 Jahre' },
];

// Sportarten: overhead = Wurf-/Überkopfsport (Schulter-Prävention), sprint = Sprints & Richtungswechsel (Beinbeuger/Leiste)
export const SPORTS = [
  { id: 'keiner', name: 'Kein Vereinssport', emoji: '' },
  { id: 'handball', name: 'Handball', emoji: '🤾', overhead: true, sprint: true, games: true },
  { id: 'fussball', name: 'Fußball', emoji: '⚽', sprint: true, games: true },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', sprint: true, games: true },
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', overhead: true, games: true },
  { id: 'hockey', name: 'Hockey', emoji: '🏑', sprint: true, games: true },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', overhead: true, sprint: true, games: true },
  { id: 'laufen', name: 'Laufen', emoji: '🏃', sprint: true },
  { id: 'schwimmen', name: 'Schwimmen', emoji: '🏊', overhead: true },
  { id: 'kampfsport', name: 'Kampfsport', emoji: '🥋', games: true },
  { id: 'radfahren', name: 'Radfahren', emoji: '🚴' },
  { id: 'andere', name: 'Andere', emoji: '🏅', games: true },
];

export const defaultSetup = () => ({ experience: 'fortgeschritten', perWeek: 3, minutes: 60, sport: 'keiner', handballDays: [], gameDay: null, gymDays: null });
export const setupOf = () => {
  const raw = (S.training && S.training.setup) || {};
  const st = { ...defaultSetup(), ...raw };
  // ältere Pläne: Handball-Tage ohne Sportart
  if (!raw.sport) st.sport = (raw.handballDays || []).length ? 'handball' : 'keiner';
  if (st.sport === 'keiner') {
    st.handballDays = [];
    st.gameDay = null;
  }
  return st;
};
export const sportOf = (setup = setupOf()) => {
  const sp = SPORTS.find((x) => x.id === setup.sport) || SPORTS[0];
  return sp.id === 'andere' ? { ...sp, name: (setup.sportName || '').trim() || 'Sport' } : sp;
};
export const hasSport = (setup = setupOf()) => setup.sport !== 'keiner' && (setup.handballDays || []).length > 0;

// ---------- Persönliche Trainings-Optionen ----------
export const DEFAULT_PREFS = { restMain: 120, restOther: 75, cycle: true, wellness: true, rirPrompt: true, comeback: true };
export const prefsOf = () => ({ ...DEFAULT_PREFS, ...((S.training && S.training.prefs) || {}) });

/** Übung mit persönlichen Einstellungen (Wdh.-Bereich, Steigerung, Sätze) */
export function exOf(id) {
  const ex = EXERCISES[id];
  const o = S.training && S.training.exOpts && S.training.exOpts[id];
  if (!ex || !o) return ex;
  return { ...ex, reps: o.reps || ex.reps, inc: o.inc != null ? o.inc : ex.inc, sets: o.sets || ex.sets };
}

// ---------- 5-Wochen-Zyklus ----------
export const CYCLE = [
  { label: 'Einstieg', rir: 3, extra: 0, text: 'Technik sauber, 3 Wdh. Reserve' },
  { label: 'Aufbau', rir: 2, extra: 0, text: '2 Wdh. Reserve' },
  { label: 'Mehr Volumen', rir: 2, extra: 1, text: '+1 Satz bei Hauptübungen' },
  { label: 'Intensiv', rir: 1, extra: 1, text: 'bis 1 Wdh. vor dem Versagen' },
  { label: 'Deload', rir: 4, extra: 0, deload: true, text: 'halbe Sätze, ~10 % leichter – Erholung' },
];
export function cycleWeek(k = todayKey()) {
  if (!prefsOf().cycle) return { label: 'Gleichbleibend', rir: 2, extra: 0, text: 'ohne Zyklus', index: -1, n: 0, off: true };
  const tr = S.training || {};
  const start = (tr.setup && tr.setup.cycleStart) || (tr.createdAt ? dateKey(new Date(tr.createdAt)) : k);
  const weeks = Math.round((parseKey(weekStart(k)) - parseKey(weekStart(start))) / (7 * 864e5));
  const i = ((weeks % CYCLE.length) + CYCLE.length) % CYCLE.length;
  return { ...CYCLE[i], index: i, n: i + 1 };
}

/** Vorlage an die Sportart anpassen (Prävention nur, wo sie Sinn ergibt) */
// ---------- Sportart-spezifisches Training ----------
// Je Sportart: Schwerpunkt, Schnellkraft (athletic, kommt an den Anfang – frisch ausführen),
// Unterkörper- und Oberkörper-Ergänzungen (Prävention & Leistung). Wird in die Tagesform-Pläne eingebaut.
export const SPORT_PROFILE = {
  handball: { focus: 'Wurfschulter, Sprungkraft, Richtungswechsel, Beinbeuger & Leiste', athletic: ['box-jump', 'lateral-bound'], lower: ['nordic', 'copenhagen'], upper: ['aussenrotation', 'medball-rotation'] },
  fussball: { focus: 'Sprint & Richtungswechsel, Beinbeuger (Nordics) & Leiste (Copenhagen)', athletic: ['lateral-bound', 'jump-squat'], lower: ['nordic', 'copenhagen'], upper: ['pallof'] },
  basketball: { focus: 'Sprungkraft, saubere Landung, Sprunggelenk & Waden', athletic: ['box-jump', 'einbein-hops'], lower: ['split-squat', 'wadenheben'], upper: ['medball-chest', 'pallof'] },
  volleyball: { focus: 'Sprungkraft, Landung, Schulterstabilität', athletic: ['box-jump', 'einbein-hops'], lower: ['split-squat', 'wadenheben'], upper: ['aussenrotation', 'facepull'] },
  hockey: { focus: 'Leiste & Hüfte, Rotationskraft, unterer Rücken', athletic: ['lateral-bound'], lower: ['copenhagen', 'nordic'], upper: ['medball-rotation', 'pallof'] },
  tennis: { focus: 'Rotationskraft, Schulter (Außenrotation), seitliche Beinarbeit', athletic: ['lateral-bound'], lower: ['split-squat', 'copenhagen'], upper: ['aussenrotation', 'medball-rotation'] },
  laufen: { focus: 'Waden & Achillessehne, einbeinige Stabilität, Hüfte', athletic: ['einbein-hops'], lower: ['wadenheben', 'standwaage'], upper: ['seitstuetz', 'pallof'] },
  schwimmen: { focus: 'Schulterstabilität, Latissimus, Rumpf', athletic: [], lower: ['plank'], upper: ['aussenrotation', 'straight-pulldown'] },
  kampfsport: { focus: 'Rotationskraft, Hüftstreckung, Griff & Rumpf', athletic: ['medball-slam'], lower: ['kb-swing', 'pallof'], upper: ['medball-rotation', 'farmers-walk'] },
  radfahren: { focus: 'Rücken & Haltung (Gegenpol zum Sitzen), einbeinige Kraft, Po', athletic: [], lower: ['split-squat', 'hip-thrust'], upper: ['facepull', 'hyperextension'] },
  andere: { focus: 'Allgemeine Athletik: Sprungkraft, Rumpf, Verletzungsprävention', athletic: ['jump-squat'], lower: ['split-squat'], upper: ['pallof'] },
};
export const sportProfile = (setup = setupOf()) => (setup.sport && setup.sport !== 'keiner' && setup.sportFocus !== false ? SPORT_PROFILE[setup.sport] || null : null);
/** Alle sportspezifischen Übungen (für Vorschläge in eigenen Plänen) */
export const sportExtras = (setup = setupOf()) => {
  const p = SPORT_PROFILE[setup.sport];
  return p ? [...new Set([...p.athletic, ...p.lower, ...p.upper])].filter((id) => EXERCISES[id]) : [];
};

function templateIds(tpl, setup) {
  const sp = sportOf(setup);
  let ids = tpl.ex.map((id) => {
    if (id === 'aussenrotation' && !sp.overhead) return 'reverse-fly';
    if (id === 'nordic' && !sp.sprint) return 'beinbeuger';
    if (id === 'copenhagen' && !sp.sprint) return 'pallof';
    return id;
  });
  const prof = sportProfile(setup);
  if (!prof || tpl.away) return ids;
  const mixed = tpl.legs && /^(GK|BBP)/.test(tpl.id);
  const lowerSess = tpl.legs && !mixed;
  const add = (list, n) => list.filter((x) => EXERCISES[x] && (ids.indexOf(x) < 0 || ids.indexOf(x) >= 3)).slice(0, n);
  const extra = lowerSess ? add(prof.lower, 2) : mixed ? [...add(prof.lower, 1), ...add(prof.upper, 1)] : add(prof.upper, 2);
  // Ergänzungen direkt nach den Hauptübungen (auch wenn sie schon weiter hinten stehen),
  // damit sie bei kurzer Trainingszeit nicht rausfallen
  ids = ids.filter((x) => !extra.includes(x));
  ids.splice(3, 0, ...extra);
  // Schnellkraft an den Anfang (nach dem Aufwärmen, solange du frisch bist) – nur an Bein-/Ganzkörpertagen
  if (tpl.legs && prof.athletic.length) {
    const a = prof.athletic.filter((x) => EXERCISES[x] && !ids.includes(x));
    const pickA = a[(tpl.id.charCodeAt(tpl.id.length - 1) || 0) % a.length];
    if (pickA) ids.unshift(pickA);
  }
  return [...new Set(ids)];
}

const exCount = (minutes) => (minutes <= 45 ? 5 : minutes >= 75 ? 7 : 6);

// ---------- Eigene Pläne (z. B. aus MCI übernommen) ----------
const LEG_MG = ['quad', 'beinbeuger', 'po'];
export function sessionOf(id) {
  const my = S.training && S.training.mySessions && S.training.mySessions[id];
  if (my) {
    const exIds = (S.training.custom && S.training.custom[id]) || my.ex.map((e) => e.id);
    const legs = exIds.some((x) => LEG_MG.includes(mgOf(x).split('|')[0].split(',')[0]));
    return { id, name: my.name, short: my.short || my.name, focus: my.focus || `${exIds.length} Übungen`, legs, ex: exIds, sets: Object.fromEntries(my.ex.map((e) => [e.id, e.sets])), my: true };
  }
  return SESSIONS[id] || SESSIONS.OKA;
}
export const usesMyPlan = (setup = setupOf()) => setup.planType === 'eigen' && !!(S.training && S.training.myRotation && S.training.myRotation.length);
export const splitOf = (setup = setupOf()) => {
  const list = SPLITS[setup.perWeek] || SPLITS[3];
  return list.find((x) => x.id === setup.split) || list[0];
};
export const rotationOf = (setup = setupOf()) => {
  if (!usesMyPlan(setup)) return splitOf(setup).rot;
  const r = S.training.myRotation;
  // Häufigkeit gilt auch für eigene Pläne: Einheiten wiederholen sich im Wechsel
  if (!setup.freqMy || !setup.perWeek) return r;
  return Array.from({ length: setup.perWeek }, (_, i) => r[i % r.length]);
};
export const myRotationRaw = () => (S.training && S.training.myRotation) || [];

// ---------- Verlauf ----------
/** Alle abgeschlossenen Gym-Einheiten, neueste zuerst */
export function workoutLog() {
  const out = [];
  Object.keys(S.days)
    .sort()
    .reverse()
    .forEach((k) => ((S.days[k] && S.days[k].workouts) || []).slice().reverse().forEach((w) => out.push({ ...w, date: k })));
  return out;
}

export function lastFor(exId, before = null) {
  const r = lastForRaw(exId, before);
  // manuell festgelegtes Gewicht hat Vorrang vor älteren Einträgen
  const b = S.training && S.training.baseline && S.training.baseline[exId];
  const ex = exOf(exId);
  if (b && b.force && b.w != null && ex && (!r || !r.date || !b.date || b.date > r.date || (b.date === r.date && (b.at || 0) > (r.at || 0))))
    return { date: b.date, forced: true, imported: 'deiner Einstellung', sets: Array.from({ length: 3 }, () => ({ w: b.w, r: b.r || ex.reps[0], done: true })) };
  return r;
}

function lastForRaw(exId, before = null) {
  let fallback = null;
  for (const w of workoutLog()) {
    if (before && w.date >= before) continue;
    const it = (w.items || []).find((i) => i.exId === exId);
    const sets = it && (it.sets || []).filter((s) => s.done && s.r > 0);
    if (!sets || !sets.length) continue;
    // Deload- und „leichte“ Einheiten zählen nicht als Maßstab für die Steigerung
    if (w.deload || w.comeback || w.mode === 'light' || w.mode === 'deload' || w.mode === 'comeback') {
      fallback = fallback || { date: w.date, sets };
      continue;
    }
    return { date: w.date, at: w.finishedAt || 0, sets, imported: w.imported ? w.source || 'Import' : null, targetRir: it.targetRir ?? null };
  }
  if (fallback) return fallback;
  // übernommene Startwerte (z. B. aus MCI)
  const b = S.training && S.training.baseline && S.training.baseline[exId];
  const ex = EXERCISES[exId];
  if (b && b.w != null && ex) return { date: b.date || null, imported: b.src || 'Import', sets: Array.from({ length: b.sets || 3 }, () => ({ w: b.w, r: b.r || ex.reps[0], done: true })) };
  return null;
}

const roundTo = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

/** Doppelte Progression: erst Wiederholungen hoch, dann Gewicht */
export function progression(ex, last) {
  const [lo, hi] = ex.reps;
  if (!last) return { w: null, reps: lo, note: 'Erstes Mal: Gewicht wählen, bei dem noch 2 Wdh. im Tank wären.' };
  if (last.forced) return { w: last.sets[0].w, reps: lo, note: `Dein festgelegtes Gewicht – starte mit ${lo} ${ex.unit}, die App steigert ab hier.` };
  const ws = last.sets.map((s) => s.w || 0);
  const w = Math.max(...ws);
  const top = last.sets.filter((s) => (s.w || 0) === w);
  const minR = Math.min(...top.map((s) => s.r));
  const maxR = Math.max(...top.map((s) => s.r));
  // RIR (Wdh. in Reserve), falls eingetragen: genauere Steuerung
  const rated = top.filter((x) => x.rir != null && x.rir !== '');
  const tgt = last.targetRir ?? 2;
  const avgRir = rated.length >= Math.ceil(top.length / 2) ? rated.reduce((a, x) => a + Number(x.rir), 0) / rated.length : null;
  const zeros = rated.filter((x) => Number(x.rir) === 0).length;
  // 3 = „3+“: höchste Stufe → gilt als zu leicht, wenn das Ziel darunter lag
  const tooEasy = avgRir != null && avgRir > tgt && avgRir >= Math.min(3, tgt + 2) && minR >= lo;
  const failTip = zeros >= 2 ? ' Tipp: Nicht jeden Satz bis zum Limit – die Reserve spart Erholung.' : '';
  const rirTxt = avgRir != null ? String(Math.round(avgRir * 10) / 10).replace('.', ',') : '';
  if (ex.inc === 0) {
    if (tooEasy && minR < hi) {
      const step = ex.unit === 'Sek.' ? 10 : 2;
      return { w, reps: Math.min(hi, minR + step), note: `Letztes Mal zu leicht (RIR Ø ${rirTxt}) – heute ${Math.min(hi, minR + step)} ${ex.unit}.` };
    }
    if (minR >= hi) return { w, reps: hi, note: `Oberes Ziel erreicht – mach es schwerer${ex.unit === 'Sek.' ? ' oder länger' : ' (langsamer, mit Gewicht)'}.`, up: true };
    const step = ex.unit === 'Sek.' ? 5 : 1;
    return { w, reps: Math.min(hi, minR + step), note: `Letztes Mal ${minR} ${ex.unit} – heute ${Math.min(hi, minR + step)}.` };
  }
  if (minR >= hi) return { w: roundTo(w + ex.inc, ex.inc / 2 || 0.5), reps: lo, note: `Alle Sätze mit ${hi} Wdh. geschafft → +${String(ex.inc).replace('.', ',')} kg 💪`, up: true };
  if (tooEasy) return { w: roundTo(w + ex.inc, ex.inc / 2 || 0.5), reps: Math.max(lo, minR - 2), note: `Letztes Mal zu leicht (RIR Ø ${rirTxt} statt ${tgt}) → +${String(ex.inc).replace('.', ',')} kg 💪`, up: true };
  if (maxR < lo) return { w: roundTo(w * 0.9, ex.inc / 2 || 0.5), reps: lo, note: 'Letztes Mal zu schwer – heute etwas leichter, saubere Technik.' };
  if (zeros && tgt >= 1) return { w, reps: Math.max(lo, minR), note: `Letztes Mal bis zum Limit (RIR 0) – gleiches Ziel, diesmal mit Reserve.${failTip}` };
  return { w, reps: Math.min(hi, minR + 1), note: `Gleiches Gewicht, Ziel: ${Math.min(hi, minR + 1)} Wdh. pro Satz.${failTip}` };
}

// ---------- Tagesform ----------
export function formMode(form) {
  if (!form || !form.energy) return { mode: 'normal', label: null, pains: [] };
  const pains = (form.pains || []).filter((p) => p.level >= 4);
  if (form.energy <= 2 || form.sleep === '< 6 h' || form.soreness === 'stark')
    return { mode: 'light', label: 'Leichte Version: 1 Satz weniger, ca. 10 % weniger Gewicht', pains };
  if (form.energy >= 5) return { mode: 'push', label: 'Top-Form: Versuch heute bei den Hauptübungen eine Wdh. mehr', pains };
  return { mode: 'normal', label: null, pains };
}

const hits = (ex, areas) => ex.stress.filter((s) => areas.includes(s));

// ---------- Krank & Urlaub ----------
// training.breaks = { id: { type: 'krank'|'urlaub', from, to?, fever?, equip?: 'koerper'|'kh'|'gym'|'frei', perWeek?, run? } }
export const breaksList = () => Object.values((S.training && S.training.breaks) || {}).filter((b) => b && b.from).sort((a, b) => (a.from < b.from ? 1 : -1));
export const breakOn = (k = todayKey()) => breaksList().find((b) => b.from <= k && (!b.to || b.to >= k)) || null;
/** Blockiert die Pause das normale Gym-Training? (Urlaub mit vollem Gym = normaler Plan) */
export const breakBlocks = (b) => !!b && (b.type === 'krank' || b.equip !== 'gym');
export const isAwaySession = (sid) => /^(URL|LAUF)/.test(sid || '');
export function awayRotation(b) {
  const strength = b.equip === 'kh' ? ['URLKA', 'URLKB'] : b.equip === 'koerper' ? ['URLA', 'URLB'] : [];
  const n = strength.length ? Math.max(1, Math.min(4, Number(b.perWeek) || 2)) : 0;
  const runs = Math.max(0, Math.min(3, Number(b.run) || 0));
  return [...Array.from({ length: n }, (_, i) => strength[i % 2]), ...Array.from({ length: runs }, (_, i) => (i % 2 ? 'LAUF2' : 'LAUF1'))];
}
/** Zuletzt beendete Krankheit (bis 4 Wochen zurück) */
function lastSick(k) {
  return breaksList()
    .filter((b) => b.type === 'krank' && b.to && b.to < k && daysBetween(b.to, k) <= 28)
    .sort((a, b) => (a.to < b.to ? 1 : -1))[0] || null;
}

// ---------- Wiedereinstieg nach Pause ----------
// Kraft bleibt ~2–3 Wochen weitgehend erhalten, danach geht sie langsam zurück – kommt aber schnell wieder („Muscle Memory“).
// Nach einer Pause starten die ersten Einheiten leichter und mit weniger Sätzen, dann geht es stufenweise zurück aufs alte Niveau.
export const COMEBACK = [
  { min: 10, label: 'kurze Pause', steps: [0.9], setsMinus: 1, rir: 3 },
  { min: 21, label: 'längere Pause', steps: [0.8, 0.9], setsMinus: 1, rir: 3, restartCycle: true },
  { min: 42, label: 'lange Pause', steps: [0.7, 0.8, 0.9], setsMinus: 1, rir: 3, restartCycle: true, maxSets: 2 },
];
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

/** Wie lange war die Pause, und in welcher Stufe des Wiedereinstiegs bist du? */
export function comebackState(k = todayKey()) {
  if (!prefsOf().comeback) return null;
  const all = workoutLog().filter((w) => w.date <= k);
  const log = all.filter((w) => !isAwaySession(w.sessionId));
  // Nach Krankheit: Fieber oder ≥ 7 Tage → 2 leichtere Einheiten, ab 3 Tagen → 1 leichtere Einheit
  let sickCb = null;
  const sick = lastSick(k);
  if (sick) {
    const dur = daysBetween(sick.from, sick.to) + 1;
    const steps = sick.fever || dur >= 7 ? [0.8, 0.9] : dur >= 3 ? [0.9] : [];
    const after = log.filter((w) => w.date > sick.to).length;
    if (steps.length && after < steps.length) sickCb = { min: 0, label: 'nach Krankheit', steps, setsMinus: 1, rir: 3, sick: true, fever: !!sick.fever, gap: dur, step: after, factor: steps[after], total: steps.length, restartCycle: dur >= 7, maxSets: sick.fever ? 2 : undefined };
  }
  const pickStronger = (a) => (!a ? sickCb : !sickCb ? a : sickCb.factor < a.factor ? sickCb : a);
  if (!log.length) return pickStronger(null);
  const gapNow = daysBetween(log[0].date, k);
  const levelFor = (gap) => [...COMEBACK].reverse().find((c) => gap >= c.min) || null;
  if (gapNow >= COMEBACK[0].min) {
    let lv = levelFor(gapNow);
    // Im Urlaub mit Körpergewicht/Laufen weitertrainiert → Muskeln erhalten, nur kurzer Wiedereinstieg
    if (all.some((w) => isAwaySession(w.sessionId) && w.date > log[0].date)) lv = COMEBACK[0];
    return pickStronger({ ...lv, gap: gapNow, step: 0, factor: lv.steps[0], total: lv.steps.length });
  }
  // laufender Wiedereinstieg: wie viele Einheiten seit der Pause schon gemacht?
  const recent = [];
  for (const w of log) {
    if (!w.comeback) break;
    recent.push(w);
  }
  if (!recent.length) return pickStronger(null);
  const first = recent[recent.length - 1].comeback;
  if (first.sick) return pickStronger(null);
  const lv = COMEBACK.find((c) => c.steps.length === first.total) || levelFor(first.gap);
  if (!lv || recent.length >= lv.steps.length) return pickStronger(null);
  return pickStronger({ ...lv, gap: first.gap, step: recent.length, factor: lv.steps[recent.length], total: lv.steps.length });
}

export const comebackText = (cb) =>
  !cb
    ? null
    : cb.sick
      ? `Schön, dass du wieder fit bist! Nach ${cb.gap} ${cb.gap === 1 ? 'Tag' : 'Tagen'} krank${cb.fever ? ' mit Fieber' : ''} – Einheit ${cb.step + 1}/${cb.total}: ca. ${Math.round((1 - cb.factor) * 100)} % leichter und weniger Sätze. Der Körper braucht nach einer Infektion noch etwas Erholung.`
      : `Willkommen zurück! ${cb.gap} Tage Pause – Wiedereinstieg ${cb.step + 1}/${cb.total}: ca. ${Math.round((1 - cb.factor) * 100)} % leichter und weniger Sätze, damit Muskeln, Sehnen und Gelenke sich wieder gewöhnen.`;

/** Einheit für heute zusammenbauen */
export function buildSession(sessionId, setup = setupOf(), form = getDay(todayKey()).form) {
  const tpl = sessionOf(sessionId);
  const fm = formMode(form);
  const painAreas = fm.pains.map((p) => p.area);
  const strongPain = fm.pains.filter((p) => p.level >= 7).map((p) => p.area);
  const custom = S.training && S.training.custom && S.training.custom[sessionId];
  let ids = custom ? custom.filter((id) => EXERCISES[id]) : tpl.my ? tpl.ex.slice() : templateIds(tpl, setup);
  const cb = tpl.away ? null : comebackState();
  const cw = tpl.away ? { label: 'Erhalt', rir: 2, extra: 0, off: true, n: 0, index: -1 } : cb && cb.restartCycle && cb.step === 0 ? { ...CYCLE[0], index: 0, n: 1 } : cycleWeek();
  const gameWeek = weekSetup(setup).gameDay != null && tpl.legs;
  if (setup.experience === 'anfaenger' && !custom && !tpl.my) ids = ids.map((id) => (id === 'kniebeuge' ? 'goblet' : id === 'rdl' ? 'hip-thrust' : id === 'klimmzug-assist' ? 'latzug' : id));
  const used = new Set();
  const items = [];
  const notes = [];
  for (const id of ids) {
    let ex = EXERCISES[id];
    let adaptedFrom = null;
    const bad = hits(ex, painAreas);
    if (bad.length) {
      const alt = ex.alt.map((a) => EXERCISES[a]).find((a) => a && !hits(a, painAreas).length && !used.has(a.id) && !ids.includes(a.id));
      if (alt) {
        adaptedFrom = { id: ex.id, name: ex.name, why: bad.join(', ') };
        ex = alt;
      } else if (bad.some((b) => strongPain.includes(b)) || bad.includes(ex.stress[0])) {
        notes.push(`${ex.name} weggelassen (${bad.join(', ')})`);
        continue;
      } else {
        adaptedFrom = { id: ex.id, name: ex.name, why: bad.join(', '), keep: true };
      }
    }
    if (used.has(ex.id)) continue;
    used.add(ex.id);
    items.push({ ex, adaptedFrom });
  }
  const prof = sportProfile(setup);
  const count = custom || tpl.my || tpl.away ? 99 : exCount(setup.minutes) + (prof && tpl.legs ? 1 : 0);
  // Sprünge/Würfe nur, wenn du fit bist: nicht im Wiedereinstieg und nicht an „leichten“ Tagen
  let chosen = items.slice(0, count);
  if (cb || fm.mode === 'light') {
    const dropped = chosen.filter((x) => x.ex.plyo);
    chosen = chosen.filter((x) => !x.ex.plyo);
    if (dropped.length) notes.push(`${dropped.map((x) => x.ex.name).join(', ')} heute weggelassen – Sprünge erst wieder, wenn du ganz fit bist.`);
  }
  const out = chosen.map(({ ex: ex0, adaptedFrom }) => {
    const ex = exOf(ex0.id);
    const last = lastFor(ex.id);
    const pr = progression(ex, last);
    let sets = ex.sets || (tpl.sets && tpl.sets[ex.id]) || (ex.main ? (setup.experience === 'erfahren' ? 4 : 3) : setup.experience === 'anfaenger' ? 2 : 3);
    let w = pr.w;
    let reps = pr.reps;
    let note = last && last.imported && !pr.up ? `Startwert aus ${last.imported}: ${String(pr.w).replace('.', ',')} kg – versuch ${reps} saubere Wdh.` : pr.note;
    let rir = ex.main ? cw.rir : Math.max(0, cw.rir - 1);
    if (cw.extra && ex.main && setup.experience !== 'anfaenger') sets = Math.min(5, sets + cw.extra);
    // Spielwoche (Saison): Beinvolumen etwas runter, Intensität bleibt – Kraft wird so gut erhalten
    if (gameWeek && !cw.deload) sets = Math.max(2, sets - 1);
    // Übung lange nicht gemacht (z. B. nach Planwechsel) → etwas vorsichtiger
    const exGap = last ? daysBetween(last.date, todayKey()) : 0;
    if (cb) {
      sets = Math.max(1, Math.min(cb.maxSets || 9, sets - cb.setsMinus));
      if (last) {
        w = Math.max(...last.sets.map((s) => s.w || 0));
        reps = ex.reps[0];
      }
      if (w) w = roundTo(w * cb.factor, ex.inc / 2 || 0.5);
      rir = Math.max(rir, cb.rir);
      note = `Wiedereinstieg ${cb.step + 1}/${cb.total}: ~${Math.round((1 - cb.factor) * 100)} % leichter${last ? ` als vor der Pause (${String(Math.max(...last.sets.map((s) => s.w || 0))).replace('.', ',')} kg)` : ''}.`;
    } else if (exGap >= 28 && w && !cw.deload) {
      w = roundTo(w * 0.9, ex.inc / 2 || 0.5);
      reps = ex.reps[0];
      note = `Länger nicht gemacht (${exGap} Tage) – heute ~10 % leichter zum Reinkommen.`;
    } else if (cw.deload) {
      sets = Math.max(1, Math.ceil(sets / 2));
      if (pr.up && last) {
        w = Math.max(...last.sets.map((s) => s.w || 0));
        reps = ex.reps[0];
      }
      if (w) w = roundTo(w * 0.9, ex.inc / 2 || 0.5);
      rir = 4;
      note = 'Deload-Woche: leichter und weniger Sätze – die Erholung macht dich nächste Woche stärker.';
    } else if (fm.mode === 'light') {
      sets = Math.max(2, sets - 1);
      if (w) w = roundTo(w * 0.9, ex.inc / 2 || 0.5);
      if (pr.up && last) {
        w = Math.max(...last.sets.map((s) => s.w || 0));
        reps = ex.reps[0];
      }
      note = 'Heute leichter – sauber und mit Reserve trainieren.';
    } else if (fm.mode === 'push' && ex.main && !pr.up) {
      reps = Math.min(ex.reps[1], reps + 1);
    }
    if (tpl.away && /^URL[AB]$/.test(tpl.id)) {
      w = null;
      reps = ex.reps[1];
      sets = Math.min(sets, 3);
      note = ex.unit === 'Sek.' ? 'So lange sauber halten, wie es geht – bis kurz vor Schluss.' : 'Ohne Gewicht: so viele saubere Wdh., bis nur noch 1–2 gehen würden. Langsam runter (3 Sek.) macht es schwerer.';
    }
    if (ex.plyo) {
      sets = ex.sets || (cw.deload ? 2 : 3);
      rir = null;
      if (!(last && last.forced)) w = ex.inc ? pr.w : null;
      note = 'Schnellkraft: jede Wiederholung explosiv und sauber, 1–2 Min. Pause. Aufhören, sobald es langsamer wird.';
    }
    if (adaptedFrom && adaptedFrom.keep) note = `Achtung ${adaptedFrom.why}: nur schmerzfrei, eher leichter.`;
    return {
      exId: ex.id,
      name: ex.name,
      equip: ex.equip,
      unit: ex.unit,
      cue: ex.cue,
      main: !!ex.main,
      plyo: !!ex.plyo,
      repRange: ex.reps,
      inc: ex.inc,
      target: { w, reps, rir },
      sets: Array.from({ length: sets }, () => ({ w: w ?? '', r: '', done: false })),
      last,
      note,
      adaptedFrom: adaptedFrom && !adaptedFrom.keep ? adaptedFrom : null,
    };
  });
  const mode = cb ? 'comeback' : cw.deload ? 'deload' : fm.mode;
  const modeLabel = cb ? comebackText(cb) : cw.deload ? 'Deload-Woche: halbe Sätze, ~10 % weniger Gewicht' : fm.label || (gameWeek ? 'Spielwoche: 1 Satz weniger pro Übung, Gewichte bleiben – frische Beine fürs Spiel.' : null);
  return { sessionId, name: tpl.name, focus: tpl.focus, items: out, mode, modeLabel, notes, pains: fm.pains, cycle: cw, comeback: cb ? { gap: cb.gap, step: cb.step, total: cb.total, restartCycle: !!cb.restartCycle, sick: !!cb.sick } : null };
}

/** Übung im laufenden Training tauschen (z. B. Gerät besetzt) */
export function swapOptions(exId, exclude = []) {
  const ex = EXERCISES[exId];
  const list = [...ex.alt];
  // weitere Übungen mit ähnlichem Ziel: gleiche Session-Gruppe
  Object.values(EXERCISES).forEach((e) => {
    if (e.id !== exId && !list.includes(e.id) && e.alt.includes(exId)) list.push(e.id);
  });
  return list.filter((id) => !exclude.includes(id)).map((id) => EXERCISES[id]);
}

export function itemFor(exId, setup = setupOf()) {
  const ex = exOf(exId);
  const last = lastFor(ex.id);
  const pr = progression(ex, last);
  const sets = ex.sets || (ex.main ? 3 : setup.experience === 'anfaenger' ? 2 : 3);
  const cw = cycleWeek();
  return { exId: ex.id, name: ex.name, equip: ex.equip, unit: ex.unit, cue: ex.cue, main: !!ex.main, repRange: ex.reps, inc: ex.inc, target: { w: pr.w, reps: pr.reps, rir: ex.main ? cw.rir : Math.max(0, cw.rir - 1) }, sets: Array.from({ length: sets }, () => ({ w: pr.w ?? '', r: '', done: false })), last, note: pr.note, adaptedFrom: null };
}

// ---------- Wochenrhythmus ----------
const isHB = (setup, d) => (setup.handballDays || []).includes(d) || setup.gameDay === d;
const isGame = (setup, d) => setup.gameDay === d;

/** Spieltag dieser Woche: Eintrag für die Woche (Training-Tab) oder der übliche Spieltag in der Saison */
export function gameDayForWeek(setup, ws) {
  const g = S.training && S.training.games;
  if (g && g[ws] !== undefined) return g[ws] === 'none' ? null : Number(g[ws]);
  if (setup.season === 'off') return null;
  return setup.gameDay ?? null;
}
/** Setup mit dem Spieltag der Woche, in der k liegt */
export const weekSetup = (setup, k = todayKey()) => {
  const ws = weekStart(k);
  const blocked = [];
  const brk = {};
  for (let i = 0; i < 7; i++) {
    const key = addDays(ws, i);
    const b = breakOn(key);
    if (b && breakBlocks(b)) {
      const d = parseKey(key).getDay();
      blocked.push(d);
      brk[d] = b.type;
    }
  }
  return { ...setup, gameDay: sportOf(setup).games ? gameDayForWeek(setup, ws) : null, blocked, breakDays: brk };
};

/** Empfohlene Gym-Tage: bewertet alle Kombinationen und nimmt die beste
 *  (keine Beine vor Handball/Spiel, max. 2 Gym-Tage unter der Woche, Wochenende nutzen, Pausen dazwischen) */
export function weekPlan(setup = weekSetup(setupOf())) {
  const rot = rotationOf(setup);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const free = order.filter((d) => !isHB(setup, d) && !isGame(setup, (d + 1) % 7) && !(setup.blocked || []).includes(d) && (!setup.gymDays || !setup.gymDays.length || setup.gymDays.includes(d)));
  const n = Math.min(rot.length, free.length);
  const combos = [];
  const pick = (start, acc) => {
    if (acc.length === n) return combos.push(acc.slice());
    for (let i = start; i < free.length; i++) pick(i + 1, [...acc, free[i]]);
  };
  pick(0, []);
  const perms = [];
  const perm = (arr, acc) => {
    if (!arr.length) return perms.push(acc);
    const seen = new Set();
    arr.forEach((x, i) => {
      if (seen.has(x)) return;
      seen.add(x);
      perm([...arr.slice(0, i), ...arr.slice(i + 1)], [...acc, x]);
    });
  };
  perm(rot.slice(0, n), []);
  if (!n) return Object.assign([], { dropped: rot.slice() });
  const legs = (sid) => sessionOf(sid).legs;
  let best = null;
  for (const days of combos) {
    for (const ses of perms) {
      let sc = 0;
      const plan = days.map((d, i) => ({ d, sessionId: ses[i] }));
      const wk = plan.filter((p) => p.d >= 1 && p.d <= 5).length;
      if (!setup.gymDays || !setup.gymDays.length) {
        if (wk > 2) sc += 8 * (wk - 2);
        [6, 0].forEach((d) => !isHB(setup, d) && !days.includes(d) && (sc += 3));
      }
      plan.forEach((p, i) => {
        const L = legs(p.sessionId);
        const nx = (p.d + 1) % 7;
        const pv = (p.d + 6) % 7;
        // Spiel: Tag davor (MD-1) frei halten, Beine mind. 48 h Abstand, Tag danach (MD+1) Regeneration
        if (L && isGame(setup, nx)) sc += 100;
        else if (L && isHB(setup, nx)) sc += 60;
        if (!L && isGame(setup, nx)) sc += 30;
        else if (!L && isHB(setup, nx)) sc += 1;
        if (L && isGame(setup, (p.d + 2) % 7)) sc += 40;
        if (L && isGame(setup, pv)) sc += 40;
        else if (!L && isGame(setup, pv)) sc += 4;
        else if (L && isHB(setup, pv)) sc += 3;
        const next = plan[i + 1] || (plan[0] && { d: plan[0].d + 7, sessionId: plan[0].sessionId });
        const gap = ((next.d - p.d) % 7 + 7) % 7 || 7;
        if (next && gap === 1 && plan.length > 1) {
          sc += 2;
          if (L && legs(next.sessionId)) sc += 30;
          if (p.sessionId[0] === next.sessionId[0] && p.sessionId !== next.sessionId && !L) sc += 1;
        }
      });
      // Reihenfolge der Rotation möglichst beibehalten (A vor B)
      plan.forEach((p, i) => i > 0 && rot.indexOf(p.sessionId) < rot.indexOf(plan[i - 1].sessionId) && (sc += 0.5));
      if (!best || sc < best.sc) best = { sc, plan };
    }
  }
  if (!best) return [];
  // Ohne Beine vor Handball/Spiel nicht machbar → Bein-Einheit diese Woche streichen
  const plan = best.plan.filter((p) => !(legs(p.sessionId) && isGame(setup, (p.d + 1) % 7)));
  plan.dropped = [...best.plan.filter((p) => !plan.includes(p)).map((p) => p.sessionId), ...rot.slice(n)];
  return plan;
}

function recommendBreak(brk, k) {
  const ws = weekStart(k);
  const log = workoutLog();
  const base = { brk, reasons: [], tomorrowGame: false, yesterdayGame: false, planned: false, doneToday: log.find((w) => w.date === k) || null };
  const sinceDays = daysBetween(brk.from, k) + 1;
  if (brk.type === 'krank') return { ...base, status: 'sick', sinceDays, sessionId: null, rot: [], left: [], doneThisWeek: 0, perWeek: 0 };
  const rot = awayRotation(brk);
  if (!rot.length) return { ...base, status: 'urlaub-frei', sessionId: null, rot: [], left: [], doneThisWeek: 0, perWeek: 0 };
  // Seit Urlaubsbeginn bzw. in dieser Woche erledigte Urlaubs-Einheiten
  const from = brk.from > ws ? brk.from : ws;
  const done = log.filter((w) => w.date >= from && w.date <= addDays(ws, 6) && isAwaySession(w.sessionId));
  const left = rot.slice();
  done.forEach((w) => {
    const i = left.indexOf(w.sessionId);
    if (i >= 0) left.splice(i, 1);
  });
  // Abwechseln: nach Kraft lieber Laufen und umgekehrt, A/B im Wechsel
  const lastAway = log.find((w) => isAwaySession(w.sessionId) && w.date >= brk.from);
  let sessionId = left.find((x) => !lastAway || (x !== lastAway.sessionId && x[0] !== lastAway.sessionId[0])) || left[0] || null;
  const status = base.doneToday ? 'done' : left.length ? 'urlaub' : 'urlaub-ziel';
  if (!sessionId) sessionId = rot[0];
  return { ...base, status, sessionId, rot: [...new Set(rot)], left, doneThisWeek: done.length, perWeek: rot.length };
}

export const dayName = (d) => WD_LONG[d];
export const dayShort = (d) => WD_SHORT[d];

/** Was steht heute an? Folgt dem Wochenrhythmus, holt verpasste Einheiten nach */
export function recommend(setup0 = setupOf(), k = todayKey()) {
  const brk = breakOn(k);
  if (brk && breakBlocks(brk)) return recommendBreak(brk, k);
  const setup = weekSetup(setup0, k);
  const d = parseKey(k).getDay();
  const tomorrowSetup = weekSetup(setup0, addDays(k, 1));
  const tomorrowGame = tomorrowSetup.gameDay === (d + 1) % 7;
  const yesterdayGame = weekSetup(setup0, addDays(k, -1)).gameDay === (d + 6) % 7;
  const rot = rotationOf(setup);
  const ws = weekStart(k);
  const log = workoutLog();
  const doneThisWeek = log.filter((w) => w.date >= ws && w.date <= addDays(ws, 6));
  const doneToday = doneThisWeek.filter((w) => w.date === k);
  const plan = weekPlan(setup);
  const left = plan.map((p) => p.sessionId);
  doneThisWeek.forEach((w) => {
    const i = left.indexOf(w.sessionId);
    if (i >= 0) left.splice(i, 1);
  });
  const form = getDay(k).form;
  const tomorrowHB = isHB(tomorrowSetup, (d + 1) % 7);
  const legsSore = form && form.soreness === 'stark';
  const legPain = form && (form.pains || []).some((p) => ['Knie', 'Oberschenkel', 'Wade', 'Sprunggelenk', 'Hüfte'].includes(p.area) && p.level >= 5);
  const legsBlocked = tomorrowHB || yesterdayGame || legsSore || legPain;
  const reasons = [];
  const planned = plan.find((p) => p.d === d);
  // Reihenfolge der offenen Einheiten wie im Wochenplan
  const planOrder = plan.map((p) => p.sessionId);
  left.sort((a, b) => planOrder.indexOf(a) - planOrder.indexOf(b));
  let sessionId;
  if (planned && left.includes(planned.sessionId) && !(sessionOf(planned.sessionId).legs && legsBlocked)) sessionId = planned.sessionId;
  else sessionId = left.find((s) => !(sessionOf(s).legs && legsBlocked));
  if (!sessionId && left.length) {
    sessionId = rot.find((s) => !sessionOf(s).legs) || left[0];
    reasons.push(tomorrowHB ? `Offen wäre noch ${sessionOf(left[0]).name} – aber morgen ${tomorrowGame ? 'Spiel' : sportOf(setup).name}. Heute lieber Oberkörper, Beine an einem anderen Tag.` : yesterdayGame ? 'Gestern Spiel – Beine bekommen heute Regeneration.' : 'Beine sind heute angeschlagen – Oberkörper geht vor.');
  } else if (planned && sessionId !== planned.sessionId && left.includes(planned.sessionId)) {
    reasons.push(tomorrowHB ? `Morgen ${tomorrowGame ? 'Spiel' : sportOf(setup).name} – Beine lieber an einem anderen Tag.` : yesterdayGame ? 'Gestern Spiel – Beine bekommen heute Regeneration.' : 'Beine sind heute angeschlagen – Oberkörper geht vor.');
  } else if (!planned && sessionId && left.length) {
    reasons.push('Kein fester Gym-Tag – aber passt gut, wenn du Zeit hast.');
  }
  if (!sessionId) {
    const lastSession = log.find((w) => rot.includes(w.sessionId));
    sessionId = rot[lastSession ? (rot.indexOf(lastSession.sessionId) + 1) % rot.length : 0];
    if (sessionOf(sessionId).legs && legsBlocked) sessionId = rot.find((s) => !sessionOf(s).legs) || sessionId;
  }
  let status = 'train';
  if (doneToday.length) status = 'done';
  else if (isGame(setup, d)) status = 'game';
  else if (isHB(setup, d)) status = 'handball';
  else if (tomorrowGame) status = 'pregame';
  else if (!left.length) status = 'goal';
  else if (!planned) status = 'free';
  return { sessionId, status, reasons, tomorrowGame, yesterdayGame, gameDay: setup.gameDay, doneThisWeek: doneThisWeek.length, perWeek: plan.length, planned: !!planned, rot, doneToday: doneToday[0] || null, left };
}

// ---------- Wochenvolumen pro Muskel ----------
// primär = 1 Satz, sekundär = 0,5 Satz (übliche Zählweise in der Forschung)
const MG = {
  bankdruecken: 'brust|trizeps,schulter', 'kh-bank': 'brust|trizeps,schulter', 'schraeg-kh': 'brust|schulter,trizeps', brustpresse: 'brust|trizeps', liegestuetz: 'brust|trizeps',
  schulterdruecken: 'schulter|trizeps', schulterpresse: 'schulter|trizeps', seitheben: 'schulter|', 'seitheben-kabel': 'schulter|',
  'trizeps-kabel': 'trizeps|', 'trizeps-ueberkopf': 'trizeps|',
  latzug: 'ruecken|bizeps', 'latzug-eng': 'ruecken|bizeps', 'klimmzug-assist': 'ruecken|bizeps', 'rudern-kabel': 'ruecken|bizeps,schulter', 'rudern-brust': 'ruecken|bizeps,schulter', 'rudern-kh': 'ruecken|bizeps',
  facepull: 'schulter|ruecken', 'reverse-fly': 'schulter|ruecken', aussenrotation: 'schulter|',
  'bizeps-kh': 'bizeps|', 'bizeps-kabel': 'bizeps|', hammercurls: 'bizeps|',
  kniebeuge: 'quad|po', beinpresse: 'quad|po', goblet: 'quad|po', rdl: 'beinbeuger|po', 'hip-thrust': 'po|beinbeuger', beinbeuger: 'beinbeuger|', beinstrecker: 'quad|',
  'split-squat': 'quad|po', ausfallschritte: 'quad|po', nordic: 'beinbeuger|', copenhagen: 'adduktoren|rumpf', wadenheben: 'waden|', pallof: 'rumpf|', plank: 'rumpf|', deadbug: 'rumpf|', kabelcrunch: 'rumpf|',
};
export const MUSCLE_LABEL = { brust: 'Brust', ruecken: 'Rücken', schulter: 'Schultern', bizeps: 'Bizeps', trizeps: 'Trizeps', quad: 'Oberschenkel vorne', beinbeuger: 'Beinbeuger', po: 'Po', adduktoren: 'Adduktoren', waden: 'Waden', rumpf: 'Rumpf' };
export const mgOf = (id) => MG[id] || (EXERCISES[id] && EXERCISES[id].mg) || '|';

export function weeklyVolume(setup = { ...setupOf(), gameDay: null }) {
  const vol = Object.fromEntries(Object.keys(MUSCLE_LABEL).map((k) => [k, 0]));
  weekPlan(setup).forEach((p) => {
    buildSession(p.sessionId, setup, null).items.forEach((it) => {
      const [pri, sec] = mgOf(it.exId).split('|');
      const n = it.sets.length;
      pri.split(',').filter(Boolean).forEach((m) => (vol[m] += n));
      (sec || '').split(',').filter(Boolean).forEach((m) => (vol[m] += n / 2));
    });
  });
  return vol;
}

/** Ist ein Trainingseintrag Vereinssport? */
export const isSportEntry = (t, setup = setupOf()) => {
  if (!t || t.type === 'Kraft') return false;
  const sp = sportOf(setup);
  return !!t.sport || (sp.id !== 'keiner' && String(t.type || '').startsWith(sp.name)) || /Handball/.test(t.type || '');
};

/** Übungsliste einer Einheit, wie sie im Plan steht (eigene Anpassung oder Vorlage) */
export function planIds(sessionId, setup = setupOf()) {
  const custom = S.training && S.training.custom && S.training.custom[sessionId];
  if (custom) return custom.filter((id) => EXERCISES[id]);
  const tpl = sessionOf(sessionId);
  if (tpl.my) return tpl.ex.slice();
  let ids = templateIds(tpl, setup);
  if (setup.experience === 'anfaenger') ids = ids.map((id) => (id === 'kniebeuge' ? 'goblet' : id === 'rdl' ? 'hip-thrust' : id === 'klimmzug-assist' ? 'latzug' : id));
  if (tpl.away) return ids;
  return ids.slice(0, exCount(setup.minutes) + (sportProfile(setup) && tpl.legs ? 1 : 0));
}
export const isCustom = (sessionId) => !!(S.training && S.training.custom && S.training.custom[sessionId]);

// ---------- Import (Plan + Gewichte als Code) ----------
export function parseImport(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('Kein Code eingefügt.');
  if (!t.startsWith('{')) {
    try {
      t = decodeURIComponent(escape(atob(t.replace(/\s+/g, ''))));
    } catch (e) {
      throw new Error('Der Code ist unvollständig. Bitte komplett kopieren.');
    }
  }
  const d = JSON.parse(t);
  if (!d || d.v !== 1) throw new Error('Unbekanntes Code-Format.');
  const unknown = [];
  Object.values(d.sessions || {}).forEach((ss) => ss.ex.forEach(([id]) => !EXERCISES[id] && unknown.push(id)));
  if (unknown.length) throw new Error('Unbekannte Übungen: ' + unknown.join(', ') + ' – App bitte erst aktualisieren.');
  return d;
}
