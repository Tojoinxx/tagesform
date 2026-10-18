// Formcheck: Fotos, Gewicht, Körperfett & Maße in festen Abständen – mit Auswertung und Vorschlägen für Plan & Ernährung
import { S, getBackend, saveProfile, saveTraining } from './store.js';
import { setupOf, FOCUS } from './training.js';
import { addDays, parseKey, todayKey, num } from './util.js';
import { idbGet, idbSet, idbDel } from './localpics.js';

export const POSES = [
  { id: 'vorne', label: 'Vorne', hint: 'Gerade, Arme locker neben dem Körper' },
  { id: 'seite', label: 'Seite', hint: 'Seitlich, entspannt – nicht einziehen' },
  { id: 'hinten', label: 'Hinten', hint: 'Rücken zur Kamera, Arme locker' },
];
export const MEASURES = [
  { id: 'waist', label: 'Bauch', hint: 'auf Bauchnabelhöhe, entspannt ausatmen' },
  { id: 'neck', label: 'Hals', hint: 'unterhalb vom Kehlkopf' },
  { id: 'hip', label: 'Hüfte', hint: 'breiteste Stelle am Po' },
  { id: 'chest', label: 'Brust', hint: 'auf Brustwarzenhöhe' },
  { id: 'arm', label: 'Oberarm', hint: 'dickste Stelle, locker hängend' },
  { id: 'thigh', label: 'Oberschenkel', hint: 'dickste Stelle' },
];
export const INTERVALS = [
  { id: 2, label: 'alle 2 Wochen' },
  { id: 4, label: 'alle 4 Wochen' },
  { id: 6, label: 'alle 6 Wochen' },
  { id: 0, label: 'keine Erinnerung' },
];

// ---------- Speichern & Laden ----------
export const checkList = () =>
  Object.values(S.checks || {})
    .filter((c) => c && c.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // neueste zuerst
export const lastCheck = () => checkList()[0] || null;
export const prevCheckOf = (date) => checkList().find((c) => c.date < date) || null;

export function saveCheck(date, data) {
  getBackend().set('tf_checks/' + date, { ...data, date, updatedAt: Date.now() });
  // aktuellster Check → Profilwerte (Körperfett für den Grundumsatz, Gewicht)
  const newest = checkList()[0];
  if (!newest || date >= newest.date) {
    const p = {};
    if (data.bf > 3 && data.bf < 60) p.bodyFat = Math.round(data.bf * 10) / 10;
    if (data.weight > 30) p.weightKg = data.weight;
    if (Object.keys(p).length) saveProfile({ ...S.profile, ...p });
  }
}
export function deleteCheck(c) {
  const b = getBackend();
  (c.poses || []).forEach((pose) => delPic(c.date, pose));
  b.del('tf_checks/' + c.date);
}

// Fotos: standardmäßig NUR auf diesem Gerät (IndexedDB). Im Konto nur, wenn ausdrücklich eingeschaltet.
export const picsInCloud = (p = S.profile || {}) => p.picsCloud === true;
const uidOf = () => (S.auth && S.auth.user && S.auth.user.uid) || 'local';
const localKey = (date, pose) => `${uidOf()}/${date}_${pose}`;
const picCache = new Map();

export function savePic(date, pose, dataUrl) {
  picCache.set(`${date}_${pose}`, dataUrl);
  if (picsInCloud()) {
    getBackend().set(`tf_checkpics/${date}_${pose}`, { img: dataUrl, at: Date.now() }, false);
    idbDel(localKey(date, pose));
  } else {
    idbSet(localKey(date, pose), dataUrl);
    getBackend().del(`tf_checkpics/${date}_${pose}`); // evtl. alte Kopie im Konto entfernen
  }
}
export function delPic(date, pose) {
  picCache.delete(`${date}_${pose}`);
  idbDel(localKey(date, pose));
  getBackend().del(`tf_checkpics/${date}_${pose}`);
}

function cloudPic(key) {
  return new Promise((res) => {
    let done = false;
    let un = null;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      setTimeout(() => un && un(), 0);
      res(v || null);
    };
    const t = setTimeout(() => finish(null), 12000);
    un = getBackend().watchDoc('tf_checkpics/' + key, (d, meta) => {
      if (!d && meta && meta.fromCache) return;
      finish(d && d.img);
    });
  });
}

