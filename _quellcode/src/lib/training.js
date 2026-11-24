// Trainingsplan-Logik: Wochenrhythmus um den Vereinssport, 5-Wochen-Zyklus, Anpassung an Tagesform & Schmerzen, Progression
import { S, getDay, saveTraining } from './store.js';
import { EXERCISES, SESSIONS, ROTATIONS, SPLITS, KG_SPLITS } from './exercises.js';
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

// ---------- Trainingsziel ----------
// Steuert Wiederholungsbereiche, Sätze und Pausen. Muskeln wachsen in einem breiten Bereich (ca. 5–30 Wdh.),
// Maximalkraft profitiert von schweren Lasten (≤ 6 Wdh.), Fitness/Abnehmen von kürzeren Pausen und mehr Bewegung.
export const TRAIN_GOALS = [
  { id: 'muskel', label: 'Muskelaufbau', hint: 'Mehr Muskeln, gute Figur', rest: [120, 75], text: 'Hauptübungen 6–10, Nebenübungen 8–15 Wdh.' },
  { id: 'kraft', label: 'Kraft', hint: 'Schwerer heben', mainReps: [3, 6], mainSetsPlus: 1, rest: [180, 90], exDelta: -1, text: 'Hauptübungen schwer mit 3–6 Wdh., 1 Satz mehr, 3 Min. Pause' },
  { id: 'fit', label: 'Fitness & Abnehmen', hint: 'Fit & straff, kurze Pausen', mainReps: [8, 12], accReps: [12, 15], rest: [90, 60], supersets: true, text: '8–15 Wdh., kurze Pausen, Supersätze' },
  { id: 'athletik', label: 'Athletik', hint: 'Kraft & Schnellkraft', mainReps: [4, 6], rest: [150, 75], text: 'Hauptübungen 4–6 Wdh. + Sprünge & Würfe' },
];
export const goalOf = (setup = setupOf()) => TRAIN_GOALS.find((g) => g.id === setup.goal) || TRAIN_GOALS[0];

// ---------- Persönliche Trainings-Optionen ----------
export const DEFAULT_PREFS = { rpFeedback: true, restMain: 120, restOther: 75, cycle: true, wellness: true, rirPrompt: true, comeback: true, supersets: false, variety: false, warmup: true, autoAdjust: true, keepAwake: true, restSound: true };
/** Gespeicherte Optionen haben Vorrang, sonst Standard des Trainingsziels (null = nicht gesetzt) */
export function prefsOf() {
  const g = goalOf();
  const stored = Object.fromEntries(Object.entries((S.training && S.training.prefs) || {}).filter(([, v]) => v != null));
  return { ...DEFAULT_PREFS, restMain: g.rest[0], restOther: g.rest[1], supersets: !!g.supersets, ...stored };
}

/** Standard-Wiederholungsbereich einer Übung für dein Ziel (Körpergewicht, Sprünge, Halteübungen bleiben) */
export function defaultReps(id, setup = setupOf()) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const g = goalOf(setup);
  if (ex.unit !== 'Wdh.' || ex.plyo || !ex.inc) return ex.reps;
  // Sehr schwere Wiederholungen (3–6) nur bei Langhantel-Grundübungen; Maschinen & RDL: 5–8
  if (ex.main && g.mainReps) return g.mainReps[1] <= 6 && (ex.equip !== 'Langhantel' || id === 'rdl') ? [5, 8] : g.mainReps;
  if (!ex.main && g.accReps && ex.reps[0] < g.accReps[0]) return g.accReps;
  return ex.reps;
}

/** Übung mit persönlichen Einstellungen (Wdh.-Bereich, Steigerung, Sätze) */
export function exOf(id) {
  const ex = EXERCISES[id];
  if (!ex) return ex;
  const o = (S.training && S.training.exOpts && S.training.exOpts[id]) || null;
  return { ...ex, reps: (o && o.reps) || defaultReps(id), inc: o && o.inc != null ? o.inc : ex.inc, sets: (o && o.sets) || ex.sets };
}

// ---------- Ausstattung ----------
export const EQUIP_CATS = [
  { id: 'lh', label: 'Langhantel' },
  { id: 'kh', label: 'Kurzhanteln' },
  { id: 'maschine', label: 'Maschinen' },
  { id: 'kabel', label: 'Kabelzug' },
  { id: 'stange', label: 'Klimmzug-/Dipstange' },
  { id: 'ball', label: 'Medizinball' },
];
export const EQUIP_PRESETS = [
  { id: 'studio', label: 'Fitnessstudio', hint: 'Alle Geräte', cats: null },
  { id: 'home', label: 'Home-Gym', hint: 'Lang- & Kurzhanteln, Stange', cats: ['lh', 'kh', 'stange'] },
  { id: 'kh', label: 'Kurzhanteln', hint: 'Zuhause mit Hanteln', cats: ['kh'] },
  { id: 'kg', label: 'Ohne Geräte', hint: 'Körpergewicht', cats: [] },
];
const EQUIP_MAP = { Langhantel: 'lh', 'SZ-Stange': 'lh', Kurzhantel: 'kh', Kettlebell: 'kh', Maschine: 'maschine', Kabel: 'kabel', Klimmzugstange: 'stange', Medizinball: 'ball', Bauchroller: 'ball' };
const BAR_EX = new Set(['dips', 'chinups', 'beinheben-haengend', 'klimmzug']);
/** Geräte-Kategorie einer Übung (null = geht immer: Körpergewicht, Bank, Stuhl, Tisch) */
export const equipCat = (id) => (BAR_EX.has(id) ? 'stange' : EQUIP_MAP[(EXERCISES[id] || {}).equip] || null);
export const equipList = (setup = setupOf()) => (Array.isArray(setup.equip) ? setup.equip : null);
export const isAvailable = (id, setup = setupOf()) => {
  const c = equipCat(id);
  const l = equipList(setup);
  return !c || !l || l.includes(c);
};
export const equipLabel = (setup = setupOf()) => {
  const l = equipList(setup);
  if (!l) return 'Im Gym';
  const pr = EQUIP_PRESETS.find((p) => p.cats && p.cats.length === l.length && p.cats.every((c) => l.includes(c)));
  return pr ? pr.label : 'Eigene Ausstattung';
};

// ---------- Ausgeschlossene Übungen ----------
export const excludedMap = () => (S.training && S.training.excluded) || {};
export const isExcluded = (id) => !!excludedMap()[id];

// ---------- Schwerpunkte & dauerhafte Beschwerden ----------
export const FOCUS = [
  { id: 'brust', label: 'Brust', mg: ['brust'], add: ['butterfly', 'kabel-cross', 'kh-fly'], region: 'upper' },
  { id: 'ruecken', label: 'Rücken', mg: ['ruecken'], add: ['latzug-eng', 'rudern-kh', 'inverted-row'], region: 'upper' },
  { id: 'schulter', label: 'Schultern', mg: ['schulter'], add: ['seitheben-kabel', 'seitheben', 'reverse-fly'], region: 'upper' },
  { id: 'arme', label: 'Arme', mg: ['bizeps', 'trizeps'], add: ['bizeps-kabel', 'trizeps-ueberkopf', 'hammercurls', 'bench-dips'], region: 'upper' },
  { id: 'beine', label: 'Beine', mg: ['quad', 'beinbeuger'], add: ['beinstrecker', 'beinbeuger-liegend', 'split-squat'], region: 'lower' },
  { id: 'po', label: 'Po', mg: ['po'], add: ['hip-thrust', 'abduktoren', 'kabel-kickback', 'glute-bridge'], region: 'lower' },
  { id: 'waden', label: 'Waden', mg: ['waden'], add: ['wadenheben', 'wadenheben-sitzend'], region: 'lower' },
  { id: 'bauch', label: 'Bauch', mg: ['rumpf'], add: ['kabelcrunch', 'reverse-crunch', 'seitstuetz'], region: 'any' },
];
export const LIMIT_AREAS = ['Schulter', 'Ellbogen', 'Handgelenk', 'Nacken', 'Rücken unten', 'Hüfte', 'Knie', 'Sprunggelenk'];
export const focusOf = (setup = setupOf()) => FOCUS.filter((f) => (setup.focus || []).includes(f.id));
export const focusMgs = (setup = setupOf()) => focusOf(setup).flatMap((f) => f.mg);
export const limitsOf = (setup = setupOf()) => (setup.limits || []).filter((a) => LIMIT_AREAS.includes(a));
export const priMg = (id) => mgOf(id).split('|')[0].split(',')[0];

/** Ersatzübung: gleiche Muskelgruppe, verfügbar, nicht ausgeschlossen, schont die genannten Bereiche */
export function substitute(id, setup = setupOf(), { taken = [], avoid = [] } = {}) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const ok = (e) => e && e.id !== id && isAvailable(e.id, setup) && !isExcluded(e.id) && !taken.includes(e.id) && !hits(e, avoid).length && !!e.plyo === !!ex.plyo;
  const alts = (ex.alt || []).map((a) => EXERCISES[a]).filter(ok);
  // 1) kuratierte Alternative – aber keine schwere Hauptübung als Ersatz für eine Nebenübung
  const same = alts.find((e) => !(e.main && !ex.main));
  if (same) return same;
  // 2) andere Übung für denselben Muskel
  const pm = priMg(id);
  const sec = (mgOf(id).split('|')[1] || '').split(',');
  const score = (e) => (!!e.main === !!ex.main ? 0 : 10) + (e.unit === ex.unit ? 0 : 6) + ((e.alt || []).includes(id) ? -3 : 0) - (mgOf(e.id).split('|')[1] || '').split(',').filter((m) => m && sec.includes(m)).length;
  const cands = Object.values(EXERCISES).filter((e) => ok(e) && priMg(e.id) === pm);
  cands.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'de'));
  if (cands[0] && !!cands[0].main === !!ex.main) return cands[0];
  // 3) notfalls irgendeine passende Alternative
  return alts[0] || cands[0] || null;
}

