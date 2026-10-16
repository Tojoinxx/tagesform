// KI-Aufgaben: Essensfoto, Nährwerttabelle, Essensvorschläge, Wochen-Fazit
import { askJson } from './ai.js';
import { S, frequentFoods, getDay, lastNDaysSums } from './store.js';
import { daySums, mealLabel, targetsOf, scale } from './nutrition.js';
import { BASE_FOODS } from './basefoods.js';
import { num, WD_LONG, todayKey } from './util.js';

const per100Of = (o) => ({
  kcal: Math.round(num(o && o.kcal)),
  p: num(o && o.p),
  c: num(o && o.c),
  f: num(o && o.f),
  fiber: num(o && o.fiber),
  sugar: num(o && o.sugar),
});

const prefsText = () => {
  const p = S.profile || {};
  const pr = p.prefs || {};
  const lines = [];
  if (pr.diet && pr.diet !== 'alles') lines.push('Ernährungsweise: ' + pr.diet);
  if (pr.likes) lines.push('Isst gern: ' + pr.likes);
  if (pr.dislikes) lines.push('Mag nicht / verträgt nicht: ' + pr.dislikes);
  if (pr.notes) lines.push('Sonstiges: ' + pr.notes);
  return lines.join('\n');
};

// ---------- Essensfoto ----------
export async function analyzeMealPhoto(image, note) {
  const prompt = `Du bist ein erfahrener Ernährungsberater in Deutschland. Analysiere das Foto einer Mahlzeit.
- Erkenne jede Komponente einzeln (z. B. Reis, Hähnchen, Soße, Gemüse, Getränk).
- Schätze die Menge in Gramm (Getränke in ml) so realistisch wie möglich. Nutze Größenreferenzen: Teller ≈ 26 cm, Gabel ≈ 19 cm, Hand, Besteck, Verpackungen.
- Nährwerte pro 100 g für die sichtbare Zubereitung (inkl. typischem Öl/Fett beim Braten, Soße separat).
- fruitVeg = true nur für Obst oder Gemüse.
- confidence: "hoch", "mittel" oder "niedrig".
${note ? 'Hinweis des Nutzers zum Essen: ' + note : ''}
Antworte NUR mit JSON in genau diesem Format:
{"title":"kurzer Name der Mahlzeit","items":[{"name":"Reis, gekocht","grams":180,"per100":{"kcal":130,"p":2.7,"c":28,"f":0.3,"fiber":0.4,"sugar":0.1},"fruitVeg":false,"confidence":"mittel"}],"hint":"Kurzer Tipp, falls etwas unsicher ist (z. B. Menge Öl), sonst leer"}`;
  const j = await askJson(prompt, { image, temperature: 0.2 });
  const items = (j.items || [])
    .map((it) => ({
      name: String(it.name || 'Unbekannt'),
      grams: Math.max(1, Math.round(num(it.grams))),
      per100: per100Of(it.per100),
      fv: !!it.fruitVeg,
      confidence: it.confidence || 'mittel',
    }))
    .filter((it) => it.per100.kcal > 0 || it.per100.p + it.per100.c + it.per100.f > 0);
  return { title: j.title || 'Mahlzeit', items, hint: j.hint || '' };
}