/** Foto laden: erst vom Gerät, sonst aus dem Konto (und dann – wenn „nur Gerät“ eingestellt – aufs Gerät holen und im Konto löschen) */
export async function loadPic(date, pose) {
  const key = `${date}_${pose}`;
  if (picCache.has(key)) return picCache.get(key);
  let img = await idbGet(localKey(date, pose));
  if (!img) {
    const c = (S.checks || {})[date];
    if (!c || c.picsAt !== 'device' || picsInCloud()) img = await cloudPic(key);
    if (img && !picsInCloud()) {
      await idbSet(localKey(date, pose), img);
      getBackend().del('tf_checkpics/' + key);
    }
  }
  if (img) picCache.set(key, img);
  return img || null;
}

/** Speicherort umstellen: alle Fotos ins Konto bzw. aufs Gerät verschieben */
export async function movePics(toCloud) {
  saveProfile({ ...S.profile, picsCloud: !!toCloud });
  let n = 0;
  for (const c of checkList()) {
    for (const pose of c.poses || []) {
      const key = `${c.date}_${pose}`;
      const img = (await idbGet(localKey(c.date, pose))) || (await cloudPic(key));
      if (!img) continue;
      if (toCloud) {
        getBackend().set('tf_checkpics/' + key, { img, at: Date.now() }, false);
        await idbDel(localKey(c.date, pose));
      } else {
        await idbSet(localKey(c.date, pose), img);
        getBackend().del('tf_checkpics/' + key);
      }
      n++;
    }
    getBackend().set('tf_checks/' + c.date, { picsAt: toCloud ? 'cloud' : 'device' });
  }
  return n;
}

// ---------- Fällig? ----------
export const intervalOf = (p = S.profile || {}) => (p.checkEvery == null ? 4 : Number(p.checkEvery));
export function checkDue(k = todayKey()) {
  const every = intervalOf();
  const last = lastCheck();
  if (!last) return { first: true, due: false, every };
  const days = Math.round((parseKey(k) - parseKey(last.date)) / 864e5);
  const next = every ? addDays(last.date, every * 7) : null;
  return { first: false, every, days, next, due: !!every && days >= every * 7, last };
}

// ---------- Körperfett ----------
/** US-Navy-Formel (cm). Männer: Bauch & Hals, Frauen zusätzlich Hüfte */
export function navyBf({ sex, height, waist, neck, hip }) {
  const h = num(height);
  const w = num(waist);
  const n = num(neck);
  if (!(h > 120 && w > 40 && n > 20)) return null;
  let bf;
  if (sex === 'w') {
    const hp = num(hip);
    if (!(hp > 50) || w + hp - n <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hp - n) + 0.221 * Math.log10(h)) - 450;
  } else {
    if (w - n <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  }
  return bf > 2 && bf < 60 ? Math.round(bf * 10) / 10 : null;
}

/** Einordnung (grob, nach gängigen Tabellen) */
export function bfLevel(bf, sex) {
  if (!(bf > 0)) return null;
  const w = sex === 'w';
  const t = w ? [14, 21, 25, 32] : [6, 14, 18, 25];
  const labels = ['Sehr niedrig', 'Athletisch', 'Fit', 'Durchschnitt', 'Erhöht'];
  const i = t.findIndex((x) => bf < x);
  return labels[i < 0 ? 4 : i];
}

/** Gewicht für den Check: eingetragen, sonst letzte Wiegung der letzten 7 Tage */
export function recentWeight(k = todayKey()) {
  for (let i = 0; i < 7; i++) {
    const d = S.days[addDays(k, -i)];
    if (d && d.weight) return d.weight;
  }
  return null;
}

// ---------- Auswertung ----------
const r1 = (v) => Math.round(v * 10) / 10;
const de = (v) => String(v).replace('.', ',');

/**
 * Vergleicht zwei Checks und leitet Vorschläge ab.
 * Rückgabe: { stats, verdict: {tone, title, text}, recos: [{ id, title, text, apply }] }
 * apply: { kind: 'kcal'|'goal'|'focus'|'cardio', ... } – wird erst nach Tipp übernommen
 */
