// Zielwerte, Einträge und Tagessummen
import { num } from './util.js';

export const MEALS = [
  { id: 'fruehstueck', label: 'Frühstück', short: 'Frühstück' },
  { id: 'mittag', label: 'Mittagessen', short: 'Mittag' },
  { id: 'abend', label: 'Abendessen', short: 'Abend' },
  { id: 'snacks', label: 'Snacks', short: 'Snacks' },
];
export const mealLabel = (id) => (MEALS.find((m) => m.id === id) || MEALS[3]).label;

export const ACTIVITY = [
  { id: 'sitzend', label: 'Überwiegend sitzend', hint: 'Büro, Vorlesung, Homeoffice', pal: 1.3 },
  { id: 'leicht', label: 'Gemischt', hint: 'Sitzen, Stehen, etwas Laufen', pal: 1.45 },
  { id: 'aktiv', label: 'Viel auf den Beinen', hint: 'Werkstatt, Montage, Lager', pal: 1.6 },
  { id: 'sehr', label: 'Körperlich schwer', hint: 'Bau, Handwerk, viel Tragen', pal: 1.75 },
];

export const GOALS = [
  { id: 'abnehmen', label: 'Abnehmen', hint: 'Fett verlieren, Muskeln halten' },
  { id: 'halten', label: 'Gewicht halten', hint: 'Fit bleiben, ausgewogen essen' },
  { id: 'aufbauen', label: 'Muskeln aufbauen', hint: 'Kraft und Masse zulegen' },
];

export const PACES = [
  { id: 'entspannt', label: 'Entspannt', hint: 'Langsamer, dafür alltagstauglich' },
  { id: 'normal', label: 'Normal', hint: 'Spürbarer Fortschritt' },
];

export function ageFrom(profile) {
  const y = num(profile.birthYear);
  return y ? new Date().getFullYear() - y : num(profile.age) || 25;
}

/** Grundumsatz (Mifflin-St Jeor) */
export function bmr(p) {
  const w = num(p.weightKg) || 75;
  const h = num(p.heightCm) || 178;
  const a = ageFrom(p);
  // Mit bekanntem Körperfett (Formcheck): Katch-McArdle über die fettfreie Masse – genauer bei sehr sportlich/übergewichtig
  const bf = num(p.bodyFat);
  if (bf > 3 && bf < 60) return 370 + 21.6 * w * (1 - bf / 100);
  const base = 10 * w + 6.25 * h - 5 * a;
  return p.sex === 'w' ? base - 161 : p.sex === 'd' ? base - 78 : base + 5;
}

export function calcTargets(p) {
  const w = num(p.weightKg) || 75;
  const act = ACTIVITY.find((a) => a.id === p.activity) || ACTIVITY[1];
  const days = Math.max(0, Math.min(7, num(p.trainingDays)));
  const pal = act.pal + days * 0.035;
  const tdee = bmr(p) * pal;
  let factor = 1;
  if (p.goal === 'abnehmen') factor = p.pace === 'normal' ? 0.82 : 0.9;
  if (p.goal === 'aufbauen') factor = p.pace === 'normal' ? 1.1 : 1.05;
  const adj = Math.max(-500, Math.min(500, num(p.kcalAdjust))); // Feinjustierung aus dem Formcheck
  const kcal = Math.round((tdee * factor + adj) / 10) * 10;
  const protPerKg = p.goal === 'abnehmen' ? 2.0 : p.goal === 'aufbauen' ? 1.8 : 1.6;
  const prot = Math.round(w * protPerKg);
  const fat = Math.round(Math.max(w * 0.8, (kcal * 0.28) / 9));
  const carbs = Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const water = Math.max(2000, Math.round((w * 35 + (days >= 3 ? 500 : 250)) / 250) * 250);
  return { kcal, p: prot, c: carbs, f: fat, water, fiber: 30, fv: 5, tdee: Math.round(tdee) };
}

export const targetsOf = (profile) => {
  const auto = calcTargets(profile || {});
  if (profile && profile.targetsManual && profile.targets) return { ...auto, ...profile.targets };
  return auto;
};

const r1 = (v) => Math.round(v * 10) / 10;

/** Werte für eine Menge aus per-100-g-Angaben */
export function scale(per100, grams) {
  const g = num(grams);
  const k = g / 100;
  return {
    kcal: Math.round(num(per100.kcal) * k),
    p: r1(num(per100.p) * k),
    c: r1(num(per100.c) * k),
    f: r1(num(per100.f) * k),
    fiber: r1(num(per100.fiber) * k),
    sugar: r1(num(per100.sugar) * k),
  };
}

/** Obst/Gemüse-Portionen (ca. 100 g = 1 Portion, max. 3 pro Eintrag) */
export const fvFor = (isFv, grams) => (isFv ? Math.min(3, Math.round((num(grams) / 100) * 2) / 2) : 0);

/** Eintrag aus Lebensmittel + Menge bauen */
export function makeEntry({ food, grams, meal, source, id }) {
  const vals = scale(food.per100, grams);
  return {
    id,
    meal,
    name: food.name,
    brand: food.brand || '',
    foodId: food.id || null,
    grams: Math.round(num(grams)),
    unit: food.unit || 'g',
    per100: { ...food.per100 },
    fvFood: !!food.fv,
    fv: fvFor(food.fv, grams),
    ...vals,
    source: source || food.source || 'base',
    at: Date.now(),
  };
}

export function daySums(day) {
  const s = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0, fv: 0, count: 0 };
  const entries = (day && day.entries) || [];
  for (const e of entries) {
    s.kcal += num(e.kcal);
    s.p += num(e.p);
    s.c += num(e.c);
    s.f += num(e.f);
    s.fiber += num(e.fiber);
    s.sugar += num(e.sugar);
    s.fv += num(e.fv);
    s.count++;
  }
  s.fv += num(day && day.fvExtra);
  s.water = num(day && day.waterMl);
  return s;
}

export const mealSums = (day, meal) => daySums({ entries: ((day && day.entries) || []).filter((e) => e.meal === meal) });

/** Gilt ein Tag als „richtig eingetragen“? */
export const isLogged = (day) => {
  const s = daySums(day);
  return s.kcal >= 700 || s.count >= 4;
};