// ---------- Gesprochen / geschrieben ----------
/** Essen aus gesprochener Aufnahme (audio: {mime, base64}) oder Text erkennen */
export async function analyzeMealSpeech({ text, audio }) {
  const prompt = `Du bist ein erfahrener Ernährungsberater in Deutschland. ${audio ? 'In der Sprachaufnahme' : 'Im folgenden Text'} beschreibt jemand, was er gegessen oder getrunken hat (Deutsch, evtl. Dialekt oder Umgangssprache).
${audio ? '- Schreib zuerst wörtlich auf, was gesagt wurde (transcript).\n' : ''}- Zerlege es in einzelne Lebensmittel bzw. Komponenten (z. B. "Brot mit Butter und Käse" → Brot, Butter, Käse).
- Nimm genannte Mengen genau (Gramm, ml, Stück, Scheiben, Löffel, Teller, Glas, Becher …) und rechne sie in Gramm um (Getränke in ml). Ohne Mengenangabe: typische Portion eines Erwachsenen in Deutschland.
- Bekannte Marken- oder Fertigprodukte (z. B. Skyr, Müller Milchreis, Big Mac): typische Nährwerte dieses Produkts.
- Nährwerte pro 100 g in der beschriebenen Zubereitung.
- fruitVeg = true nur für Obst oder Gemüse.
- confidence: "hoch" wenn Menge genannt, sonst "mittel" oder "niedrig".
- meal: falls eine Mahlzeit genannt wird ("zum Frühstück", "mittags", "als Snack"): "fruehstueck", "mittag", "abend" oder "snacks", sonst leer.
${text ? 'Text: "' + String(text).slice(0, 1500) + '"' : ''}
Antworte NUR mit JSON in genau diesem Format:
{"transcript":"${audio ? 'was gesagt wurde' : ''}","title":"kurzer Name der Mahlzeit","meal":"","items":[{"name":"Vollkornbrot","grams":100,"per100":{"kcal":220,"p":7,"c":40,"f":1.5,"fiber":7,"sugar":3},"fruitVeg":false,"confidence":"hoch"}],"hint":"Kurzer Hinweis, falls etwas unklar war, sonst leer"}`;
  const j = await askJson(prompt, { image: audio, temperature: 0.2 });
  const items = (j.items || [])
    .map((it) => ({
      name: String(it.name || 'Unbekannt'),
      grams: Math.max(1, Math.round(num(it.grams))),
      per100: per100Of(it.per100),
      fv: !!it.fruitVeg,
      confidence: it.confidence || 'mittel',
    }))
    .filter((it) => it.per100.kcal > 0 || it.per100.p + it.per100.c + it.per100.f > 0);
  const meal = ["fruehstueck", "mittag", "abend", "snacks"].includes(j.meal) ? j.meal : null;
  return { transcript: String(j.transcript || text || '').trim(), title: j.title || 'Mahlzeit', items, hint: j.hint || '', meal };
}

// ---------- Nährwerttabelle ----------
export async function readLabel(image) {
  const prompt = `Lies die Nährwerttabelle bzw. Verpackung auf dem Foto aus (deutsche Lebensmittelkennzeichnung).
Gib die Werte PRO 100 g bzw. 100 ml an. Steht nur ein Wert pro Portion da, rechne auf 100 g um.
Energie in kcal (nicht kJ). Wenn der Produktname oder die Marke sichtbar ist, gib sie an.
Antworte NUR mit JSON:
{"name":"Produktname oder leer","brand":"Marke oder leer","unit":"g oder ml","per100":{"kcal":0,"p":0,"c":0,"f":0,"fiber":0,"sugar":0},"servingG":0,"packageG":0,"readable":true}`;
  const j = await askJson(prompt, { image, temperature: 0 });
  return {
    name: j.name || '',
    brand: j.brand || '',
    unit: j.unit === 'ml' ? 'ml' : 'g',
    per100: per100Of(j.per100),
    servingG: Math.round(num(j.servingG)),
    packageG: Math.round(num(j.packageG)),
    readable: j.readable !== false,
  };
}

// ---------- Was soll ich essen? ----------
export function suggestContext(dayKey, meal) {
  const t = targetsOf(S.profile);
  const s = daySums(getDay(dayKey));
  const rest = {
    kcal: Math.round(t.kcal - s.kcal),
    p: Math.round(t.p - s.p),
    c: Math.round(t.c - s.c),
    f: Math.round(t.f - s.f),
    fv: Math.max(0, t.fv - s.fv),
    water: Math.max(0, t.water - s.water),
  };
  const week = lastNDaysSums(7, dayKey).filter((d) => d.count > 0);
  const avgFv = week.length ? week.reduce((a, d) => a + d.fv, 0) / week.length : null;
  const avgFiber = week.length ? week.reduce((a, d) => a + d.fiber, 0) / week.length : null;
  return { t, s, rest, avgFv, avgFiber, meal };
}