// ---------- 5-Wochen-Zyklus ----------
export const CYCLE = [
  { label: 'Einstieg', rir: 3, extra: 0, text: 'Technik sauber, 3 Wdh. Reserve' },
  { label: 'Aufbau', rir: 2, extra: 0, text: '2 Wdh. Reserve' },
  { label: 'Mehr Volumen', rir: 2, extra: 1, text: '+1 Satz bei Hauptübungen' },
  { label: 'Intensiv', rir: 1, extra: 1, text: 'bis 1 Wdh. vor dem Versagen' },
  { label: 'Deload', rir: 4, extra: 0, deload: true, text: 'halbe Sätze, weit weg vom Limit – Erholung' },
];
export function cycleWeek(k = todayKey()) {
  const tr = S.training || {};
  // vorgezogene Entlastungswoche (z. B. nach mehreren schlechten Tagen)
  if (tr.deloadWeek && tr.deloadWeek === weekStart(k)) return { ...CYCLE[4], index: 4, n: 5, early: true, c: 0 };
  if (!prefsOf().cycle) return { label: 'Gleichbleibend', rir: 2, extra: 0, text: 'ohne Zyklus', index: -1, n: 0, off: true, c: 0 };
  const start = (tr.setup && tr.setup.cycleStart) || (tr.createdAt ? dateKey(new Date(tr.createdAt)) : k);
  // Nur Wochen, in denen wirklich im Gym trainiert wurde, schieben den Zyklus weiter.
  // So startet jeder mit Woche 1 – auch wenn der Plan schon länger angelegt ist –, und krank, Urlaub
  // oder Wochen ohne Zeit fürs Gym zählen nicht: der Zyklus macht dort weiter, wo du warst.
  const weeks = gymWeeksBetween(weekStart(start), weekStart(k));
  const i = ((weeks % CYCLE.length) + CYCLE.length) % CYCLE.length;
  return { ...CYCLE[i], index: i, n: i + 1, c: Math.max(0, Math.floor(weeks / CYCLE.length)) };
}
/**
 * Anzahl Kalenderwochen in [ws0, ws1), die als „Trainingswoche“ zählen: mindestens die Hälfte der geplanten
 * Gym-Einheiten (bei 3 geplanten also 2; ohne Lauf/Urlaubs-Ersatz). Eine Woche mit nur einer Einheit erhält
 * Kraft und Muskeln (Bickel 2011, Spiering 2021), baut aber kaum Ermüdung auf – sie schiebt den Zyklus
 * deshalb nicht Richtung „Intensiv“ und Deload weiter.
 */
