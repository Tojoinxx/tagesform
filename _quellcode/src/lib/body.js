// Körper: Trendgewicht (geglättet) und echter Verbrauch aus Gewichtstrend + Gegessenem (wie MacroFactor)
import { S } from './store.js';
import { daySums, isLogged, calcTargets } from './nutrition.js';
import { addDays, todayKey, parseKey } from './util.js';

const ALPHA = 0.1; // Glättung pro Tag (≈ 10-Tage-Mittel)
const dayDiff = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

/** Wiegungen der letzten n Tage, älteste zuerst */
export function weighIns(days = 180, k = todayKey()) {
  const from = addDays(k, -days);
  return Object.keys(S.days)
    .filter((d) => d >= from && d <= k && S.days[d] && S.days[d].weight > 0)
    .sort()
    .map((d) => ({ k: d, w: S.days[d].weight }));
}

/** Trendgewicht: exponentiell geglättet, Lücken werden berücksichtigt. [{ k, w, t }] */
export function weightTrend(days = 180, k = todayKey()) {
  const pts = weighIns(days, k);
  let t = null;
  let prev = null;
  return pts.map((p) => {
    if (t == null) t = p.w;
    else {
      const gap = Math.max(1, dayDiff(prev, p.k));
      const a = 1 - Math.pow(1 - ALPHA, gap);
      t = t + a * (p.w - t);
    }
    prev = p.k;
    return { ...p, t: Math.round(t * 100) / 100 };
  });
}

/** Trend an einem Tag (letzter bekannter Trendwert bis dahin) */
export function trendAt(k, series = weightTrend()) {
  let v = null;
  for (const p of series) if (p.k <= k) v = p.t;
  return v;
}

/** Veränderung des Trends pro Woche (über die letzten 3 Wochen) */
export function trendPerWeek(k = todayKey()) {
  const s = weightTrend(120, k);
  if (s.length < 3) return null;
  const last = s[s.length - 1];
  const ref = [...s].reverse().find((p) => dayDiff(p.k, last.k) >= 14) || s[0];
  const d = dayDiff(ref.k, last.k);
  if (d < 7) return null;
  return ((last.t - ref.t) / d) * 7;
}

/**
 * Echter Verbrauch: Ø gegessen − Gewichtsveränderung × 7700 kcal/kg, über bis zu 28 Tage.
 * Mit wenig Daten wird zur Formel hin gemittelt. Rückgabe null, wenn zu wenig Daten.
 */
export function expenditure(k = todayKey(), profile = S.profile || {}) {
  const series = weightTrend(120, k);
  const formula = calcTargets({ ...profile, tdeeLearned: null }).tdee;
  const win = 28;
  const keys = Array.from({ length: win }, (_, i) => addDays(k, -win + i)); // bis gestern (heute ist meist unvollständig)
  const logged = keys.filter((d) => isLogged(S.days[d]));
  const wIn = series.filter((p) => p.k >= keys[0] && p.k <= keys[keys.length - 1]);
  if (logged.length < 10 || wIn.length < 4) return { ok: false, formula, logged: logged.length, weighIns: wIn.length };
  const first = wIn[0];
  const last = wIn[wIn.length - 1];
  const span = dayDiff(first.k, last.k);
  if (span < 10) return { ok: false, formula, logged: logged.length, weighIns: wIn.length };
  const intake = logged.reduce((a, d) => a + daySums(S.days[d]).kcal, 0) / logged.length;
  const deltaKg = last.t - first.t;
  const observed = intake - (deltaKg * 7700) / span;
  // Vertrauen: mehr eingetragene Tage → mehr Gewicht auf den beobachteten Wert
  const conf = Math.min(1, (logged.length - 6) / 18);
  const kcal = Math.round((observed * conf + formula * (1 - conf)) / 10) * 10;
  return { ok: true, kcal, observed: Math.round(observed), formula, intake: Math.round(intake), deltaKg, span, logged: logged.length, weighIns: wIn.length, conf };
}

/** Einmal pro Woche den gelernten Verbrauch aktualisieren (nur wenn eingeschaltet) */
export function maybeUpdateTdee(save) {
  const p = S.profile || {};
  if (!p.tdeeAuto) return null;
  const l = p.tdeeLearned;
  if (l && Date.now() - (l.at || 0) < 6.5 * 864e5) return null;
  const e = expenditure();
  if (!e.ok) return null;
  const next = { kcal: e.kcal, at: Date.now(), prev: l ? l.kcal : null };
  save({ ...p, tdeeLearned: next });
  return next;
}
