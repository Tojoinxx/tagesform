// Trainingsplan-Logik: Wochenrhythmus um Handball, Anpassung an Tagesform & Schmerzen, Progression
import { S, getDay } from './store.js';
import { EXERCISES, SESSIONS, ROTATIONS } from './exercises.js';
import { addDays, parseKey, todayKey, weekStart, WD_SHORT, WD_LONG } from './util.js';

export const EXPERIENCE = [
  { id: 'anfaenger', label: 'Einsteiger', hint: 'unter 1 Jahr regelmäßig' },
  { id: 'fortgeschritten', label: 'Fortgeschritten', hint: '1–3 Jahre' },
  { id: 'erfahren', label: 'Erfahren', hint: 'über 3 Jahre' },
];

export const defaultSetup = () => ({ experience: 'fortgeschritten', perWeek: 3, minutes: 60, handballDays: [1, 3], gameDay: null });
export const setupOf = () => ({ ...defaultSetup(), ...((S.training && S.training.setup) || {}) });

const exCount = (minutes) => (minutes <= 45 ? 5 : minutes >= 75 ? 7 : 6);

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
  for (const w of workoutLog()) {
    if (before && w.date >= before) continue;
    const it = (w.items || []).find((i) => i.exId === exId);
    const sets = it && (it.sets || []).filter((s) => s.done && s.r > 0);
    if (sets && sets.length) return { date: w.date, sets };
  }
  return null;
}

const roundTo = (v, step) => (step > 0 ? Math.round(v / step) * step : v);

