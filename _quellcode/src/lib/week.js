// Wochen-Check: regelbasierte Auswertung (läuft immer, auch ohne KI)
import { S } from './store.js';
import { daySums, isLogged, targetsOf } from './nutrition.js';
import { addDays, isoWeek, parseKey, WD_SHORT, todayKey } from './util.js';

const FRUIT_TIPS = [
  { food: 'Granatapfel', text: 'Granatapfelkerne über Skyr oder Müsli – viele Antioxidantien (Polyphenole).' },
  { food: 'Beeren', text: 'Eine Handvoll Heidelbeeren oder TK-Beeren in den Joghurt – geht schnell und hält sich.' },
  { food: 'Kiwi', text: 'Zwei Kiwis decken fast den ganzen Vitamin-C-Bedarf – perfekt als Snack für unterwegs.' },
  { food: 'Paprika & Gurke', text: 'Paprika- und Gurkenstreifen als Snack zur Arbeit mitnehmen – knackig und kaum Kalorien.' },
  { food: 'Brokkoli', text: 'Brokkoli als Beilage zum Abendessen – TK-Brokkoli ist in 6 Minuten fertig.' },
  { food: 'Apfel & Banane', text: 'Einfach einen Apfel oder eine Banane in die Tasche – der leichteste Obst-Punkt des Tages.' },
];
const PROTEIN_FOODS = 'Skyr, Magerquark, Eier, Hähnchen, Thunfisch oder Linsen';
const FIBER_FOODS = 'Haferflocken, Vollkornbrot, Linsen, Kichererbsen oder ein EL Chiasamen';

export function weekStats(startKey, profile = S.profile) {
  const t = targetsOf(profile);
  const today = todayKey();
  const keys = Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
  const perDay = keys.map((k) => {
    const d = S.days[k];
    const s = daySums(d);
    return { key: k, wd: WD_SHORT[parseKey(k).getDay()], ...s, logged: isLogged(d), future: k > today, form: d && d.form, training: (d && d.training) || [], weight: d && d.weight };
  });
  const logged = perDay.filter((d) => d.logged);
  const n = logged.length;
  const avg = (f) => (n ? logged.reduce((a, d) => a + f(d), 0) / n : 0);
  const waterDays = perDay.filter((d) => d.water > 0);
  const st = {
    n,
    kcal: avg((d) => d.kcal),
    p: avg((d) => d.p),
    c: avg((d) => d.c),
    f: avg((d) => d.f),
    fiber: avg((d) => d.fiber),
    sugar: avg((d) => d.sugar),
    fv: avg((d) => d.fv),
    fatPct: avg((d) => (d.kcal ? (d.f * 9 * 100) / d.kcal : 0)),
    water: waterDays.length ? waterDays.reduce((a, d) => a + d.water, 0) / waterDays.length : 0,
    waterDays: waterDays.length,
    proteinDays: logged.filter((d) => d.p >= t.p * 0.9).length,
    trainings: perDay.reduce((a, d) => a + d.training.length, 0),
    fattyDays: logged.filter((d) => d.kcal && (d.f * 9 * 100) / d.kcal > 40).map((d) => d.wd),
  };
  // Schmerzen sammeln
  const pain = {};
  perDay.forEach((d) =>
    ((d.form && d.form.pains) || []).forEach((p) => {
      pain[p.area] = pain[p.area] || { area: p.area, days: 0, max: 0 };
      pain[p.area].days++;
      pain[p.area].max = Math.max(pain[p.area].max, p.level || 0);
    }),
  );
  st.pains = Object.values(pain).sort((a, b) => b.days - a.days);
  const energies = perDay.map((d) => d.form && d.form.energy).filter(Boolean);
  st.energy = energies.length ? energies.reduce((a, b) => a + b, 0) / energies.length : 0;
  const weights = perDay.filter((d) => d.weight).map((d) => d.weight);
  st.weight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
  return { targets: t, perDay, st, keys, week: isoWeek(startKey) };
}

