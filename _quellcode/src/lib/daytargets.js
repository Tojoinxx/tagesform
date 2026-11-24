// Kalorien je nach Tag („Carb Cycling light“): an Trainings-, Handball- und Spieltagen mehr Kohlenhydrate,
// an freien Tagen weniger. Die Wochensumme bleibt gleich – nur verteilt nach Bedarf.
import { S } from './store.js';
import { targetsOf } from './nutrition.js';
import { setupOf, weekSetup, weekPlan, isHB, isGame, breakOn, hasSport, sportOf, isSportEntry } from './training.js';
import { addDays, parseKey, weekStart, todayKey } from './util.js';

const SHIFT = 0.15; // Anteil des Tagesziels, der zwischen Trainings- und Ruhetagen verschoben wird

/** Art des Tages: 'game' (Spiel), 'load' (Tag vor dem Spiel), 'train' (Gym/Verein), 'rest' */
export function dayKind(k, setup0 = setupOf()) {
  const d = (S.days && S.days[k]) || {};
  const tk = todayKey();
  const done = (d.workouts || []).some((w) => (w.items || []).length) || (d.training || []).length > 0;
  const gameDone = (d.training || []).some((t) => /spiel/i.test(t.type || t.session || ''));
  if (gameDone) return 'game';
  if (k < tk) return done ? 'train' : 'rest';
  if (breakOn(k)) return done ? 'train' : 'rest';
  const ws = weekSetup(setup0, k);
  const wd = parseKey(k).getDay();
  if (hasSport(ws) && isGame(ws, wd)) return 'game';
  if (done) return 'train';
  if (hasSport(ws) && isHB(ws, wd)) return 'train';
  if (hasSport(ws) && isGame(ws, (wd + 1) % 7)) return 'load';
  // geplante Gym-Tage dieser Woche (nach Wochenrhythmus)
  try {
    if (weekPlan(ws).some((p) => p.d === wd)) return 'train';
  } catch (e) {}
  return 'rest';
}

// Wochenplan-Berechnung ist aufwendig → pro Woche zwischenspeichern, solange sich Tage/Plan nicht ändern
let _cache = { days: null, tr: null, tk: null, m: {} };
function weekKinds(ws, setup) {
  const tk = todayKey();
  if (_cache.days !== S.days || _cache.tr !== S.training || _cache.tk !== tk) _cache = { days: S.days, tr: S.training, tk, m: {} };
  if (!(ws in _cache.m)) {
    try {
      _cache.m[ws] = Array.from({ length: 7 }, (_, i) => dayKind(addDays(ws, i), setup));
    } catch (e) {
      _cache.m[ws] = null;
    }
  }
  return _cache.m[ws];
}

const LABEL = {
  game: 'Spieltag',
  load: 'Tag vor dem Spiel',
  train: 'Trainingstag',
  rest: 'Ruhetag',
};

/** Tagesziel für einen bestimmten Tag (Kohlenhydrate verschoben, Eiweiß & Fett bleiben) */
export function dayTargets(profile = S.profile, k = todayKey()) {
  const base = targetsOf(profile);
  if (!profile || profile.carbCycle === false) return { ...base, kind: null, delta: 0 };
  const setup = setupOf();
  const ws = weekStart(k);
  const kinds = weekKinds(ws, setup);
  if (!kinds) return { ...base, kind: null, delta: 0 };
  const kind = kinds[(parseKey(k).getDay() + 6) % 7];
  const T = kinds.filter((x) => x !== 'rest').length;
  const R = 7 - T;
  if (!T || !R) return { ...base, kind, label: LABEL[kind], delta: 0 };
  // Gleiche Wochensumme: T Tage × plus = R Tage × minus
  const B = base.kcal;
  const plus = Math.round((SHIFT * B * R) / 7 / 10) * 10;
  const minus = Math.round((SHIFT * B * T) / 7 / 10) * 10;
  const delta = kind === 'rest' ? -minus : plus;
  const c = Math.max(60, Math.round(base.c + delta / 4));
  return { ...base, kcal: base.kcal + (c - base.c) * 4, c, kind, label: LABEL[kind], delta: (c - base.c) * 4, baseKcal: base.kcal };
}

/** Hinweis rund ums Spiel (für Heute) */
export function gameHint(k = todayKey()) {
  const setup = setupOf();
  if (!hasSport(setup)) return null;
  const kind = dayKind(k, setup);
  const name = sportOf(setup).name || 'Spiel';
  if (kind === 'load')
    return {
      title: 'Morgen ist Spiel – heute Kohlenhydrate auffüllen',
      text: 'Zu jeder Mahlzeit eine gute Portion Nudeln, Reis, Kartoffeln oder Brot (ca. 6–8 g pro kg Körpergewicht über den Tag). Abends nichts Schweres oder Neues, viel trinken.',
    };
  if (kind === 'game')
    return {
      title: `Spieltag (${name})`,
      text: '3–4 Std. vorher eine kohlenhydratreiche, fettarme Mahlzeit (z. B. Nudeln mit Tomatensoße, Reis mit Hähnchen), 1 Std. vorher höchstens einen Snack (Banane, Brezel). Danach Eiweiß + Kohlenhydrate zur Erholung.',
    };
  return null;
}