/** Doppelte Progression: erst Wiederholungen hoch, dann Gewicht */
export function progression(ex, last) {
  const [lo, hi] = ex.reps;
  if (!last) return { w: null, reps: lo, note: 'Erstes Mal: Gewicht wählen, bei dem noch 2 Wdh. im Tank wären.' };
  const ws = last.sets.map((s) => s.w || 0);
  const w = Math.max(...ws);
  const top = last.sets.filter((s) => (s.w || 0) === w);
  const minR = Math.min(...top.map((s) => s.r));
  const maxR = Math.max(...top.map((s) => s.r));
  if (ex.inc === 0) {
    if (minR >= hi) return { w, reps: hi, note: `Oberes Ziel erreicht – mach es schwerer${ex.unit === 'Sek.' ? ' oder länger' : ' (langsamer, mit Gewicht)'}.`, up: true };
    const step = ex.unit === 'Sek.' ? 5 : 1;
    return { w, reps: Math.min(hi, minR + step), note: `Letztes Mal ${minR} ${ex.unit} – heute ${Math.min(hi, minR + step)}.` };
  }
  if (minR >= hi) return { w: roundTo(w + ex.inc, ex.inc / 2 || 0.5), reps: lo, note: `Alle Sätze mit ${hi} Wdh. geschafft → +${String(ex.inc).replace('.', ',')} kg 💪`, up: true };
  if (maxR < lo) return { w: roundTo(w * 0.9, ex.inc / 2 || 0.5), reps: lo, note: 'Letztes Mal zu schwer – heute etwas leichter, saubere Technik.' };
  return { w, reps: Math.min(hi, minR + 1), note: `Gleiches Gewicht, Ziel: ${Math.min(hi, minR + 1)} Wdh. pro Satz.` };
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

/** Einheit für heute zusammenbauen */
export function buildSession(sessionId, setup = setupOf(), form = getDay(todayKey()).form) {
  const tpl = SESSIONS[sessionId];
  const fm = formMode(form);
  const painAreas = fm.pains.map((p) => p.area);
  const strongPain = fm.pains.filter((p) => p.level >= 7).map((p) => p.area);
  let ids = tpl.ex.slice();
  if (setup.experience === 'anfaenger') ids = ids.map((id) => (id === 'kniebeuge' ? 'goblet' : id === 'rdl' ? 'hip-thrust' : id === 'klimmzug-assist' ? 'latzug' : id));
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
  const count = exCount(setup.minutes);
  const chosen = items.slice(0, count);
  const out = chosen.map(({ ex, adaptedFrom }) => {
    const last = lastFor(ex.id);
    const pr = progression(ex, last);
    let sets = ex.main ? (setup.experience === 'erfahren' ? 4 : 3) : setup.experience === 'anfaenger' ? 2 : 3;
    let w = pr.w;
    let reps = pr.reps;
    let note = pr.note;
    if (fm.mode === 'light') {
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
    if (adaptedFrom && adaptedFrom.keep) note = `Achtung ${adaptedFrom.why}: nur schmerzfrei, eher leichter.`;
    return {
      exId: ex.id,
      name: ex.name,
      equip: ex.equip,
      unit: ex.unit,
      cue: ex.cue,
      main: !!ex.main,
      repRange: ex.reps,
      inc: ex.inc,
      target: { w, reps },
      sets: Array.from({ length: sets }, () => ({ w: w ?? '', r: '', done: false })),
      last,
      note,
      adaptedFrom: adaptedFrom && !adaptedFrom.keep ? adaptedFrom : null,
    };
  });
  return { sessionId, name: tpl.name, focus: tpl.focus, items: out, mode: fm.mode, modeLabel: fm.label, notes, pains: fm.pains };
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
  const ex = EXERCISES[exId];
  const last = lastFor(ex.id);
  const pr = progression(ex, last);
  const sets = ex.main ? 3 : setup.experience === 'anfaenger' ? 2 : 3;
  return { exId: ex.id, name: ex.name, equip: ex.equip, unit: ex.unit, cue: ex.cue, main: !!ex.main, repRange: ex.reps, inc: ex.inc, target: { w: pr.w, reps: pr.reps }, sets: Array.from({ length: sets }, () => ({ w: pr.w ?? '', r: '', done: false })), last, note: pr.note, adaptedFrom: null };
}

// ---------- Wochenrhythmus ----------
const isHB = (setup, d) => (setup.handballDays || []).includes(d) || setup.gameDay === d;

/** Empfohlene Gym-Tage: bewertet alle Kombinationen und nimmt die beste
 *  (keine Beine vor Handball/Spiel, max. 2 Gym-Tage unter der Woche, Wochenende nutzen, Pausen dazwischen) */
export function weekPlan(setup = setupOf()) {
  const rot = ROTATIONS[setup.perWeek] || ROTATIONS[3];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const free = order.filter((d) => !isHB(setup, d));
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
  const legs = (sid) => SESSIONS[sid].legs;
  let best = null;
  for (const days of combos) {
    for (const ses of perms) {
      let sc = 0;
      const plan = days.map((d, i) => ({ d, sessionId: ses[i] }));
      const wk = plan.filter((p) => p.d >= 1 && p.d <= 5).length;
      if (wk > 2) sc += 8 * (wk - 2);
      [6, 0].forEach((d) => !isHB(setup, d) && !days.includes(d) && (sc += 3));
      plan.forEach((p, i) => {
        const L = legs(p.sessionId);
        if (L && isHB(setup, (p.d + 1) % 7)) sc += 100;
        if (L && isHB(setup, (p.d + 6) % 7)) sc += 3;
        if (!L && isHB(setup, (p.d + 1) % 7)) sc += 1;
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
  const plan = best.plan.filter((p) => !(legs(p.sessionId) && isHB(setup, (p.d + 1) % 7)));
  plan.dropped = best.plan.filter((p) => !plan.includes(p)).map((p) => p.sessionId);
  return plan;
}

export const dayName = (d) => WD_LONG[d];
export const dayShort = (d) => WD_SHORT[d];

/** Was steht heute an? Folgt dem Wochenrhythmus, holt verpasste Einheiten nach */
export function recommend(setup = setupOf(), k = todayKey()) {
  const d = parseKey(k).getDay();
  const rot = ROTATIONS[setup.perWeek] || ROTATIONS[3];
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
  const tomorrowHB = isHB(setup, (d + 1) % 7);
  const legsSore = form && form.soreness === 'stark';
  const legPain = form && (form.pains || []).some((p) => ['Knie', 'Oberschenkel', 'Wade', 'Sprunggelenk', 'Hüfte'].includes(p.area) && p.level >= 5);
  const legsBlocked = tomorrowHB || legsSore || legPain;
  const reasons = [];
  const planned = plan.find((p) => p.d === d);
  // Reihenfolge der offenen Einheiten wie im Wochenplan
  const planOrder = plan.map((p) => p.sessionId);
  left.sort((a, b) => planOrder.indexOf(a) - planOrder.indexOf(b));
  let sessionId;
  if (planned && left.includes(planned.sessionId) && !(SESSIONS[planned.sessionId].legs && legsBlocked)) sessionId = planned.sessionId;
  else sessionId = left.find((s) => !(SESSIONS[s].legs && legsBlocked));
  if (!sessionId && left.length) {
    sessionId = rot.find((s) => !SESSIONS[s].legs) || left[0];
    reasons.push(tomorrowHB ? `Offen wäre noch ${SESSIONS[left[0]].name} – aber morgen ${setup.gameDay === (d + 1) % 7 ? 'Spiel' : 'Handball'}. Heute lieber Oberkörper, Beine an einem anderen Tag.` : 'Beine sind heute angeschlagen – Oberkörper geht vor.');
  } else if (planned && sessionId !== planned.sessionId && left.includes(planned.sessionId)) {
    reasons.push(tomorrowHB ? `Morgen ${setup.gameDay === (d + 1) % 7 ? 'Spiel' : 'Handball'} – Beine lieber an einem anderen Tag.` : 'Beine sind heute angeschlagen – Oberkörper geht vor.');
  } else if (!planned && sessionId && left.length) {
    reasons.push('Kein fester Gym-Tag – aber passt gut, wenn du Zeit hast.');
  }
  if (!sessionId) {
    const lastSession = log.find((w) => rot.includes(w.sessionId));
    sessionId = rot[lastSession ? (rot.indexOf(lastSession.sessionId) + 1) % rot.length : 0];
    if (SESSIONS[sessionId].legs && legsBlocked) sessionId = rot.find((s) => !SESSIONS[s].legs) || sessionId;
  }
  let status = 'train';
  if (doneToday.length) status = 'done';
  else if (isHB(setup, d)) status = 'handball';
  else if (!left.length) status = 'goal';
  else if (!planned) status = 'free';
  return { sessionId, status, reasons, doneThisWeek: doneThisWeek.length, perWeek: plan.length, planned: !!planned, rot, doneToday: doneToday[0] || null, left };
}