export async function suggestMeals({ dayKey, meal, have, chips, exclude = [] }) {
  const ctx = suggestContext(dayKey, meal);
  const eaten = (getDay(dayKey).entries || []).map((e) => `${mealLabel(e.meal)}: ${e.name} (${e.grams} ${e.unit || 'g'})`).join('; ');
  const favs = frequentFoods(20).map((f) => f.name).join(', ');
  const now = new Date();
  const time = `${WD_LONG[now.getDay()]}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Uhr`;
  const prompt = `Du bist ein lockerer, praktischer Ernährungs-Coach für einen jungen Mann in Deutschland (Student/Praxisphase, macht Sport).
Wichtig: Ernährung muss nicht 100 % clean sein – realistische, alltagstaugliche Vorschläge, auch mal Kantine, Bäcker oder Imbiss.

Situation:
- Zeit: ${time}${dayKey !== todayKey() ? ' (geplant für ' + dayKey + ')' : ''}
- Mahlzeit: ${mealLabel(meal)}
- Heute noch offen: ${ctx.rest.kcal} kcal, ${ctx.rest.p} g Eiweiß, ${ctx.rest.c} g Kohlenhydrate, ${ctx.rest.f} g Fett
- Tagesziel: ${ctx.t.kcal} kcal, ${ctx.t.p} g Eiweiß
- Obst/Gemüse heute: ${ctx.s.fv} von ${ctx.t.fv} Portionen${ctx.avgFv != null ? `; Wochenschnitt ${ctx.avgFv.toFixed(1)}` : ''}
${ctx.avgFiber != null ? `- Ballaststoffe Wochenschnitt: ${Math.round(ctx.avgFiber)} g (Ziel 30 g)` : ''}
- Heute schon gegessen: ${eaten || 'noch nichts'}
- Isst oft: ${favs || 'unbekannt'}
${prefsText()}
${have ? '- Hat gerade da / Situation: ' + have : ''}
${chips && chips.length ? '- Wünsche: ' + chips.join(', ') : ''}
${exclude.length ? '- Bitte NICHT nochmal vorschlagen: ' + exclude.join(', ') : ''}

Mach genau 3 unterschiedliche Vorschläge, die gut zu den offenen Werten passen (wenn kaum noch Kalorien offen sind: leichte Optionen; wenn viel Eiweiß fehlt: eiweißreich).
Jeder Vorschlag besteht aus 1–4 Zutaten mit Grammangabe und Nährwerten pro 100 g.
Antworte NUR mit JSON:
{"suggestions":[{"title":"Rührei mit Paprika und Brot","why":"kurze Begründung (max. 15 Wörter)","minutes":10,"items":[{"name":"Rührei","grams":130,"per100":{"kcal":170,"p":11,"c":1.5,"f":13,"fiber":0,"sugar":1},"fruitVeg":false}]}]}`;
  const j = await askJson(prompt, { temperature: 0.8 });
  return (j.suggestions || []).slice(0, 3).map((sg) => {
    const items = (sg.items || []).map((it) => ({
      name: String(it.name || ''),
      grams: Math.max(1, Math.round(num(it.grams))),
      per100: per100Of(it.per100),
      fv: !!it.fruitVeg,
    }));
    return { title: sg.title || 'Vorschlag', why: sg.why || '', minutes: num(sg.minutes) || null, items, totals: totalsOf(items), ai: true };
  });
}