export function evalCheck(cur, prev, profile = S.profile || {}, setup = setupOf()) {
  const sex = profile.sex;
  const goal = profile.goal || 'halten';
  const recos = [];
  const stats = {};
  const bf = cur.bf > 0 ? cur.bf : null;
  const lvl = bfLevel(bf, sex);
  if (bf && cur.weight) {
    stats.fatKg = r1((cur.weight * bf) / 100);
    stats.leanKg = r1(cur.weight - stats.fatKg);
  }
  // Körperfett-Niveau passt nicht zum Ziel → Ziel-Vorschlag
  const high = sex === 'w' ? 32 : 22;
  const low = sex === 'w' ? 20 : 11;
  if (bf && goal === 'aufbauen' && bf >= high)
    recos.push({ id: 'goal-recomp', title: 'Erst straffen, dann aufbauen', text: `Bei ca. ${Math.round(bf)} % Körperfett baust du effektiver auf, wenn du erst bei Kalorien „halten“ trainierst – Muskeln wachsen trotzdem, Fett geht langsam runter.`, apply: { kind: 'goal', goal: 'halten' } });
  if (bf && goal === 'abnehmen' && bf <= low)
    recos.push({ id: 'goal-hold', title: 'Abnehmen nicht mehr nötig', text: `Mit ca. ${Math.round(bf)} % bist du schon schlank. Weiter Defizit kostet eher Muskeln und Leistung – besser halten oder langsam aufbauen.`, apply: { kind: 'goal', goal: 'halten' } });

  if (!prev) {
    return {
      stats,
      first: true,
      verdict: { tone: 'ok', title: 'Startpunkt gespeichert 📸', text: `${lvl ? `Körperfett: ${lvl}. ` : ''}Beim nächsten Formcheck vergleiche ich Gewicht, Körperfett und Fotos und schlage dir Anpassungen vor.` },
      recos,
    };
  }

  const days = Math.max(1, Math.round((parseKey(cur.date) - parseKey(prev.date)) / 864e5));
  stats.days = days;
  const w0 = prev.weight;
  const w1 = cur.weight;
  if (w0 && w1) {
    stats.dW = r1(w1 - w0);
    stats.wPctMonth = r1(((w1 - w0) / w0) * 100 * (30 / days));
  }
  if (prev.bf > 0 && bf) {
    stats.dBf = r1(bf - prev.bf);
    if (w0 && w1) {
      const f0 = (w0 * prev.bf) / 100;
      const f1 = (w1 * bf) / 100;
      stats.dFat = r1(f1 - f0);
      stats.dLean = r1(w1 - f1 - (w0 - f0));
    }
  }
  if (prev.waist && cur.waist) stats.dWaist = r1(cur.waist - prev.waist);
  if (prev.arm && cur.arm) stats.dArm = r1(cur.arm - prev.arm);

  if (days < 14) {
    return { stats, verdict: { tone: 'ok', title: 'Noch zu früh für Schlüsse', text: `Nur ${days} Tage seit dem letzten Check – Gewicht schwankt durch Wasser & Essen um 1–2 kg. Ab ca. 3–4 Wochen sind Trends aussagekräftig.` }, recos };
  }

  const m = stats.wPctMonth;
  const kcal = (delta, title, text) => recos.push({ id: 'kcal', title, text, apply: { kind: 'kcal', delta } });
  let verdict;
  const leanUp = stats.dLean != null && stats.dLean > 0.2;
  const leanDown = stats.dLean != null && stats.dLean < -0.8;
  const waistDown = stats.dWaist != null && stats.dWaist <= -1;

  if (m == null) {
    verdict = { tone: 'ok', title: 'Fotos gespeichert', text: 'Trag beim nächsten Mal auch dein Gewicht ein – dann kann ich die Entwicklung genauer bewerten.' };
  } else if (goal === 'aufbauen') {
    if (m > 1.5 && (stats.dBf == null || stats.dBf >= 0.8)) {
      verdict = { tone: 'warn', title: 'Etwas zu schnell zugenommen', text: `+${de(m)} % Gewicht pro Monat – mehr als Muskeln wachsen können, der Rest ist eher Fett.` };
      kcal(-150, '150 kcal weniger pro Tag', 'Ziel beim Aufbau: ca. 0,5–1 % Körpergewicht pro Monat.');
    } else if (m < 0.25 && !leanUp) {
      verdict = { tone: 'warn', title: 'Gewicht bewegt sich kaum', text: `${m >= 0 ? '+' : ''}${de(m)} % pro Monat – für Muskelaufbau brauchst du einen kleinen Überschuss.` };
      kcal(150, '150 kcal mehr pro Tag', 'Z. B. ein Skyr mit Haferflocken extra. Ziel: ca. 0,5–1 % pro Monat zunehmen.');
    } else verdict = { tone: 'good', title: 'Aufbau läuft 💪', text: `${m >= 0 ? '+' : ''}${de(m)} % Gewicht pro Monat${leanUp ? `, davon ca. +${de(stats.dLean)} kg fettfreie Masse` : ''} – genau im Zielbereich.` };
  } else if (goal === 'abnehmen') {
    if (m > -1 && !waistDown) {
      verdict = { tone: 'warn', title: 'Es geht kaum runter', text: `${m >= 0 ? '+' : ''}${de(m)} % Gewicht pro Monat${stats.dWaist != null ? `, Bauch ${stats.dWaist >= 0 ? '+' : ''}${de(stats.dWaist)} cm` : ''}. Ziel sind ca. 2–4 % pro Monat.` };
      kcal(-150, '150 kcal weniger pro Tag', 'Kleiner Schritt reicht – z. B. Getränke ohne Zucker, Soße/Öl etwas sparsamer.');
      if (!(setup.cardio > 0)) recos.push({ id: 'cardio', title: '1× pro Woche locker laufen', text: 'Erscheint als freiwilliger Bonus an freien Tagen – zählt nicht als Pflicht.', apply: { kind: 'cardio', n: 1 } });
    } else if (m < -4.5 || leanDown) {
      verdict = { tone: 'warn', title: 'Etwas zu schnell', text: `${de(m)} % pro Monat${leanDown ? ` – dabei ca. ${de(stats.dLean)} kg fettfreie Masse verloren` : ''}. Zu schnelles Abnehmen kostet Muskeln.` };
      kcal(150, '150 kcal mehr pro Tag', 'Lieber etwas langsamer und dafür Muskeln & Kraft behalten. Eiweiß hoch halten.');
    } else verdict = { tone: 'good', title: 'Läuft genau richtig 🔥', text: `${de(m)} % Gewicht pro Monat${stats.dFat != null ? `, ca. ${de(stats.dFat)} kg Fett` : ''}${waistDown ? `, Bauch ${de(stats.dWaist)} cm` : ''}.` };
  } else {
    if (m > 1 || (stats.dBf != null && stats.dBf > 1)) {
      verdict = { tone: 'warn', title: 'Leicht zugelegt', text: `${m >= 0 ? '+' : ''}${de(m)} % Gewicht pro Monat${stats.dBf != null ? `, Körperfett ${stats.dBf >= 0 ? '+' : ''}${de(stats.dBf)} %-Punkte` : ''}.` };
      kcal(-100, '100 kcal weniger pro Tag', 'Kleine Korrektur, um das Gewicht stabil zu halten.');
    } else if (m < -1 && !(stats.dBf != null && stats.dBf < -0.5)) {
      verdict = { tone: 'warn', title: 'Leicht abgenommen', text: `${de(m)} % pro Monat – zum Halten etwas mehr essen.` };
      kcal(100, '100 kcal mehr pro Tag', 'Hält Gewicht und Leistung stabil.');
    } else verdict = { tone: 'good', title: 'Stabil 👍', text: `${m >= 0 ? '+' : ''}${de(m)} % Gewicht pro Monat${leanUp ? ` – und dabei ca. +${de(stats.dLean)} kg fettfreie Masse. Recomp läuft!` : ''}.` };
  }
  return { stats, verdict, recos };
}

