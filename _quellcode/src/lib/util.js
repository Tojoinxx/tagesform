// Kleine Helfer: Datum, Zahlen, IDs

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const pad = (n) => String(n).padStart(2, '0');

/** Datum -> 'YYYY-MM-DD' in lokaler Zeit */
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const todayKey = () => dateKey(new Date());

/** Montag der Woche zu einem Datum-Key */
export const weekStart = (k) => {
  const d = parseKey(k);
  const wd = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - wd);
  return dateKey(d);
};
export const weekDays = (startKey) => Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

/** ISO-Kalenderwoche */
export const isoWeek = (k) => {
  const d = parseKey(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
};

export const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

export const fmtDayTitle = (k) => {
  const t = todayKey();
  if (k === t) return 'Heute';
  if (k === addDays(t, -1)) return 'Gestern';
  if (k === addDays(t, 1)) return 'Morgen';
  const d = parseKey(k);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};
export const fmtShortDate = (k) => {
  const d = parseKey(k);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};

const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export const n0 = (v) => nf0.format(Math.round(Number(v) || 0));
export const n1 = (v) => nf1.format(Math.round((Number(v) || 0) * 10) / 10);
export const liters = (ml) => nf1.format(Math.round((ml || 0) / 100) / 10).replace(/,0$/, '') + ' l';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const num = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(x) ? x : 0;
};

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const vibrate = (ms = 20) => {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch (e) {}
};

export const lsGet = (k, d = null) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
};
export const lsSet = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) {}
};

/** Bild verkleinern -> {base64, mime, dataUrl} */
export async function downscaleImage(file, max = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    return { dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const timeOfDayMeal = (d = new Date()) => {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m >= 240 && m < 630) return 'fruehstueck';
  if (m >= 630 && m < 870) return 'mittag';
  if (m >= 870 && m < 1050) return 'snacks';
  if (m >= 1050 && m < 1320) return 'abend';
  return 'snacks';
};