export function totalsOf(items) {
  return items.reduce(
    (a, it) => {
      const v = scale(it.per100, it.grams);
      return { kcal: a.kcal + v.kcal, p: a.p + v.p, c: a.c + v.c, f: a.f + v.f };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

// ---------- Ohne KI: Vorschläge aus Vorlagen ----------
const TEMPLATES = [
  { title: 'Skyr mit Granatapfel & Haferflocken', minutes: 2, meals: ['fruehstueck', 'snacks'], items: [['skyr', 200], ['granatapfel', 80], ['haferflocken', 30]] },
  { title: 'Rührei mit Vollkornbrot & Tomate', minutes: 10, meals: ['fruehstueck', 'abend'], items: [['ruehrei', 190], ['vollkornbrot', 50], ['tomate', 100]] },
  { title: 'Overnight Oats mit Beeren', minutes: 5, meals: ['fruehstueck'], items: [['haferflocken', 60], ['milch15', 200], ['heidelbeeren', 80]] },
  { title: 'Hähnchen mit Reis & Brokkoli', minutes: 25, meals: ['mittag', 'abend'], items: [['haehnchen', 150], ['reis', 180], ['brokkoli', 150]] },
  { title: 'Nudeln mit Thunfisch-Tomatensoße', minutes: 15, meals: ['mittag', 'abend'], items: [['nudeln', 250], ['thunfisch', 100], ['tomate', 150]] },
  { title: 'Wrap mit Hähnchen & Salat', minutes: 10, meals: ['mittag', 'abend'], items: [['wrap', 60], ['haehnchen', 120], ['salat', 80], ['frischkaese', 20]] },
  { title: 'Lachs mit Kartoffeln & Gemüse', minutes: 25, meals: ['abend', 'mittag'], items: [['lachs', 125], ['kartoffeln', 250], ['zucchini', 150]] },
  { title: 'Linsen-Bowl mit Feta', minutes: 15, meals: ['mittag', 'abend'], items: [['linsen', 200], ['feta', 40], ['paprika', 100], ['gurke', 100]] },
  { title: 'Magerquark mit Banane', minutes: 2, meals: ['snacks', 'fruehstueck', 'abend'], items: [['magerquark', 200], ['banane', 120]] },
  { title: 'Brezel & Apfel (Bäcker-Snack)', minutes: 0, meals: ['snacks'], items: [['brezel', 80], ['apfel', 180]] },
  { title: 'Proteinriegel & Kiwi', minutes: 0, meals: ['snacks'], items: [['proteinriegel', 60], ['kiwi', 150]] },
  { title: 'Kantine: Fleisch mit Beilage + Salat', minutes: 0, meals: ['mittag'], items: [['kantine', 400], ['salat', 100]] },
  { title: 'Döner (darf auch mal sein)', minutes: 0, meals: ['mittag', 'abend'], items: [['doener', 400]] },
  { title: 'Maultaschen mit Salat', minutes: 10, meals: ['mittag', 'abend'], items: [['maultaschen', 240], ['salat', 150], ['dressing', 15]] },
  { title: 'Mandeln & Heidelbeeren', minutes: 0, meals: ['snacks'], items: [['mandeln', 25], ['heidelbeeren', 100]] },
  { title: 'Gurke, Paprika & Hummus-Kichererbsen', minutes: 5, meals: ['snacks', 'abend'], items: [['gurke', 150], ['paprika', 120], ['kichererbsen', 100]] },
];

export function fallbackSuggestions({ dayKey, meal, exclude = [] }) {
  const ctx = suggestContext(dayKey, meal);
  const find = (id) => BASE_FOODS.find((f) => f.id === 'base:' + id);
  const target = Math.max(150, Math.min(ctx.rest.kcal, meal === 'snacks' ? 400 : 900));
  const scored = TEMPLATES.filter((tp) => !exclude.includes(tp.title)).map((tp) => {
    let items = tp.items.map(([id, g]) => {
      const f = find(id);
      return { name: f.name, grams: g, per100: f.per100, fv: f.fv, unit: f.unit };
    });
    let tot = totalsOf(items);
    // Menge an offene Kalorien anpassen (0,6–1,4×), Obst/Gemüse bleibt
    const k = Math.max(0.6, Math.min(1.4, target / Math.max(1, tot.kcal)));
    if (Math.abs(k - 1) > 0.1) {
      items = items.map((it) => (it.fv ? it : { ...it, grams: Math.round((it.grams * k) / 5) * 5 }));
      tot = totalsOf(items);
    }
    let score = tp.meals.includes(meal) ? 3 : 0;
    score -= Math.abs(tot.kcal - target) / 250;
    if (ctx.rest.p > 25) score += Math.min(2, tot.p / 25);
    if (ctx.rest.fv >= 2 || (ctx.avgFv != null && ctx.avgFv < 3)) score += items.filter((i) => i.fv).length * 0.6;
    if (ctx.rest.kcal < 300 && tot.kcal > 450) score -= 3;
    score += Math.random() * 0.8;
    return { title: tp.title, why: whyOf(tot, items, ctx), minutes: tp.minutes, items, totals: tot, ai: false, _s: score };
  });
  return scored
    .sort((a, b) => b._s - a._s)
    .slice(0, 3)
    .map(({ _s, ...x }) => x);
}

function whyOf(tot, items, ctx) {
  const bits = [];
  if (ctx.rest.p > 25 && tot.p >= 25) bits.push(`${Math.round(tot.p)} g Eiweiß`);
  if (items.some((i) => i.fv) && ctx.rest.fv > 0) bits.push('bringt Obst/Gemüse');
  bits.push(`≈ ${Math.round(tot.kcal)} kcal`);
  return bits.join(' · ');
}

// ---------- Wochen-Fazit ----------
export async function weekSummaryAi(ws, advice) {
  const { st, targets: t } = ws;
  const prompt = `Du bist ein lockerer, motivierender Fitness- und Ernährungscoach. Schreib ein kurzes Wochen-Fazit auf Deutsch (du-Form) für Sonntagabend.
Ernährung muss nicht 100 % clean sein – kein erhobener Zeigefinger, Ausnahmen wie Pizza oder Döner sind okay, es zählt der Schnitt.
Daten der Woche (Ø pro eingetragenem Tag, ${st.n} Tage eingetragen):
- Kalorien ${Math.round(st.kcal)} (Ziel ${t.kcal}), Eiweiß ${Math.round(st.p)} g (Ziel ${t.p}), Fettanteil ${Math.round(st.fatPct)} %, Ballaststoffe ${Math.round(st.fiber)} g, Zucker ${Math.round(st.sugar)} g
- Obst/Gemüse ${st.fv.toFixed(1)} Portionen (Ziel ${t.fv}), Wasser ${(st.water / 1000).toFixed(1)} l (Ziel ${(t.water / 1000).toFixed(1)} l, an ${st.waterDays} Tagen getrackt)
- Trainings: ${st.trainings}; Schmerzen: ${st.pains.map((p) => p.area + ' ' + p.days + '×').join(', ') || 'keine'}
- Ziel: ${(S.profile && S.profile.goal) || 'halten'}
Regelbasierte Hinweise: ${advice.tips.map((x) => x.title).join('; ') || 'keine'}; positiv: ${advice.good.join('; ') || '-'}
${prefsText()}
Antworte NUR mit JSON:
{"headline":"max. 6 Wörter","intro":"1–2 Sätze, was gut lief","tips":[{"emoji":"💧","text":"konkreter Tipp für nächste Woche mit konkretem Lebensmittel, max. 25 Wörter"}],"idea":"eine kleine Idee/Rezept für nächste Woche, max. 20 Wörter"}
Höchstens 3 Tipps.`;
  const j = await askJson(prompt, { temperature: 0.7 });
  return {
    headline: j.headline || 'Dein Wochen-Check',
    intro: j.intro || '',
    tips: (j.tips || []).slice(0, 3).map((x) => ({ emoji: x.emoji || '•', text: x.text || '' })),
    idea: j.idea || '',
  };
}