/** Vorschläge der KI (Schwerpunkt-Muskeln) in Vorschläge umwandeln */
export function aiRecos(ai, setup = setupOf()) {
  if (!ai) return [];
  const ids = (ai.focus || []).filter((id) => FOCUS.some((f) => f.id === id)).slice(0, 2);
  const cur = setup.focus || [];
  const add = ids.filter((id) => !cur.includes(id));
  if (!add.length) return [];
  const names = add.map((id) => FOCUS.find((f) => f.id === id).label).join(' & ');
  return [{ id: 'focus', title: `Schwerpunkt: ${names}`, text: ai.focusWhy || 'Bekommt im Plan 1 Satz mehr und eine passende Zusatzübung.', apply: { kind: 'focus', ids: add } }];
}

/** Vorschlag übernehmen */
export function applyReco(r) {
  const a = r.apply;
  const p = S.profile || {};
  const st = setupOf();
  if (a.kind === 'kcal') {
    const v = Math.max(-500, Math.min(500, (Number(p.kcalAdjust) || 0) + a.delta));
    saveProfile({ ...p, kcalAdjust: v });
    return `Kalorienziel ${a.delta > 0 ? '+' : ''}${a.delta} kcal`;
  }
  if (a.kind === 'goal') {
    saveProfile({ ...p, goal: a.goal, kcalAdjust: 0 });
    return 'Ernährungsziel angepasst';
  }
  if (a.kind === 'focus') {
    const focus = [...new Set([...(st.focus || []), ...a.ids])].slice(-3);
    saveTraining({ setup: { ...st, focus } });
    return 'Schwerpunkt im Plan gesetzt';
  }
  if (a.kind === 'cardio') {
    saveTraining({ setup: { ...st, cardio: a.n } });
    return 'Laufen als Bonus eingeplant';
  }
  return 'Übernommen';
}