let _gwDays = null;
let _gwCnt = null;
function gymWeeksBetween(ws0, ws1) {
  if (S.days !== _gwDays) {
    _gwDays = S.days;
    _gwCnt = {};
    Object.keys(S.days || {}).forEach((dk) => {
      const n = ((S.days[dk] && S.days[dk].workouts) || []).filter((w) => w && !/^(LAUF|URL)/.test(w.sessionId || '')).length;
      if (n) _gwCnt[weekStart(dk)] = (_gwCnt[weekStart(dk)] || 0) + n;
    });
  }
  const need = Math.max(1, Math.ceil((Number(setupOf().perWeek) || 3) / 2));
  let n = 0;
  for (const w in _gwCnt) if (w >= ws0 && w < ws1 && _gwCnt[w] >= need) n++;
  return n;
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
export const sportProfile = (setup = setupOf()) => {
  if (setup.sportFocus === false) return null;
  if (setup.sport && setup.sport !== 'keiner') return SPORT_PROFILE[setup.sport] || null;
  return setup.goal === 'athletik' ? SPORT_PROFILE.andere : null;
};
/** Alle sportspezifischen Übungen (für Vorschläge in eigenen Plänen) */
export const sportExtras = (setup = setupOf()) => {
  const p = SPORT_PROFILE[setup.sport] || (setup.goal === 'athletik' ? SPORT_PROFILE.andere : null);
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

const exCount = (setup) => Math.max(4, (setup.minutes <= 45 ? 5 : setup.minutes >= 75 ? 7 : 6) + (goalOf(setup).exDelta || 0));
const beginnerSwap = (id) => (id === 'kniebeuge' ? 'goblet' : id === 'rdl' ? 'hip-thrust' : id === 'klimmzug-assist' ? 'latzug' : id);

/** Übungen einer Tagesform-Einheit + wie viele davon heute drankommen */
function autoIds(tpl, setup) {
  let ids = templateIds(tpl, setup);
  if (setup.experience === 'anfaenger') ids = ids.map(beginnerSwap);
  if (tpl.away) return { ids, count: 99 };
  let count = exCount(setup) + (sportProfile(setup) && tpl.legs ? 1 : 0);
  const prof = sportProfile(setup);
  const sportSet = new Set(prof ? [...prof.athletic, ...prof.lower, ...prof.upper] : []);
  // Abwechslung: jede 2. Zyklusrunde Nebenübungen gegen eine Variante tauschen (Hauptübungen bleiben)
  if (prefsOf().variety && cycleWeek().c % 2 === 1) {
    ids = ids.map((x, i) => {
      const e = EXERCISES[x];
      if (!e || i < 2 || e.main || e.plyo || sportSet.has(x)) return x;
      const alt = (e.alt || []).find((a) => EXERCISES[a] && !EXERCISES[a].main && !EXERCISES[a].plyo && !ids.includes(a) && isAvailable(a, setup) && !isExcluded(a));
      return alt || x;
    });
  }
  // Schwerpunkt-Muskeln: passende Zusatzübung (max. 2 pro Einheit), kommt ans Ende
  const region = tpl.legs && !/^(GK|BBP)/.test(tpl.id) ? 'lower' : tpl.legs ? 'mixed' : 'upper';
  const head = ids.slice(0, count);
  const adds = [];
  for (const f of focusOf(setup)) {
    if (adds.length >= 2) break;
    if (!(f.region === 'any' || f.region === region || region === 'mixed')) continue;
    // Einheit hat schon genug für diesen Muskel (z. B. Po-Tag) → keine weitere Übung, nur +1 Satz
    if (head.filter((x) => EXERCISES[x] && f.mg.includes(priMg(x))).length >= 2) continue;
    const pick = f.add.find((a) => EXERCISES[a] && !head.includes(a) && !adds.includes(a) && isAvailable(a, setup) && !isExcluded(a));
    if (pick) adds.push(pick);
  }
  if (adds.length) {
    ids = [...head, ...adds, ...ids.slice(count).filter((x) => !adds.includes(x))];
    count += adds.length;
  }
  return { ids: [...new Set(ids)], count };
}

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
/** Plan-Vorschläge passend zur Ausstattung (ohne Geräte → Körpergewichts-Plan) */
export const noEquip = (setup = setupOf()) => {
  const l = equipList(setup);
  return !!l && !l.some((c) => ['lh', 'kh', 'maschine', 'kabel'].includes(c));
};
export const splitsFor = (setup = setupOf()) => {
  const src = noEquip(setup) ? KG_SPLITS : SPLITS;
  return src[setup.perWeek] || src[3];
};
export const splitOf = (setup = setupOf()) => {
  const list = splitsFor(setup);
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
let _wlDays = null;
let _wl = [];
export function workoutLog() {
  if (S.days === _wlDays) return _wl;
  const out = [];
  Object.keys(S.days)
    .sort()
    .reverse()
    .forEach((k) => ((S.days[k] && S.days[k].workouts) || []).slice().reverse().forEach((w) => out.push({ ...w, date: k })));
  _wlDays = S.days;
  _wl = out;
  return out;
}

/** Geschätztes 1-Wiederholungs-Maximum (Epley); bei Körpergewicht zählen die Wiederholungen */
export const e1rm = (w, r) => (w > 0 ? w * (1 + Math.min(r, 15) / 30) : r);
const isLightW = (w) => !!(w.deload || w.comeback || w.mode === 'light' || w.mode === 'deload' || w.mode === 'comeback');

/** Verlauf einer Übung, neueste zuerst */
export function exHistory(exId, limit = 40) {
  const out = [];
  for (const w of workoutLog()) {
    const it = (w.items || []).find((i) => i.exId === exId);
    const sets = it && (it.sets || []).filter((x) => x.done && x.r > 0);
    if (!sets || !sets.length) continue;
    const topW = workW(sets);
    const top = sets.filter((x) => (x.w || 0) === topW);
    out.push({
      date: w.date,
      at: w.finishedAt || 0,
      sets,
      topW,
      minR: Math.min(...top.map((x) => x.r)),
      avgR: top.reduce((a, x) => a + x.r, 0) / top.length,
      best: Math.max(...sets.map((x) => e1rm(x.w || 0, x.r))),
      light: isLightW(w),
      reset: !!it.reset,
      imported: !!w.imported,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** 4 normale Einheiten hintereinander ohne jeden Fortschritt (Gewicht, Wdh. oder e1RM) → Stagnation */
export function stallInfo(exId) {
  const h = exHistory(exId, 12).filter((x) => !x.light && !x.imported).slice(0, 4);
  if (h.length < 4 || h.slice(0, 3).some((x) => x.reset)) return null;
  if (daysBetween(h[3].date, todayKey()) > 70) return null;
  const prog = (a, b) => b.topW > a.topW || (b.topW === a.topW && b.avgR > a.avgR + 0.01) || b.best > a.best * 1.005;
  if (prog(h[3], h[2]) || prog(h[2], h[1]) || prog(h[1], h[0])) return null;
  return { topW: h[0].topW, since: h[3].date };
}

// Körpergewicht: nächste, schwerere Stufe einer Übung
export const HARDER = {
  'liegestuetz': 'liegestuetz-erhoeht',
  'kniebeuge-kg': 'ausfallschritte-kg',
  'ausfallschritte-kg': 'split-squat',
  'glute-bridge': 'glute-bridge-einbeinig',
  'glute-bridge-einbeinig': 'hip-thrust',
  'inverted-row': 'klimmzug',
  'bench-dips': 'dips',
  'liegestuetz-eng': 'dips',
  'plank': 'bauchroller',
  'reverse-crunch': 'beinheben-haengend',
  'crunches': 'kabelcrunch',
  'donkey-kicks': 'kabel-kickback',
  'superman': 'hyperextension',
  'seitliches-beinheben': 'curtsy-lunge',
};
export function harderOf(id, setup = setupOf(), taken = []) {
  const h = HARDER[id];
  return h && EXERCISES[h] && isAvailable(h, setup) && !isExcluded(h) && !taken.includes(h) ? h : null;
}

/** Aufwärmsätze für Hauptübungen: erste Hauptübung mit voller Rampe, weitere mit einem Satz */
/**
 * Aufwärmsätze für eine Übung im Training.
 * - Muskel noch kalt + Hauptübung: 2–3 Rampensätze (schwer: 40/60/80 %, sonst 50/75 %)
 * - Muskel kalt + Maschine/Kabel: 1 Satz mit ca. 50 %
 * - Muskel schon durch eine frühere Übung warm: Hauptübung 1 kurzer Satz (70 % × 3), sonst keiner
 * items/idx: alle Übungen des Trainings, um „schon warm“ zu erkennen. Rückgabe [{ w, r }] oder null
 */
export function warmupFor(it, idx = 0, items = []) {
  if (!it || it.unit !== 'Wdh.' || !it.target || !it.target.w) return null;
  const w = it.target.w;
  const machine = /Maschine|Kabel/.test(it.equip || '');
  if (w < (machine ? 15 : 20)) return null;
  const mg = priMg(it.exId);
  const warm = items.slice(0, idx).some((x) => x && x.exId && priMg(x.exId) === mg);
  const bar = /Langhantel|SZ/.test(it.equip || '') ? (/SZ/.test(it.equip) ? 10 : 20) : 0;
  const step = it.inc >= 2.5 ? it.inc : it.inc || 1;
  let ramp;
  if (it.main) ramp = warm ? [[0.7, 3]] : w >= 60 ? [[0.4, 8], [0.6, 5], [0.8, 3]] : [[0.5, 10], [0.75, 4]];
  else if (!warm) ramp = [[0.5, 10]];
  else return null;
  const out = [];
  for (const [pc, r] of ramp) {
    const x = Math.max(bar, weightsOf(it.exId) ? snapW(it.exId, w * pc, step, 'near') : roundTo(w * pc, step));
    if (x > 0 && x < w && (!out.length || x > out[out.length - 1].w)) out.push({ w: x, r });
  }
  return out.length ? out : null;
}

/**
 * Live-Anpassung im Training: Nach einem Satz die noch offenen Sätze anpassen.
 * - deutlich zu schwer (RIR 0 bei Ziel ≥ 2, oder ≥ 2 Wdh. unter Ziel): −1 Stufe (ca. 5 %, mind. 1 Steigerung)
 * - deutlich zu leicht (RIR 3+ bei Ziel ≤ 1 und Ziel-Wdh. geschafft, nur beim 1. Satz): +1 Steigerung
 * Rückgabe: { w, dir, why } oder null
 */
export function liveAdjust(it, set, setIndex) {
  if (!it || !it.target || it.unit !== 'Wdh.' || it.plyo) return null;
  const w = Number(set.w) || 0;
  const inc = it.inc || 0;
  if (!w || !inc) return null;
  const tgtR = Number(it.target.reps) || 0;
  const tgtRir = it.target.rir ?? 2;
  const r = Number(set.r) || 0;
  const rir = set.rir === '' || set.rir == null ? null : Number(set.rir);
  // Spätere Sätze verlieren durch Ermüdung normal 1–2 Wdh. – dort nur eingreifen, wenn es unter den Bereich fällt
  const lo = (it.repRange && it.repRange[0]) || 0;
  const hi = (it.repRange && it.repRange[1]) || 99;
  const short = tgtR && r && r <= tgtR - 2 && (setIndex === 0 || r < lo);
  const failed = rir === 0 && tgtRir >= 2;
  if (short || failed) {
    // ca. 5 % leichter, mindestens eine Stufe
    const nw = Math.max(snapW(it.exId, inc, inc, 'up'), Math.min(snapW(it.exId, w * 0.95, inc), stepW(it.exId, w, inc, -1)));
    if (!(nw > 0) || nw >= w) return null;
    return { w: nw, dir: -1, why: short ? `Satz ${setIndex + 1}: nur ${r} statt ${tgtR} Wdh.` : `Satz ${setIndex + 1} ging bis zum Limit (RIR 0)` };
  }
  // klar zu leicht (nur 1. Satz): RIR 3+ und entweder hartes Ziel (RIR ≤ 1) oder deutlich mehr Wdh. als geplant
  const easy = rir != null && rir >= 3 && setIndex === 0 && r >= tgtR && (tgtRir <= 1 || (tgtRir <= 2 && (r >= tgtR + 2 || r > hi)));
  if (easy) {
    const nw = stepW(it.exId, w, inc, 1);
    return nw > w && (nw - w) / w <= 0.15 ? { w: nw, dir: 1, why: `Satz 1 war leicht (RIR 3+${r >= tgtR + 2 ? `, ${r} statt ${tgtR} Wdh.` : ''})` } : null;
  }
  return null;
}

/**
 * Anderes Gewicht als geplant → passende Wiederholungen bei gleicher Anstrengung.
 * Faustregel: Wdh. ändern sich etwa mit dem Quadrat des Gewichtsverhältnisses
 * (60 → 62,5 kg: 10 → 9 Wdh.; 2 → 2,5 kg: 12 → 8 Wdh.). null = wie geplant.
 */
export function repsAt(it, w) {
  if (!it || !it.target || it.unit !== 'Wdh.' || it.plyo) return null;
  const tw = Number(it.target.w) || 0;
  const tr = Number(it.target.reps) || 0;
  const nw = Number(String(w ?? '').replace(',', '.')) || 0;
  if (!tw || !tr || !(nw > 0) || Math.abs(nw - tw) < 1e-9) return null;
  return Math.max(1, Math.min(Math.ceil(tr * 1.8), Math.round(tr * (tw / nw) ** 2)));
}

/** Scheiben pro Seite für die Langhantel (20-kg-Stange) */
export function platesFor(w, bar = 20) {
  if (!w || w <= bar) return null;
  let side = (w - bar) / 2;
  const out = [];
  for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) {
    while (side >= p - 1e-9) {
      out.push(p);
      side -= p;
    }
  }
  return side > 0.01 ? null : out;
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
  if (b && b.w != null && ex) return { date: b.date || todayKey(), imported: b.src || 'Import', sets: Array.from({ length: b.sets || 3 }, () => ({ w: b.w, r: b.r || ex.reps[0], done: true })) };
  return null;
}

const roundTo = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

// ---------- Verfügbare Gewichte (wie bei MCI: Bereiche von–bis in Schritten oder einzelne Gewichte) ----------
const r2 = (v) => Math.round(v * 100) / 100;
/** Liste aus einer Einstellung { mode: 'ranges'|'list', ranges: [{from,to,step}], list: [..] } */
export function gridFrom(cfg) {
  if (!cfg) return null;
  const out = new Set();
  if (cfg.mode === 'list') (cfg.list || []).forEach((v) => Number(v) >= 0 && out.add(r2(Number(v))));
  else
    for (const g of cfg.ranges || []) {
      const a = Number(g.from);
      const b = Number(g.to);
      const st = Number(g.step);
      if (!(a >= 0) || !(b >= a) || !(st > 0)) continue;
      for (let v = a, i = 0; v <= b + 1e-9 && i < 600; v = a + st * ++i) out.add(r2(v));
    }
  const L = [...out].sort((x, y) => x - y).slice(0, 800);
  return L.length ? L : null;
}
/** Verfügbare Gewichte einer Übung oder null (= unbegrenzt, Schrittweite inc) */
export function weightsOf(id) {
  const o = S.training && S.training.exOpts && S.training.exOpts[id];
  return o && o.weights ? gridFrom(o.weights) : null;
}
/** Gewicht auf ein verfügbares runden: near | down | up */
export function snapW(id, v, inc, mode = 'near') {
  const L = weightsOf(id);
  if (!L) {
    const st = inc || 0.5;
    const f = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
    return r2(f(v / st - 1e-9 * (mode === 'up' ? 1 : -1)) * st);
  }
  if (mode === 'down') return [...L].reverse().find((x) => x <= v + 1e-9) ?? L[0];
  if (mode === 'up') return L.find((x) => x >= v - 1e-9) ?? L[L.length - 1];
  return L.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), L[0]);
}
/** n Stufen hoch (n > 0) oder runter (n < 0) */
export function stepW(id, w, inc, n = 1) {
  const L = weightsOf(id);
  if (!L) return r2(Math.max(0, roundTo(w + n * (inc || 0.5), inc || 0.5)));
  const i = n > 0 ? L.findIndex((x) => x > w + 1e-9) : L.length - 1 - [...L].reverse().findIndex((x) => x < w - 1e-9);
  if (n > 0) return i < 0 ? L[L.length - 1] : L[Math.min(L.length - 1, i + n - 1)];
  return i >= L.length ? L[0] : L[Math.max(0, i + n + 1)];
}
/** leichter auf ca. v (auf ein verfügbares Gewicht gerundet, nie schwerer als w) */
const lighter = (id, v, w, inc) => Math.min(w, snapW(id, v, inc, 'near'));
const plusTxt = (a, b) => `+${n1x(b - a)} kg`;
function n1x(v) {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

/**
 * Arbeitsgewicht einer Einheit: das Gewicht, mit dem die meisten Sätze gemacht wurden (bei Gleichstand das schwerere).
 * Dropsätze zählen nicht. So verfälscht ein einzelner zu schwerer erster Satz (danach live leichter gemacht) nichts.
 */
export function workW(sets) {
  const main = sets.filter((s) => s.type !== 'drop');
  const list = main.length ? main : sets;
  const cnt = {};
  list.forEach((s) => (cnt[s.w || 0] = (cnt[s.w || 0] || 0) + 1));
  return Object.keys(cnt)
    .map(Number)
    .sort((a, b) => cnt[b] - cnt[a] || b - a)[0] || 0;
}

/** Doppelte Progression: erst Wiederholungen hoch, dann Gewicht */
export function progression(ex, last) {
  const [lo, hi] = ex.reps;
  if (!last)
    return {
      w: null,
      reps: lo,
      note: ex.plyo ? 'Erstes Mal: locker reinkommen, Technik und weiche Landung zuerst.' : !ex.inc ? (ex.unit === 'Sek.' ? `Erstes Mal: so lange sauber halten, wie es geht (Ziel ${lo}–${hi} Sek.).` : `Erstes Mal: so viele saubere Wdh., dass noch 2 gehen würden (Ziel ${lo}–${hi}).`) : 'Erstes Mal: Gewicht wählen, bei dem noch 2 Wdh. im Tank wären.',
    };
  if (last.forced) return { w: last.sets[0].w, reps: lo, note: `Dein festgelegtes Gewicht – starte mit ${lo} ${ex.unit}, die App steigert ab hier.` };
  const w = workW(last.sets);
  const top0 = last.sets.filter((s) => (s.w || 0) === w);
  const top = top0.filter((s) => s.type !== 'drop').length ? top0.filter((s) => s.type !== 'drop') : top0;
  const minR = Math.min(...top.map((s) => s.r));
  const maxR = Math.max(...top.map((s) => s.r));
  // Neuer Wiederholungsbereich (z. B. Ziel gewechselt): Gewicht über das geschätzte Maximum umrechnen
  if (ex.inc > 0 && w > 0 && (minR > hi + 2 || maxR < lo - 2)) {
    const best = Math.max(...last.sets.map((s) => e1rm(s.w || 0, s.r)));
    const nw = Math.max(snapW(ex.id, ex.inc, ex.inc, 'up'), snapW(ex.id, best / (1 + (lo + 2) / 30), ex.inc));
    const note = maxR < lo - 2 ? `Letztes Mal deutlich zu schwer (${n1x(w)} kg × ${maxR}) – passend zu ${lo}–${hi} Wdh. umgerechnet: ${n1x(nw)} kg. Mit Reserve starten.` : `Neuer Bereich ${lo}–${hi} Wdh.: Gewicht umgerechnet (${n1x(w)} kg × ${maxR} → ${n1x(nw)} kg × ${lo}). Mit Reserve starten.`;
    return { w: nw, reps: lo, note, converted: true };
  }
  // RIR (Wdh. in Reserve), falls eingetragen: genauere Steuerung
  const rated = top.filter((x) => x.rir != null && x.rir !== '' && x.type !== 'fail'); // gewollte Versagenssätze zählen nicht als „zu schwer“
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
  const up = stepW(ex.id, w, ex.inc, 1);
  // Großer Sprung (z. B. Steckgewichte, kleine Hanteln): Start-Wdh. realistisch senken statt stur das untere Ziel
  const big = w > 0 && (up - w) / w > 0.1;
  const upReps = (from) => (big ? Math.max(3, lo - 2, Math.min(from, Math.round(hi * (w / up) ** 2))) : from);
  const bigTxt = big ? ' Großer Sprung – weniger Wdh. sind am Anfang normal.' : '';
  if (up > w && minR >= hi) return { w: up, reps: upReps(lo), note: `Alle Sätze mit ${hi} Wdh. geschafft → ${plusTxt(w, up)} 💪${bigTxt}`, up: true };
  if (up > w && tooEasy) return { w: up, reps: upReps(Math.max(lo, minR - 2)), note: `Letztes Mal zu leicht (RIR Ø ${rirTxt} statt ${tgt}) → ${plusTxt(w, up)} 💪${bigTxt}`, up: true };
  // Fast geschafft: 1. Satz am oberen Ziel, kein Satz mehr als 1 Wdh. darunter – und die Reserve war da (RIR eingetragen)
  if (up > w && !big && maxR >= hi && minR >= hi - 1 && avgRir != null && avgRir >= Math.max(1, tgt) && !zeros)
    return { w: up, reps: lo, note: `Oberes Ziel praktisch erreicht (${top.map((x) => x.r).join(' / ')}) und noch Reserve → ${plusTxt(w, up)} 💪`, up: true };
  if (up <= w && (minR >= hi || tooEasy)) return { w, reps: hi, note: `Schwerstes verfügbares Gewicht erreicht – mehr Wdh., langsamer runter oder eine schwerere Variante.`, up: true };
  if (maxR < lo) {
    // knapp darunter → eine Stufe zurück; deutlich darunter → ca. 10 % leichter (mindestens eine Stufe)
    const down = stepW(ex.id, w, ex.inc, -1);
    const nw = maxR >= lo - 2 ? down : Math.min(down, lighter(ex.id, w * 0.9, w, ex.inc));
    return { w: nw > 0 ? nw : w, reps: lo, note: maxR >= lo - 2 ? `Letztes Mal knapp unter ${lo} Wdh. – eine Stufe leichter und sauber hocharbeiten.` : 'Letztes Mal zu schwer – heute etwas leichter, saubere Technik.' };
  }
  if (zeros && tgt >= 1) return { w, reps: Math.max(lo, minR), note: `Letztes Mal bis zum Limit (RIR 0) – gleiches Ziel, diesmal mit Reserve.${failTip}` };
  return { w, reps: Math.min(hi, minR + 1), note: `Gleiches Gewicht, Ziel: ${Math.min(hi, minR + 1)} Wdh. pro Satz.${failTip}` };
}

// ---------- Tagesform ----------
/** Muskelkater pro Muskelgruppe (neu) – ältere Einträge haben nur „keiner/leicht/stark“ insgesamt */
export const soreOf = (form) => (form && form.sore && typeof form.sore === 'object' ? form.sore : {});
export function formMode(form) {
  if (!form || !form.energy) return { mode: 'normal', label: null, pains: [] };
  const pains = (form.pains || []).filter((p) => p.level >= 4);
  // Mit Angabe pro Muskel wird gezielt angepasst – dann macht starker Muskelkater nicht die ganze Einheit leicht
  const globalSore = form.soreness === 'stark' && !Object.keys(soreOf(form)).length;
  // Schlaf: unter 6 h, oder knapp (6 h) bzw. unruhig bei mittlerer Form → Erholung zuerst (Krafttraining nach kurzem Schlaf: weniger Leistung, höheres Verletzungsrisiko)
  const poorSleep = form.sleep === '< 6 h' || (form.sleepQ === 'unruhig' && (form.sleep === '6 h' || form.energy <= 3));
  if (form.sleep === '< 6 h' || (poorSleep && form.energy <= 4)) return { mode: 'light', label: `Wenig${form.sleepQ === 'unruhig' ? ' bzw. unruhig' : ''} geschlafen – leichte Version: 1 Satz weniger, ca. 10 % weniger Gewicht`, pains, sleep: true };
  if (form.energy <= 2 || globalSore)
    return { mode: 'light', label: 'Leichte Version: 1 Satz weniger, ca. 10 % weniger Gewicht', pains };
  if (form.energy >= 5 && !poorSleep) return { mode: 'push', label: 'Top-Form: Versuch heute bei den Hauptübungen eine Wdh. mehr', pains };
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
  const auto = custom || tpl.my ? null : autoIds(tpl, setup);
  const ids = custom ? custom.filter((id) => EXERCISES[id]) : tpl.my ? tpl.ex.filter((id) => EXERCISES[id]) : auto.ids;
  const cb = tpl.away ? null : comebackState();
  const cw = tpl.away ? { label: 'Erhalt', rir: 2, extra: 0, off: true, n: 0, index: -1 } : cb && cb.restartCycle && cb.step === 0 ? { ...CYCLE[0], index: 0, n: 1 } : cycleWeek();
  const gameWeek = weekSetup(setup).gameDay != null && tpl.legs;
  const goal = goalOf(setup);
  const fMgs = tpl.away ? [] : focusMgs(setup);
  // Tagesform-Schmerzen + dauerhafte Beschwerden aus dem Setup
  const avoid = tpl.away ? painAreas : [...new Set([...painAreas, ...limitsOf(setup)])];
  const used = new Set();
  const items = [];
  const notes = [];
  for (const id of ids) {
    let ex = EXERCISES[id];
    if (!ex) continue;
    let adaptedFrom = null;
    // 1) Ausstattung & ausgeschlossene Übungen: automatisch passenden Ersatz nehmen
    if (!tpl.away && (!isAvailable(ex.id, setup) || isExcluded(ex.id))) {
      const sub = substitute(ex.id, setup, { taken: [...used, ...ids], avoid });
      if (!sub) {
        if (!isExcluded(ex.id)) notes.push(`${ex.name} geht mit deiner Ausstattung nicht – weggelassen`);
        continue;
      }
      adaptedFrom = { id: ex.id, name: ex.name, why: isExcluded(ex.id) ? 'ausgeschlossen' : 'Ausstattung', quiet: true };
      ex = sub;
    }
    // 2) Schmerzen & Beschwerden: schonende Alternative
    const bad = hits(ex, avoid);
    if (bad.length) {
      const alt = substitute(ex.id, setup, { taken: [...used, ...ids], avoid });
      if (alt) {
        adaptedFrom = { id: adaptedFrom ? adaptedFrom.id : ex.id, name: ex.name, why: bad.join(', ') };
        ex = alt;
      } else if (bad.some((b) => strongPain.includes(b)) || bad.includes(ex.stress[0])) {
        notes.push(`${ex.name} weggelassen (${bad.join(', ')})`);
        continue;
      } else {
        adaptedFrom = { id: adaptedFrom ? adaptedFrom.id : ex.id, name: ex.name, why: bad.join(', '), keep: true };
      }
    }
    if (used.has(ex.id)) continue;
    used.add(ex.id);
    items.push({ ex, adaptedFrom });
  }
  const count = auto ? auto.count : 99;
  // Sprünge/Würfe nur, wenn du fit bist: nicht im Wiedereinstieg und nicht an „leichten“ Tagen
  let chosen = items.slice(0, count);
  if (cb || fm.mode === 'light') {
    const dropped = chosen.filter((x) => x.ex.plyo);
    chosen = chosen.filter((x) => !x.ex.plyo);
    if (dropped.length) notes.push(`${dropped.map((x) => x.ex.name).join(', ')} heute weggelassen – Sprünge erst wieder, wenn du ganz fit bist.`);
  }
  let focusBonus = 0;
  const out = chosen.map(({ ex: ex0, adaptedFrom }) => {
    const ex = exOf(ex0.id);
    const last = lastFor(ex.id);
    const pr = progression(ex, last);
    const fixedSets = ex.sets || (tpl.sets && tpl.sets[ex.id]);
    let sets = fixedSets || (ex.main ? Math.min(5, (setup.experience === 'erfahren' ? 4 : 3) + (goal.mainSetsPlus || 0)) : setup.experience === 'anfaenger' ? 2 : 3);
    // Schwerpunkt-Muskel: 1 Satz mehr (mehr Volumen = mehr Wachstum) – höchstens bei 2 Übungen pro Einheit,
    // sonst wird ein Schwerpunkt-Tag (z. B. Po-Tag) zu lang und die Qualität leidet
    const isFocus = !ex.plyo && fMgs.includes(priMg(ex.id));
    if (isFocus && !fixedSets && focusBonus < 2) {
      sets = Math.min(5, sets + 1);
      focusBonus++;
    }
    // Feedback der letzten Trainings (Pump, Belastung, Gelenke, Muskelkater): ±Sätze für diesen Muskel
    const fbAdj = ex.plyo ? 0 : mgAdjOf(priMg(ex.id), cw);
    if (fbAdj) sets = Math.max(1, Math.min(6, sets + fbAdj));
    let w = pr.w;
    let reps = pr.reps;
    let note = last && last.imported && !pr.up && !pr.converted ? `Startwert aus ${last.imported}: ${String(pr.w).replace('.', ',')} kg – versuch ${reps} saubere Wdh.` : pr.note;
    let reset = false;
    let rir = ex.main ? cw.rir : Math.max(0, cw.rir - 1);
    if (cw.extra && ex.main && setup.experience !== 'anfaenger') sets = Math.min(5, sets + cw.extra);
    // Spielwoche (Saison): Beinvolumen etwas runter, Intensität bleibt – Kraft wird so gut erhalten
    if (gameWeek && !cw.deload) sets = Math.max(2, sets - 1);
    // Übung lange nicht gemacht (z. B. nach Planwechsel) → etwas vorsichtiger
    const exGap = last ? daysBetween(last.date, todayKey()) : 0;
    if (cb) {
      sets = Math.max(1, Math.min(cb.maxSets || 9, sets - cb.setsMinus));
      if (last) {
        w = workW(last.sets);
        reps = ex.reps[0];
      }
      if (w) w = snapW(ex.id, w * cb.factor, ex.inc);
      rir = Math.max(rir, cb.rir);
      note = `Wiedereinstieg ${cb.step + 1}/${cb.total}: ~${Math.round((1 - cb.factor) * 100)} % leichter${last ? ` als vor der Pause (${String(workW(last.sets)).replace('.', ',')} kg)` : ''}.`;
    } else if (exGap >= 28 && w && !cw.deload) {
      w = lighter(ex.id, w * 0.9, w, ex.inc);
      reps = ex.reps[0];
      note = `Länger nicht gemacht (${exGap} Tage) – heute ~10 % leichter zum Reinkommen.`;
    } else if (cw.deload) {
      // Deload nach aktuellem Stand (Bell 2023, Coleman 2024): Volumen halbieren und weit weg vom Limit bleiben,
      // das Gewicht aber fast halten (−5 %) – so bleibt die Kraft erhalten, während sich der Körper erholt.
      sets = Math.max(1, Math.ceil(sets / 2));
      if (last) w = workW(last.sets);
      reps = ex.reps[0];
      if (w) w = lighter(ex.id, w * 0.95, w, ex.inc);
      rir = 4;
      note = 'Deload-Woche: halbe Sätze, Gewicht fast wie gewohnt, aber weit weg vom Limit – so erholst du dich, ohne Kraft zu verlieren.';
    } else if (fm.mode === 'light') {
      sets = Math.max(2, sets - 1);
      if (pr.up && last) {
        w = workW(last.sets);
        reps = ex.reps[0];
      }
      if (w) w = lighter(ex.id, w * 0.9, w, ex.inc);
      note = 'Heute leichter – sauber und mit Reserve trainieren.';
    } else if (fm.mode === 'push' && ex.main && !pr.up) {
      reps = Math.min(ex.reps[1], reps + 1);
    }
    // Starker Muskelkater im Zielmuskel: 1 Satz weniger, ~5 % leichter – Training hilft der Erholung, Vollgas nicht
    const soreMapF = soreOf(form);
    const soreLv = soreMapF[priMg(ex.id)] || (soreMapF.nacken === 'stark' && /(^|[|,])nacken/.test(mgOf(ex.id)) ? 'stark' : undefined);
    if (soreLv === 'stark' && !cb && !cw.deload && !tpl.away) {
      sets = Math.max(2, sets - 1);
      if (w && ex.inc) w = lighter(ex.id, w * 0.95, w, ex.inc);
      note = `Starker Muskelkater (${MUSCLE_LABEL[soreMapF[priMg(ex.id)] ? priMg(ex.id) : 'nacken']}): heute 1 Satz weniger und etwas leichter.`;
    }
    // Stagnation: 4 Einheiten ohne Fortschritt → Reset (−10 %) und neu hocharbeiten
    if (!cb && !cw.deload && fm.mode !== 'light' && !tpl.away && !ex.plyo && !pr.up && !(last && last.forced) && soreLv !== 'stark') {
      const st = stallInfo(ex.id);
      if (st && ex.inc > 0 && st.topW > 0) {
        w = lighter(ex.id, st.topW * 0.9, st.topW, ex.inc);
        reps = ex.reps[0];
        reset = true;
        note = `Seit 4 Einheiten kein Fortschritt → Reset: ~10 % leichter (${n1x(w)} kg) und in 2–3 Einheiten wieder vorbei. Oft hilft auch: mehr Schlaf, genug Essen – oder die Übung tauschen.`;
      } else if (st) {
        note = 'Seit 4 Einheiten kein Fortschritt – mach die Übung schwerer (langsamer, größere Bewegung, Zusatzgewicht) oder tausch sie gegen eine Variante.';
      }
    }
    if (soreLv === 'stark' && reset) reset = false;
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
    // Körpergewicht am oberen Ende → konkrete schwerere Variante vorschlagen
    const harder = pr.up && !ex.inc && !tpl.away ? harderOf(ex.id, setup, ids) : null;
    if (harder) note = `Oberes Ziel erreicht 💪 Nächste Stufe: ${EXERCISES[harder].name} – oder diese Übung langsamer (3 Sek. runter) ausführen.`;
    if (adaptedFrom && adaptedFrom.keep) note = `Achtung ${adaptedFrom.why}: nur schmerzfrei, eher leichter.`;
    // Nur Gewichte vorschlagen, die es an deinem Gerät wirklich gibt
    if (w && ex.inc && weightsOf(ex.id)) w = snapW(ex.id, w, ex.inc);
    return {
      harder,
      exId: ex.id,
      name: ex.name,
      equip: ex.equip,
      unit: ex.unit,
      cue: ex.cue,
      main: !!ex.main,
      plyo: !!ex.plyo,
      focus: isFocus,
      repRange: ex.reps,
      inc: ex.inc,
      target: { w, reps, rir },
      sets: Array.from({ length: sets }, () => ({ w: w ?? '', r: '', done: false })),
      last,
      note,
      reset,
      adaptedFrom: adaptedFrom && !adaptedFrom.keep ? adaptedFrom : null,
    };
  });
  // Obergrenze pro Einheit: Ab ca. 11 Sätzen pro Muskel (Hilfsmuskel = ½) bringt mehr in derselben Einheit
  // kaum noch zusätzliches Wachstum (Pelland et al. 2024) – überzählige Sätze bei den letzten Übungen kürzen.
  if (!tpl.away) {
    const CAP = 11;
    const load = {};
    const parts = (it) => {
      const [pri, sec] = mgOf(it.exId).split('|');
      return [...(pri || '').split(',').filter(Boolean).map((m) => [m, 1]), ...(sec || '').split(',').filter(Boolean).map((m) => [m, 0.5])];
    };
    out.forEach((it) => !it.plyo && parts(it).forEach(([m, k]) => (load[m] = (load[m] || 0) + it.sets.length * k)));
    for (let i = out.length - 1; i >= 0; i--) {
      const it = out[i];
      const pm = priMg(it.exId);
      if (it.plyo || !(load[pm] > CAP)) continue;
      const cut = Math.min(it.sets.length - 2, Math.ceil(load[pm] - CAP));
      if (cut <= 0) continue;
      it.sets = it.sets.slice(0, it.sets.length - cut);
      parts(it).forEach(([m, k]) => (load[m] -= cut * k));
      it.note = `${it.note ? it.note + ' ' : ''}(${cut} Satz weniger: ${MUSCLE_LABEL[pm]} hat heute schon genug Sätze – mehr bringt in einer Einheit kaum etwas.)`;
    }
  }
  // Supersätze: zwei Nebenübungen für verschiedene Muskeln im Wechsel – spart Zeit, gleicher Effekt
  if (prefsOf().supersets && !tpl.away) pairSupersets(out);
  const mode = cb ? 'comeback' : cw.deload ? 'deload' : fm.mode;
  const modeLabel = cb ? comebackText(cb) : cw.deload ? 'Deload-Woche: halbe Sätze, Gewicht fast gleich, viel Reserve' : fm.label || (gameWeek ? 'Spielwoche: 1 Satz weniger pro Übung, Gewichte bleiben – frische Beine fürs Spiel.' : null);
  return { sessionId, name: tpl.name, focus: tpl.focus, items: out, mode, modeLabel, notes, pains: fm.pains, cycle: cw, comeback: cb ? { gap: cb.gap, step: cb.step, total: cb.total, restartCycle: !!cb.restartCycle, sick: !!cb.sick } : null };
}

function pairSupersets(items) {
  let n = 0;
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i];
    const b = items[i + 1];
    const ok = (x) => !x.main && !x.plyo && x.unit === 'Wdh.' && !x.ss;
    if (ok(a) && ok(b) && priMg(a.exId) !== priMg(b.exId)) {
      const L = 'ABCDEF'[n++];
      Object.assign(a, { ss: L, ssPos: 1 });
      Object.assign(b, { ss: L, ssPos: 2 });
      i++;
    }
  }
}

/** Übung im laufenden Training tauschen (z. B. Gerät besetzt) */
export function swapOptions(exId, exclude = [], avoid = []) {
  const ex = EXERCISES[exId];
  const list = [...ex.alt];
  // weitere Übungen mit ähnlichem Ziel: gleiche Session-Gruppe
  Object.values(EXERCISES).forEach((e) => {
    if (e.id !== exId && !list.includes(e.id) && e.alt.includes(exId)) list.push(e.id);
  });
  const setup = setupOf();
  const fine = (e) => e && !exclude.includes(e.id) && isAvailable(e.id, setup) && !isExcluded(e.id) && !hits(e, avoid).length;
  const ok = list.filter((id) => fine(EXERCISES[id]));
  // keine direkten Alternativen? → Übungen für denselben Muskel (schonend, verfügbar)
  if (ok.length < 3) {
    const pm = priMg(exId);
    Object.values(EXERCISES)
      .filter((e) => e.id !== exId && priMg(e.id) === pm && !ok.includes(e.id) && fine(e) && !!e.plyo === !!ex.plyo)
      .slice(0, 5 - ok.length)
      .forEach((e) => ok.push(e.id));
  }
  return ok.map((id) => EXERCISES[id]);
}

export function itemFor(exId, setup = setupOf()) {
  const ex = exOf(exId);
  const last = lastFor(ex.id);
  const pr = progression(ex, last);
  const sets = ex.sets || (ex.main ? Math.min(5, 3 + (goalOf(setup).mainSetsPlus || 0)) : setup.experience === 'anfaenger' ? 2 : 3);
  const cw = cycleWeek();
  return { exId: ex.id, name: ex.name, equip: ex.equip, unit: ex.unit, cue: ex.cue, main: !!ex.main, repRange: ex.reps, inc: ex.inc, target: { w: pr.w, reps: pr.reps, rir: ex.main ? cw.rir : Math.max(0, cw.rir - 1) }, sets: Array.from({ length: sets }, () => ({ w: pr.w ?? '', r: '', done: false })), last, note: pr.note, adaptedFrom: null };
}

// ---------- Wochenrhythmus ----------
export const isHB = (setup, d) => (setup.handballDays || []).includes(d) || setup.gameDay === d;
export const isGame = (setup, d) => setup.gameDay === d;

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
  // Abgesagtes Vereinstraining (einzelne Tage): der Tag zählt dann wie ein freier Tag
  const off = (S.training && S.training.sportOff) || {};
  const offDays = [];
  for (let i = 0; i < 7; i++) if (off[addDays(ws, i)]) offDays.push(parseKey(addDays(ws, i)).getDay());
  const handballDays = offDays.length ? (setup.handballDays || []).filter((d) => !offDays.includes(d)) : setup.handballDays;
  return { ...setup, handballDays, sportOffDays: offDays, gameDay: sportOf(setup).games ? gameDayForWeek(setup, ws) : null, blocked, breakDays: brk };
};
/** Vereinstraining an einem Tag absagen / wieder ansetzen */
export const sportOffOn = (k = todayKey()) => !!(S.training && S.training.sportOff && S.training.sportOff[k]);
export function setSportOff(k, on) {
  const cut = addDays(todayKey(), -21);
  const cur = Object.fromEntries(Object.entries((S.training && S.training.sportOff) || {}).filter(([d, v]) => v && d >= cut));
  if (on) cur[k] = true;
  else delete cur[k];
  saveTraining({ sportOff: cur });
}
/** Wäre an dem Tag laut Wochenplan Vereinstraining (ohne Absagen)? */
export const sportPlannedOn = (k, setup = setupOf()) => hasSport(setup) && (setup.handballDays || []).includes(parseKey(k).getDay());

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
  const doneThisWeek = log.filter((w) => w.date >= ws && w.date <= addDays(ws, 6) && !isAwaySession(w.sessionId));
  const doneToday = doneThisWeek.filter((w) => w.date === k);
  const plan = weekPlan(setup);
  const left = plan.map((p) => p.sessionId);
  doneThisWeek.forEach((w) => {
    const i = left.indexOf(w.sessionId);
    if (i >= 0) left.splice(i, 1);
  });
  const form = getDay(k).form;
  const tomorrowHB = isHB(tomorrowSetup, (d + 1) % 7);
  const soreMap = soreOf(form);
  const legsSore = form && (Object.keys(soreMap).length ? ['quad', 'beinbeuger', 'po'].some((m) => soreMap[m] === 'stark') : form.soreness === 'stark');
  // Oberkörper stark verkatert → wenn möglich lieber eine andere Einheit
  const soreHits = (sid) => sessionOf(sid).ex.filter((x) => EXERCISES[x] && soreMap[priMg(x)] === 'stark').length;
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
  if (sessionId && soreHits(sessionId) >= 2) {
    const alt = left.find((x) => x !== sessionId && !(sessionOf(x).legs && legsBlocked) && soreHits(x) < soreHits(sessionId));
    if (alt) {
      reasons.push(`Starker Muskelkater in Muskeln von ${sessionOf(sessionId).name} – heute lieber ${sessionOf(alt).name}.`);
      sessionId = alt;
    }
  }
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
  // Optionales Cardio: Bonus an freien Tagen (nicht am Spieltag, nicht am Tag davor, nicht wenn heute schon trainiert)
  const cardio = cardioState(setup0, k);
  const cardioToday = cardio && cardio.left > 0 && (status === 'free' || status === 'goal') ? cardio.next : null;
  return { sessionId, status, reasons, tomorrowGame, yesterdayGame, gameDay: setup.gameDay, doneThisWeek: doneThisWeek.length, perWeek: plan.length, planned: !!planned, rot, doneToday: doneToday[0] || null, left, cardio, cardioToday };
}

/** Optionale Läufe pro Woche: wie viele schon gemacht (Lauf-Einheiten oder eingetragene Läufe)? */
export function cardioState(setup = setupOf(), k = todayKey()) {
  const n = Number(setup.cardio) || 0;
  if (!n) return null;
  const ws = weekStart(k);
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const day = getDay(addDays(ws, i));
    done += (day.training || []).filter((t) => /^Laufen/.test(t.type || '')).length;
  }
  const doneToday = (getDay(k).training || []).some((t) => /^Laufen/.test(t.type || ''));
  // 1. Lauf locker; 2. Lauf mit Intervallen (Sprintsportarten profitieren davon)
  return { n, done, left: doneToday ? 0 : Math.max(0, n - done), next: done % 2 === 1 && sportOf(setup).sprint ? 'LAUF2' : 'LAUF1' };
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
export const MUSCLE_LABEL = { brust: 'Brust', ruecken: 'Rücken', schulter: 'Schultern', nacken: 'Nacken / Trapez', bizeps: 'Bizeps', trizeps: 'Trizeps', quad: 'Oberschenkel vorne', beinbeuger: 'Beinbeuger', po: 'Po', adduktoren: 'Adduktoren', waden: 'Waden', rumpf: 'Rumpf' };
// Trapez/Nacken: Hauptmuskel bei Shrugs, hilft bei Rudern, Kreuzheben, Schulterdrücken, Seitheben & Co.
const NECK_PRI = ['shrugs'];
const NECK_SEC = ['upright-row', 'farmers-walk', 'kreuzheben', 'sumo-kreuzheben', 'rdl', 'kh-rdl', 'facepull', 'reverse-fly', 'reardelt-kabel', 'reardelt-seil', 'rudern-reardelt', 'rudern-kabel', 'rudern-brust', 'rudern-kh', 'langhantelrudern', 'tbar', 'high-row', 'inverted-row', 'schulterdruecken', 'schulterpresse', 'military-press', 'seitheben', 'seitheben-kabel', 'seitheben-maschine'];
export const mgOf = (id) => {
  const base = MG[id] || (EXERCISES[id] && EXERCISES[id].mg) || '|';
  if (NECK_PRI.includes(id)) return 'nacken|' + base.split('|').join(',').replace(/^,|,$/g, '');
  if (NECK_SEC.includes(id)) {
    const [a, b] = base.split('|');
    return `${a}|${[b, 'nacken'].filter(Boolean).join(',')}`;
  }
  return base;
};

export function weeklyVolume(setup = { ...setupOf(), gameDay: null }) {
  // Nacken/Trapez nur für Muskelkater & Anzeige – nicht im Wochenvolumen (wird über Rücken/Schulter mittrainiert)
  const vol = Object.fromEntries(Object.keys(MUSCLE_LABEL).filter((k) => k !== 'nacken').map((k) => [k, 0]));
  weekPlan(setup).forEach((p) => {
    buildSession(p.sessionId, setup, null).items.forEach((it) => {
      const [pri, sec] = mgOf(it.exId).split('|');
      const n = it.sets.length;
      pri.split(',').filter((m) => m in vol).forEach((m) => (vol[m] += n));
      (sec || '').split(',').filter((m) => m in vol).forEach((m) => (vol[m] += n / 2));
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
  const a = autoIds(tpl, setup);
  return a.ids.slice(0, a.count);
}
export const isCustom = (sessionId) => !!(S.training && S.training.custom && S.training.custom[sessionId]);

// ---------- Plan-Empfehlung ----------
/** Welcher Split passt am besten zu dir – mit Begründung */
export function recommendSplit(st) {
  const list = splitsFor(st);
  if (noEquip(st)) return { id: list[0].id, why: 'Körpergewicht – passt zu deiner Ausstattung' };
  const focus = st.focus || [];
  const pick = (pred, why) => {
    const x = list.find(pred);
    return x ? { id: x.id, why } : null;
  };
  const sp = SPORTS.find((x) => x.id === st.sport);
  const sportOn = st.sport && st.sport !== 'keiner';
  return (
    (focus.includes('po') && pick((x) => /^bbp/.test(x.id), 'passt zu deinem Schwerpunkt Po')) ||
    ((focus.includes('po') || focus.includes('beine')) && pick((x) => /^(bbp|ukokuk)/.test(x.id), 'mehr Beintage für deinen Schwerpunkt')) ||
    (focus.includes('arme') && pick((x) => /arme/.test(x.id), 'eigener Arm-Tag für deinen Schwerpunkt')) ||
    // 2× Kraft neben ≥ 2 Vereinstrainings: Ganzkörper hätte zwangsläufig Beine vor dem Training → Ober/Unter
    (sportOn && st.perWeek <= 2 && (st.handballDays || []).length >= 2 && pick((x) => /^okuk/.test(x.id), `Beine nur 1×, mit Abstand zu ${sp && sp.id !== 'andere' ? sp.name : 'deinem Sport'} und Spiel – die Beine trainiert der Sport mit`)) ||
    (sportOn && pick((x) => x.sport, `wenig Beintage – passt neben ${sp && sp.id !== 'andere' ? sp.name : 'deinem Sport'}`)) ||
    (st.experience === 'anfaenger' && pick((x) => /^gk/.test(x.id), 'Ganzkörper: jede Übung oft üben – ideal zum Lernen')) ||
    (st.goal === 'fit' && pick((x) => /^gk/.test(x.id), 'Ganzkörper: viel Bewegung pro Einheit, jeder Muskel oft')) ||
    (st.goal === 'kraft' && pick((x) => /^okuk/.test(x.id), 'Grundübungen oft genug für Kraftzuwachs')) ||
    { id: list[0].id, why: 'bewährter Standard für dein Pensum' }
  );
}

// ---------- Ermüdung erkennen ----------
/** Mehrere schlechte Tage oder sinkende Leistung → Entlastungswoche vorschlagen */
export function fatigueState(k = todayKey()) {
  const tr = S.training || {};
  const ws = weekStart(k);
  if (!tr.setup || tr.fatigueDismissed === ws || tr.deloadWeek === ws) return null;
  const cw = cycleWeek(k);
  if (cw.deload || cw.index === 0 || comebackState(k)) return null;
  const forms = Array.from({ length: 7 }, (_, i) => getDay(addDays(k, -i)).form).filter((f) => f && f.energy && !f.skipped);
  const low = forms.filter((f) => f.energy <= 2 || f.soreness === 'stark' || f.sleep === '< 6 h' || (f.sleepQ === 'unruhig' && f.sleep !== '8 h' && f.sleep !== '9 h +')).length;
  const log = workoutLog().filter((w) => w.date > addDays(k, -11) && w.date <= k && !isAwaySession(w.sessionId));
  const light = log.filter((w) => w.mode === 'light').length;
  let drops = 0;
  log.slice(0, 2).forEach((w) =>
    (w.items || []).forEach((it) => {
      const ex = exOf(it.exId);
      if (ex && ex.unit === 'Wdh.' && (it.sets || []).length && Math.max(...it.sets.map((x) => x.r)) < ex.reps[0]) drops++;
    }),
  );
  if (low >= 3 || light >= 2 || drops >= 3) {
    const why = low >= 3 ? `${low} von 7 Tagen müde, schlecht geschlafen oder starker Muskelkater` : light >= 2 ? `${light} leichte Einheiten in den letzten 10 Tagen` : 'mehrere Übungen zuletzt unter deinem Wiederholungsbereich';
    return { why };
  }
  return null;
}

// ---------- Fortschritt ----------
export function progressStats(k = todayKey()) {
  const log = workoutLog();
  const ws = weekStart(k);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(ws, -7 * (7 - i));
    const e = addDays(s, 6);
    const list = log.filter((w) => w.date >= s && w.date <= e);
    return { ws: s, n: list.filter((w) => !isAwaySession(w.sessionId)).length, away: list.filter((w) => isAwaySession(w.sessionId)).length, sets: list.reduce((a, w) => a + (w.items || []).reduce((b, it) => b + (it.sets || []).length, 0), 0) };
  });
  // Rekorde: laufendes Maximum (e1RM) pro Übung, chronologisch
  const chron = log.slice().reverse();
  const best = {};
  const prs = [];
  const since = addDays(k, -30);
  chron.forEach((w) =>
    (w.items || []).forEach((it) => {
      const sets = (it.sets || []).filter((x) => x.done && x.r > 0 && x.w > 0);
      if (!sets.length) return;
      const v = Math.max(...sets.map((x) => e1rm(x.w, x.r)));
      if (best[it.exId] != null && v > best[it.exId] + 0.01 && w.date >= since) prs.push({ exId: it.exId, name: it.name, date: w.date, v });
      best[it.exId] = Math.max(best[it.exId] || 0, v);
    }),
  );
  // Kraftentwicklung der Hauptübungen in den letzten 8 Wochen
  const from = addDays(k, -56);
  const tr = {};
  chron
    .filter((w) => w.date >= from && !isLightW(w))
    .forEach((w) =>
      (w.items || []).forEach((it) => {
        const ex = EXERCISES[it.exId];
        const sets = (it.sets || []).filter((x) => x.done && x.r > 0 && x.w > 0);
        if (!ex || !ex.main || !sets.length) return;
        const v = Math.max(...sets.map((x) => e1rm(x.w, x.r)));
        const t = tr[it.exId] || (tr[it.exId] = { exId: it.exId, name: ex.name, first: v, firstDate: w.date, last: v, n: 0 });
        t.last = v;
        t.n++;
      }),
    );
  const trend = Object.values(tr)
    .filter((t) => t.n >= 2)
    .map((t) => ({ ...t, pct: ((t.last - t.first) / t.first) * 100 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  return { weeks, prs, trend, best };
}

/** Bestes e1RM einer Übung vor diesem Training (für Rekorde) */
export function bestE1rm(exId) {
  let b = 0;
  for (const h of exHistory(exId, 400)) if (h.topW > 0) b = Math.max(b, h.best);
  return b;
}

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

// ---------- Volumen & Erholung je Muskel (Statistik) ----------
/** Zielbereich harte Sätze pro Woche je Muskelgruppe (Muskelaufbau; bei anderen Zielen etwas weniger) */
export function volTarget(mg, setup = setupOf()) {
  const base = { brust: [10, 20], ruecken: [10, 20], schulter: [8, 18], quad: [10, 20], beinbeuger: [6, 14], po: [6, 16], bizeps: [6, 14], trizeps: [6, 14], waden: [6, 12], adduktoren: [4, 10], rumpf: [6, 14] }[mg] || [6, 14];
  const g = goalOf(setup).id;
  // Vereinssport belastet die Beine zusätzlich – dort reicht weniger
  const legs = ['quad', 'beinbeuger', 'po', 'waden', 'adduktoren'].includes(mg) && hasSport(setup) ? 0.7 : 1;
  const f = (g === 'muskel' ? 1 : g === 'kraft' ? 0.8 : 0.7) * legs;
  return [Math.max(2, Math.round(base[0] * f)), Math.max(4, Math.round(base[1] * f))];
}

/** Erledigte harte Sätze je Muskelgruppe in einer Woche (primär 1, Hilfsmuskel ½) */
export function setsPerMuscle(ws = weekStart(todayKey())) {
  const we = addDays(ws, 6);
  const vol = Object.fromEntries(Object.keys(MUSCLE_LABEL).filter((k) => k !== 'nacken').map((k) => [k, 0]));
  for (const w of workoutLog()) {
    if (w.date < ws || w.date > we) continue;
    for (const it of w.items || []) {
      const n = (it.sets || []).filter((x) => x.done !== false && x.r > 0).length;
      if (!n) continue;
      const [pri, sec] = mgOf(it.exId).split('|');
      (pri || '').split(',').filter((m) => m in vol).forEach((m) => (vol[m] += n));
      (sec || '').split(',').filter((m) => m in vol).forEach((m) => (vol[m] += n / 2));
    }
  }
  return vol;
}

/**
 * Erholung je Muskelgruppe in % (wie Fitbod): jeder harte Satz = 10 Ermüdungspunkte,
 * die über ~4 Tage linear abklingen (kleine Muskeln 3 Tage). Starker Muskelkater heute deckelt bei 40 %, leichter bei 70 %.
 */
export function recoveryMap(now = Date.now()) {
  const groups = Object.keys(MUSCLE_LABEL);
  const fat = Object.fromEntries(groups.map((g) => [g, 0]));
  const small = ['bizeps', 'trizeps', 'waden', 'rumpf', 'nacken', 'adduktoren'];
  for (const w of workoutLog()) {
    const t = w.finishedAt && w.finishedAt > 1e11 ? w.finishedAt : parseKey(w.date).getTime() + 18 * 3600e3;
    const h = (now - t) / 3600e3;
    if (h > 120) break; // Log ist neueste zuerst
    if (h < 0) continue;
    for (const it of w.items || []) {
      const n = (it.sets || []).filter((x) => x.done !== false && x.r > 0).length;
      if (!n) continue;
      const [pri, sec] = mgOf(it.exId).split('|');
      const add = (m, k) => {
        if (!(m in fat)) return;
        const T = small.includes(m) ? 72 : 96;
        fat[m] += n * k * 10 * Math.max(0, 1 - h / T);
      };
      (pri || '').split(',').forEach((m) => add(m, 1));
      (sec || '').split(',').forEach((m) => add(m, 0.5));
    }
  }
  const sore = soreOf(getDay(todayKey()).form);
  return Object.fromEntries(
    groups.map((g) => {
      let r = Math.round(Math.max(0, 100 - fat[g]));
      if (sore[g] === 'stark') r = Math.min(r, 40);
      else if (sore[g] === 'leicht') r = Math.min(r, 70);
      return [g, r];
    }),
  );
}

/**
 * Serie: Wochen in Folge, in denen dein Wochenziel (Gym-Einheiten) erreicht wurde.
 * Die laufende Woche zählt mit, sobald das Ziel erreicht ist, bricht die Serie aber nicht.
 * Wochen mit Krank/Urlaub (überwiegend) werden übersprungen.
 */
export function weekStreak(k = todayKey()) {
  const setup = setupOf();
  const goal = Math.max(1, Number(setup.perWeek) || 3);
  const log = workoutLog();
  const count = (ws) => {
    const we = addDays(ws, 6);
    return log.filter((w) => w.date >= ws && w.date <= we && (w.items || []).length).length;
  };
  const paused = (ws) => [0, 1, 2, 3, 4, 5, 6].filter((i) => breakOn(addDays(ws, i))).length >= 4;
  const cur = weekStart(k);
  const nowN = count(cur);
  let n = nowN >= goal ? 1 : 0;
  let ws = addDays(cur, -7);
  for (let i = 0; i < 104; i++, ws = addDays(ws, -7)) {
    if (paused(ws)) continue;
    if (count(ws) >= goal) n++;
    else break;
  }
  return { weeks: n, goal, thisWeek: nowN };
}

// ---------- Kraftniveau (Richtwerte wie Strength Level / ExRx: geschätztes 1RM ÷ Körpergewicht) ----------
const LEVELS = ['Anfänger', 'Einsteiger', 'Fortgeschritten', 'Sehr fortgeschritten', 'Elite'];
const STD = {
  bankdruecken: { m: [0.5, 0.75, 1.0, 1.5, 2.0], w: [0.25, 0.5, 0.75, 1.0, 1.5] },
  kniebeuge: { m: [0.75, 1.25, 1.5, 2.25, 2.75], w: [0.5, 0.75, 1.25, 1.5, 2.0] },
  kreuzheben: { m: [1.0, 1.5, 2.0, 2.5, 3.0], w: [0.5, 1.0, 1.25, 1.75, 2.5] },
  'military-press': { m: [0.35, 0.55, 0.75, 1.0, 1.25], w: [0.2, 0.35, 0.5, 0.75, 1.0] },
  'military-sitzend': { m: [0.35, 0.55, 0.75, 1.0, 1.25], w: [0.2, 0.35, 0.5, 0.75, 1.0] },
  langhantelrudern: { m: [0.5, 0.75, 1.0, 1.5, 1.75], w: [0.25, 0.4, 0.65, 0.9, 1.2] },
  'hip-thrust': { m: [0.75, 1.25, 1.75, 2.5, 3.25], w: [0.5, 1.0, 1.5, 2.25, 3.0] },
  frontkniebeuge: { m: [0.6, 1.0, 1.25, 1.75, 2.25], w: [0.4, 0.6, 1.0, 1.25, 1.6] },
};
/** Körpergewicht: letzte Wiegung (bis 30 Tage), sonst Profil */
export function bodyWeightNow(k = todayKey()) {
  for (let i = 0; i < 30; i++) {
    const d = S.days[addDays(k, -i)];
    if (d && d.weight > 0) return d.weight;
  }
  return Number(S.profile && S.profile.weightKg) || null;
}
/** { level, idx, ratio, e1, next, needKg } oder null, wenn es keine Richtwerte gibt */
export function strengthLevel(exId) {
  const st = STD[exId];
  const bw = bodyWeightNow();
  if (!st || !bw) return null;
  const since = addDays(todayKey(), -56);
  let e1 = 0;
  for (const w of workoutLog()) {
    if (w.date < since) break;
    const it = (w.items || []).find((x) => x.exId === exId);
    if (!it) continue;
    for (const s of it.sets || []) if (s.w > 0 && s.r > 0 && s.r <= 12 && s.done !== false) e1 = Math.max(e1, e1rm(s.w, s.r));
  }
  if (!e1) return null;
  const t = st[S.profile && S.profile.sex === 'w' ? 'w' : 'm'];
  const ratio = e1 / bw;
  let idx = -1;
  t.forEach((v, i) => ratio >= v && (idx = i));
  const ni = Math.min(t.length - 1, idx + 1);
  return { level: idx < 0 ? 'Unter Anfänger' : LEVELS[idx], idx, ratio, e1, next: idx < t.length - 1 ? LEVELS[ni] : null, needKg: idx < t.length - 1 ? Math.max(0, t[ni] * bw - e1) : 0, pctToNext: idx < t.length - 1 ? Math.max(0, Math.min(1, (ratio - (t[idx] || 0)) / (t[ni] - (t[idx] || 0)))) : 1 };
}

// ---------- Feedback nach der Übung (wie RP Hypertrophy): Sätze pro Muskel anpassen ----------
// training.mgAdj = { mg: { v: -1..+2, c: Zyklus-Nr. } } – gilt nur im laufenden Zyklus, nicht in der Deload-Woche
export function mgAdjOf(mg, cw = cycleWeek()) {
  const a = S.training && S.training.mgAdj && S.training.mgAdj[mg];
  if (!a || !a.v || cw.index === 4 || cw.early) return 0;
  return a.c === cw.c ? a.v : 0;
}
/**
 * fb = { pump: 'wenig'|'gut'|'stark', work: 'leicht'|'passt'|'viel', joint: 'gut'|'zwickt'|'schmerz' }
 * sore = Muskelkater-Stufe des Muskels von heute ('leicht'|'stark'|undefined)
 * → +1 (mehr Sätze), 0, -1 (weniger)
 */
export function fbDelta(fb, sore) {
  if (!fb) return 0;
  let s = 0;
  if (fb.work === 'leicht') s += 1;
  if (fb.work === 'viel') s -= 1.5;
  if (fb.pump === 'wenig') s += 0.5;
  if (fb.pump === 'stark') s -= 0.25;
  if (fb.joint === 'schmerz') s -= 1;
  if (sore === 'stark') s -= 1;
  else if (!sore) s += 0.5;
  return s >= 1 ? 1 : s <= -1 ? -1 : 0;
}
/** Nach dem Training: Feedback aller Muskeln verrechnen. Rückgabe: Liste der Änderungen für die Zusammenfassung */
export function applyFeedback(items, sore = {}) {
  const cw = cycleWeek();
  if (cw.index === 4 || cw.early) return [];
  const cur = { ...((S.training && S.training.mgAdj) || {}) };
  const out = [];
  const seen = new Set();
  for (const it of items) {
    if (!it.fb || !it.fb.done) continue;
    const mg = priMg(it.exId);
    if (!mg || seen.has(mg)) continue;
    seen.add(mg);
    const d = fbDelta(it.fb, sore[mg]);
    const old = mgAdjOf(mg, cw);
    const v = Math.max(-1, Math.min(2, old + d));
    if (v !== old) {
      cur[mg] = { v, c: cw.c };
      out.push({ mg, label: MUSCLE_LABEL[mg], v, d, joint: it.fb.joint === 'schmerz' ? it.name : null });
    } else if (it.fb.joint === 'schmerz') out.push({ mg, label: MUSCLE_LABEL[mg], v, d: 0, joint: it.name });
  }
  if (out.some((o) => o.d)) saveTraining({ mgAdj: cur });
  return out;
}

// ---------- Zyklus-Rückblick (am Ende eines 5-Wochen-Zyklus): Bilanz + gezielte Vorschläge statt neuem Plan ----------
/** Schlüssel des Zyklus, für den jetzt ein Rückblick ansteht (Deload-Woche oder erste Woche danach), sonst null */
export function reviewDue(k = todayKey()) {
  const cw = cycleWeek(k);
  if (cw.off || !workoutLog().length) return null;
  const key = cw.index === 4 ? (cw.early ? 'e' + weekStart(k) : 'c' + cw.c) : cw.index === 0 && cw.c > 0 ? 'c' + (cw.c - 1) : null;
  if (!key) return null;
  return S.training && S.training.reviewDone === key ? null : key;
}

export function cycleReview(k = todayKey()) {
  const setup = setupOf();
  const from = addDays(k, -35);
  const log = workoutLog().filter((w) => w.date >= from && w.date <= k && (w.items || []).length && !isAwaySession(w.sessionId));
  const chron = log.slice().reverse();
  const rot = [...new Set(rotationOf(setup))];
  const inPlan = {};
  rot.forEach((sid) => planIds(sid, setup).forEach((id) => (inPlan[id] = inPlan[id] || sid)));
  const allPlan = Object.keys(inPlan);
  // Übungen: erstes vs. letztes Arbeitsgewicht/Wdh. im Zeitraum
  const exs = [];
  for (const id of allPlan) {
    const ex = EXERCISES[id];
    if (!ex) continue;
    const pts = chron
      .map((w) => (w.items || []).find((it) => it.exId === id))
      .filter((it) => it && it.sets && it.sets.some((s) => s.r > 0))
      .map((it) => {
        const w = workW(it.sets);
        const top = it.sets.filter((s) => (s.w || 0) === w);
        return { w, r: top.reduce((a, s) => a + s.r, 0) / top.length, fb: it.fb };
      });
    const sess = chron.filter((w) => w.sessionId === inPlan[id]).length;
    const a = pts[0];
    const z = pts[pts.length - 1];
    exs.push({
      id,
      name: ex.name,
      sid: inPlan[id],
      n: pts.length,
      sess,
      dW: a && z ? Math.round((z.w - a.w) * 100) / 100 : 0,
      dR: a && z && z.w === a.w ? Math.round((z.r - a.r) * 10) / 10 : 0,
      lastW: z ? z.w : null,
      stalled: !!stallInfo(id),
      joint: pts.filter((p) => p.fb && (p.fb.joint === 'schmerz' || p.fb.joint === 'zwickt')).length,
      skipped: sess >= 3 && pts.length <= sess / 2,
      unit: ex.unit,
      weighted: ex.inc > 0,
    });
  }
  // Muskeln: Ø Sätze pro Trainingswoche gegen Zielbereich
  const weeks = [...new Set(log.map((w) => weekStart(w.date)))];
  const mus = [];
  if (weeks.length) {
    const sum = {};
    weeks.forEach((ws) => Object.entries(setsPerMuscle(ws)).forEach(([g, v]) => (sum[g] = (sum[g] || 0) + v)));
    for (const g of Object.keys(sum)) {
      const avg = sum[g] / weeks.length;
      const t = volTarget(g, setup);
      mus.push({ g, label: MUSCLE_LABEL[g], avg: Math.round(avg * 10) / 10, t, low: avg < t[0] - 0.5, high: avg > t[1] + 1 });
    }
  }
  // Vorschläge
  const sug = [];
  const taken = allPlan.slice();
  for (const e of exs) {
    const why = e.joint >= 2 ? `Gelenke haben ${e.joint}× gezwickt` : e.stalled ? 'seit 4 Einheiten kein Fortschritt' : e.skipped ? `oft ausgelassen (${e.n} von ${e.sess} Einheiten)` : null;
    if (!why) continue;
    const alt = substitute(e.id, setup, { taken });
    if (!alt) continue;
    taken.push(alt.id);
    sug.push({ id: 'swap:' + e.id, kind: 'swap', sid: e.sid, from: e.id, to: alt.id, title: `${e.name} → ${alt.name}`, why: `${why} – ${e.joint >= 2 ? 'eine gelenkschonendere Variante für denselben Muskel.' : e.stalled ? 'eine Variante setzt einen neuen Reiz, der Muskel bleibt derselbe.' : 'vielleicht liegt dir diese Variante für denselben Muskel mehr.'}`, on: e.joint >= 2 || e.stalled });
  }
  for (const m of mus.filter((x) => x.low)) {
    const cand = exs.filter((e) => priMg(e.id) === m.g && e.n > 0 && !sug.some((s) => s.from === e.id));
    const e = cand.sort((a, b) => b.n - a.n)[0];
    if (!e) continue;
    const ex = EXERCISES[e.id];
    const cur = (S.training.exOpts && S.training.exOpts[e.id] && S.training.exOpts[e.id].sets) || (ex.main && setup.experience === 'erfahren' ? 4 : setup.experience === 'anfaenger' && !ex.main ? 2 : 3);
    if (cur >= 5) continue;
    sug.push({ id: 'sets:' + e.id, kind: 'sets', ex: e.id, n: cur + 1, title: `${m.label}: ${e.name} mit ${cur + 1} statt ${cur} Sätzen`, why: `Ø ${String(m.avg).replace('.', ',')} Sätze pro Woche – Ziel sind ${m.t[0]}–${m.t[1]}.`, on: true });
  }
  const planned = (Number(setup.perWeek) || 3) * Math.max(1, Math.min(5, weeks.length || 1));
  return {
    sessions: log.length,
    planned,
    weeks: weeks.length,
    up: exs.filter((e) => e.n >= 2 && (e.dW > 0 || e.dR >= 1)).sort((a, b) => b.dW - a.dW || b.dR - a.dR),
    flat: exs.filter((e) => e.n >= 3 && e.dW <= 0 && e.dR < 1),
    mus: mus.filter((m) => m.low || m.high),
    sug,
  };
}

/** Ausgewählte Vorschläge übernehmen und Rückblick als erledigt merken */
export function applyReview(sugs, extra = {}, key = null) {
  const tr = S.training || {};
  const custom = { ...(tr.custom || {}) };
  const exOpts = { ...(tr.exOpts || {}) };
  for (const s of sugs) {
    if (s.kind === 'swap') {
      // in allen Einheiten tauschen, in denen die Übung vorkommt
      [...new Set(rotationOf())].forEach((sid) => {
        const ids = planIds(sid);
        if (ids.includes(s.from)) custom[sid] = ids.map((x) => (x === s.from ? s.to : x)).filter((x, i, a) => a.indexOf(x) === i);
      });
    } else if (s.kind === 'sets') exOpts[s.ex] = { ...(exOpts[s.ex] || {}), sets: s.n };
  }
  const patch = { custom, exOpts, ...(key ? { reviewDone: key } : {}) };
  if (extra.setup) patch.setup = { ...setupOf(), ...extra.setup };
  saveTraining(patch);
}