/** Hinweise: was lief gut, was nächste Woche (max. 3) */
export function weekAdvice(ws, profile = S.profile) {
  const { st, targets: t, week } = ws;
  const goal = (profile && profile.goal) || 'halten';
  const good = [];
  const tips = [];
  if (st.n < 3) {
    tips.push({ id: 'log', sev: 1, icon: 'pen', title: 'Mehr Tage eintragen', text: `Nur ${st.n} ${st.n === 1 ? 'Tag' : 'Tage'} richtig eingetragen – für einen aussagekräftigen Check reichen schon 4 Tage. Auch grob schätzen ist besser als nichts.` });
    return { good, tips, enough: false };
  }
  const kcalDiff = (st.kcal - t.kcal) / t.kcal;
  if (kcalDiff > 0.1) {
    tips.push({ id: 'kcal-hi', sev: goal === 'abnehmen' ? 3 : 2, icon: 'flame', title: 'Etwas zu viel gegessen', text: `Im Schnitt ${Math.round(st.kcal)} kcal statt ${t.kcal} (+${Math.round(kcalDiff * 100)} %). Kein Drama – nächste Woche reicht z. B. ein Snack weniger am Abend oder Wasser statt Softdrink.` });
  } else if (kcalDiff < -0.15) {
    tips.push({ id: 'kcal-lo', sev: goal === 'aufbauen' ? 3 : 2, icon: 'flame', title: 'Zu wenig gegessen', text: `Im Schnitt nur ${Math.round(st.kcal)} von ${t.kcal} kcal. ${goal === 'aufbauen' ? 'Für Muskelaufbau brauchst du mehr – ' : 'Das kostet Energie fürs Training – '}eine extra Mahlzeit wie Haferflocken mit Milch und Banane (≈ 450 kcal) hilft.` });
  } else {
    good.push(`Kalorien im Ziel (Ø ${Math.round(st.kcal)} kcal)`);
  }
  if (st.p < t.p * 0.8) {
    tips.push({ id: 'protein', sev: goal === 'halten' ? 2 : 3, icon: 'beef', title: 'Mehr Eiweiß', text: `Ø ${Math.round(st.p)} g statt ${t.p} g. Einfache Extras: ${PROTEIN_FOODS}. Ein Becher Skyr bringt schon ~16 g.` });
  } else if (st.proteinDays >= Math.max(3, st.n - 1)) {
    good.push(`Eiweiß an ${st.proteinDays} von ${st.n} Tagen erreicht`);
  }
  if (st.fatPct > 38) {
    const days = st.fattyDays.length ? ` (vor allem ${st.fattyDays.join(', ')})` : '';
    tips.push({ id: 'fat', sev: 2, icon: 'droplet', title: 'Recht fettig', text: `Ø ${Math.round(st.fatPct)} % der Kalorien aus Fett${days}. Passiert – einfach nächste Woche öfter mal Mageres wählen, z. B. Hähnchen statt Wurst oder Tomatensoße statt Sahne.` });
  }
  if (st.fv < 3) {
    const tip = FRUIT_TIPS[week % FRUIT_TIPS.length];
    tips.push({ id: 'fv', sev: 2, icon: 'apple', title: `Mehr Obst & Gemüse – Tipp: ${tip.food}`, text: `Ø ${st.fv.toFixed(1).replace('.', ',')} Portionen am Tag (Ziel ${t.fv}). ${tip.text}` });
  } else if (st.fv >= 4) {
    good.push(`Ø ${st.fv.toFixed(1).replace('.', ',')} Portionen Obst & Gemüse`);
  }
  if (st.waterDays >= 3 && st.water < t.water * 0.8) {
    tips.push({ id: 'water', sev: 2, icon: 'glass', title: 'Mehr trinken', text: `Ø ${(st.water / 1000).toFixed(1).replace('.', ',')} l statt ${(t.water / 1000).toFixed(1).replace('.', ',')} l. Trick: morgens eine 1-Liter-Flasche hinstellen und bis mittags leeren.` });
  } else if (st.waterDays >= 3 && st.water >= t.water * 0.95) {
    good.push('Genug getrunken');
  } else if (st.waterDays < 3) {
    tips.push({ id: 'water-log', sev: 0.5, icon: 'glass', title: 'Wasser mittracken', text: 'Tipp kurz auf „+250 ml“, wenn du ein Glas trinkst – dann kann ich dir auch dazu was sagen.' });
  }
  if (st.fiber < 20 && !tips.some((x) => x.id === 'fv')) {
    tips.push({ id: 'fiber', sev: 1.5, icon: 'wheat', title: 'Mehr Ballaststoffe', text: `Ø ${Math.round(st.fiber)} g (Ziel ~30 g). Halten lange satt: ${FIBER_FOODS}.` });
  }
  if (st.sugar > 90) {
    tips.push({ id: 'sugar', sev: 1, icon: 'candy', title: 'Viel Zucker', text: `Ø ${Math.round(st.sugar)} g Zucker am Tag. Oft stecken die in Getränken – Zero-Varianten oder Schorle 1:3 sparen viel.` });
  }
  const pains = st.pains.filter((p) => p.days >= 2);
  if (pains.length) {
    const p = pains[0];
    tips.push({ id: 'pain', sev: 2.5, icon: 'pain', title: `${p.area}: ${p.days}× gemeldet`, text: `Gönn der Stelle beim Training etwas Ruhe (leichteres Gewicht, andere Übung). Wenn es nicht besser wird, lass es ärztlich oder physiotherapeutisch anschauen.` });
  }
  if (st.trainings >= 3) good.push(`${st.trainings} Trainings eingetragen`);
  tips.sort((a, b) => b.sev - a.sev);
  return { good: good.slice(0, 3), tips: tips.slice(0, 3), enough: true };
}
