// Globaler Zustand + Datenzugriff (Firebase oder lokal auf dem Gerät)
import { useEffect, useState } from 'preact/hooks';
import { addDays, todayKey, uid, lsGet, lsSet, weekStart } from './util.js';
import { daySums } from './nutrition.js';

const listeners = new Set();
export let S = {
  auth: { status: 'loading' }, // loading | out | in
  mode: null, // cloud | local
  profile: null,
  profileLoaded: false,
  ai: null,
  days: {},
  foods: {},
  weeks: {},
  toast: null,
  sheet: null,
};

export function setS(patch) {
  const p = typeof patch === 'function' ? patch(S) : patch;
  S = { ...S, ...p };
  listeners.forEach((l) => l());
}

export function useS() {
  const [, force] = useState(0);
  const seen = S;
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    // Zustand hat sich zwischen Rendern und Abonnieren geändert → neu zeichnen
    if (S !== seen) l();
    return () => listeners.delete(l);
  }, []);
  return S;
}

// ---------- Toast & Sheets ----------
let toastTimer;
export function toast(text, kind = 'ok') {
  clearTimeout(toastTimer);
  setS({ toast: { text, kind, id: Date.now() } });
  toastTimer = setTimeout(() => setS({ toast: null }), kind === 'error' ? 4200 : 2400);
}
export const openSheet = (name, props = {}) => setS({ sheet: { name, props, id: Date.now() } });
export const closeSheet = () => setS({ sheet: null });

// ---------- Backends ----------
let backend = null;
export const getBackend = () => backend;

function localBackend() {
  const KEY = 'tf.local.v1';
  let db = {};
  try {
    db = JSON.parse(lsGet(KEY, '{}')) || {};
  } catch (e) {
    db = {};
  }
  const subs = new Set();
  const save = () => lsSet(KEY, JSON.stringify(db));
  const colOf = (c) =>
    Object.keys(db)
      .filter((k) => k.startsWith(c + '/'))
      .map((k) => ({ id: k.slice(c.length + 1), ...db[k] }));
  const fire = (s) => {
    if (s.type === 'doc') s.cb(db[s.path] ? { ...db[s.path] } : null, { fromCache: false });
    else s.cb(colOf(s.path).filter((d) => !s.since || d.id >= s.since));
  };
  const emit = (path) => subs.forEach((s) => (s.type === 'doc' ? s.path === path : path.startsWith(s.path + '/')) && fire(s));
  return {
    mode: 'local',
    watchDoc(path, cb) {
      const s = { type: 'doc', path, cb };
      subs.add(s);
      setTimeout(() => fire(s), 0);
      return () => subs.delete(s);
    },
    watchCol(path, cb, since) {
      const s = { type: 'col', path, cb, since };
      subs.add(s);
      setTimeout(() => fire(s), 0);
      return () => subs.delete(s);
    },
    set(path, data, merge = true) {
      db[path] = merge ? { ...(db[path] || {}), ...data } : { ...data };
      save();
      emit(path);
    },
    del(path) {
      delete db[path];
      save();
      emit(path);
    },
    dump: () => db,
  };
}

let unsubs = [];
function stopWatching() {
  unsubs.forEach((u) => {
    try {
      u();
    } catch (e) {}
  });
  unsubs = [];
}

function startWatching() {
  stopWatching();
  const b = backend;
  setS({ profile: null, profileLoaded: false, ai: null, days: {}, foods: {}, weeks: {} });
  const fallback = setTimeout(() => !S.profileLoaded && setS({ profileLoaded: true }), 7000);
  unsubs.push(() => clearTimeout(fallback));
  unsubs.push(
    b.watchDoc('tf_meta/profile', (data, meta) => {
      if (!data && meta && meta.fromCache) return; // auf Server warten
      setS({ profile: data, profileLoaded: true });
    }),
  );
  unsubs.push(b.watchDoc('tf_meta/ai', (data) => setS({ ai: data })));
  unsubs.push(
    b.watchCol('tf_foods', (list) => {
      const foods = {};
      list.forEach((f) => (foods[f.id] = f));
      setS({ foods });
    }),
  );
  unsubs.push(
    b.watchCol(
      'tf_days',
      (list) => {
        const days = {};
        list.forEach((d) => (days[d.id] = d));
        setS({ days });
      },
      addDays(todayKey(), -120),
    ),
  );
  unsubs.push(
    b.watchCol('tf_weeks', (list) => {
      const weeks = {};
      list.forEach((w) => (weeks[w.id] = w));
      setS({ weeks });
    }),
  );
}

export async function boot() {
  const cfg = window.TAGESFORM_CONFIG;
  const mode = lsGet('tf.mode') || (cfg && cfg.apiKey ? 'cloud' : 'local');
  if (mode === 'local') return useLocal(false);
  try {
    const fb = await import('./firebase.js');
    fb.init(cfg);
    fb.onAuth((user) => {
      if (user) {
        backend = fb.cloudBackend(user.uid, (err) => toast(fb.errText(err), 'error'));
        setS({ mode: 'cloud', auth: { status: 'in', user: { uid: user.uid, email: user.email } } });
        startWatching();
      } else {
        stopWatching();
        backend = null;
        setS({ mode: 'cloud', auth: { status: 'out' }, profile: null, profileLoaded: false });
      }
    });
  } catch (e) {
    console.error(e);
    setS({ mode: 'cloud', auth: { status: 'out', error: 'Firebase konnte nicht geladen werden. Bist du online?' } });
  }
}

export function useLocal(remember = true) {
  if (remember) lsSet('tf.mode', 'local');
  backend = localBackend();
  setS({ mode: 'local', auth: { status: 'in', user: { uid: 'local', email: null } } });
  startWatching();
}

export async function leaveLocal() {
  lsSet('tf.mode', null);
  location.reload();
}

export async function logout() {
  if (S.mode === 'local') return leaveLocal();
  const fb = await import('./firebase.js');
  await fb.logout();
}

// ---------- Schreiben ----------
export const saveProfile = (data) => backend.set('tf_meta/profile', { ...data, updatedAt: Date.now() });
export const saveAi = (data) => backend.set('tf_meta/ai', { ...data, updatedAt: Date.now() });
export const saveWeek = (id, data) => backend.set('tf_weeks/' + id, { ...data, updatedAt: Date.now() });

export const getDay = (k) => S.days[k] || { entries: [] };

export function patchDay(k, patch) {
  const cur = getDay(k);
  const next = typeof patch === 'function' ? patch(cur) : patch;
  // sofort lokal anzeigen, dann speichern
  setS({ days: { ...S.days, [k]: { ...cur, ...next, id: k } } });
  const { id, ...data } = { ...cur, ...next };
  backend.set('tf_days/' + k, { ...data, updatedAt: Date.now() });
}

export function addEntries(k, entries) {
  patchDay(k, (d) => ({ entries: [...(d.entries || []), ...entries.map((e) => ({ ...e, id: e.id || uid() }))] }));
}
export function updateEntry(k, id, patch) {
  patchDay(k, (d) => ({ entries: (d.entries || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}
export function removeEntry(k, id) {
  patchDay(k, (d) => ({ entries: (d.entries || []).filter((e) => e.id !== id) }));
}

/** Lebensmittel merken (für „Zuletzt“, eigene Produkte, Meine Portionen) */
export function rememberFood(food, grams) {
  if (!food) return null;
  const id = String(food.id || 'custom:' + uid()).replace(/\//g, '_');
  const prev = S.foods[id] || {};
  const doc = {
    name: food.name,
    brand: food.brand || '',
    barcode: food.barcode || prev.barcode || null,
    per100: food.per100,
    portions: prev.portions || food.portions || [],
    myPortions: prev.myPortions || [],
    unit: food.unit || 'g',
    fv: !!food.fv,
    source: food.source || prev.source || 'custom',
    uses: (prev.uses || 0) + (grams ? 1 : 0),
    lastUsed: grams ? Date.now() : prev.lastUsed || Date.now(),
    lastGrams: grams ? Math.round(grams) : prev.lastGrams || null,
  };
  setS({ foods: { ...S.foods, [id]: { ...doc, id } } });
  backend.set('tf_foods/' + id, doc);
  return { ...doc, id };
}

export function saveMyPortion(food, label, g) {
  const f = rememberFood(food, 0);
  const myPortions = [...(f.myPortions || []).filter((p) => p.label !== label), { label, g: Math.round(g) }];
  setS({ foods: { ...S.foods, [f.id]: { ...f, myPortions } } });
  backend.set('tf_foods/' + f.id, { myPortions });
}

export function deleteFood(id) {
  const foods = { ...S.foods };
  delete foods[id];
  setS({ foods });
  backend.del('tf_foods/' + id);
}

// ---------- Abfragen ----------
export const daysOfWeek = (startKey) => Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

export function recentFoods(limit = 30) {
  return Object.values(S.foods)
    .filter((f) => f.uses > 0)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, limit);
}
export function frequentFoods(limit = 25) {
  return Object.values(S.foods)
    .filter((f) => f.uses > 0)
    .sort((a, b) => (b.uses || 0) - (a.uses || 0))
    .slice(0, limit);
}

export function lastNDaysSums(n = 7, endKey = todayKey()) {
  return Array.from({ length: n }, (_, i) => {
    const k = addDays(endKey, -i);
    return { key: k, ...daySums(S.days[k]) };
  });
}

export const currentWeekStart = () => weekStart(todayKey());

export function exportAll() {
  return { exportedAt: new Date().toISOString(), profile: S.profile, foods: S.foods, days: S.days, weeks: S.weeks };
}
