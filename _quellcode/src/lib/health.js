// Apple Health über die Kurzbefehle-App: Web-Apps haben keinen direkten Zugriff auf Health,
// Kurzbefehle schon. Tagesform startet einen Kurzbefehl mit den Daten als Text (JSON),
// umgekehrt öffnet ein Kurzbefehl Tagesform mit Health-Werten im Link (#/?do=health&...).
import { getDay, patchDay, S } from './store.js';
import { daySums } from './nutrition.js';
import { lsGet, lsSet, num, todayKey } from './util.js';

export const SC_FOOD = 'Tagesform Ernährung';
export const SC_WORKOUT = 'Tagesform Training';
export const SC_IMPORT = 'Health an Tagesform';

export const healthOn = () => lsGet('tf.health', '0') === '1';
export const setHealthOn = (v) => lsSet('tf.health', v ? '1' : '0');

/** Kurzbefehl mit Text-Eingabe starten */
export function runShortcut(name, data) {
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(JSON.stringify(data))}`;
  location.href = url;
}

const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

/** Tageswerte Ernährung → Health (einmal am Abend senden, sonst doppelt in Health) */
export function sendDayToHealth(k = todayKey()) {
  const s = daySums(getDay(k));
  const d = getDay(k);
  runShortcut(SC_FOOD, { datum: k, kcal: Math.round(s.kcal), eiweiss: r1(s.p), kohlenhydrate: r1(s.c), fett: r1(s.f), wasser_ml: Math.round(d.waterMl || 0) });
  patchDay(k, { healthSent: Date.now() });
}

/** Ein Training → Health (Workout „Krafttraining“) */
export function sendWorkoutToHealth(w) {
  const start = new Date(w.startedAt || Date.now() - (w.minutes || 45) * 60000);
  const end = new Date(w.finishedAt || start.getTime() + (w.minutes || 45) * 60000);
  runShortcut(SC_WORKOUT, { art: 'Krafttraining', name: w.name, start: start.toISOString(), ende: end.toISOString(), minuten: w.minutes || Math.round((end - start) / 60000) });
}

/** Werte aus Health übernehmen (Deep Link vom Kurzbefehl) – gibt Text für die Rückmeldung zurück */
export function importFromHealth(q) {
  const k = todayKey();
  const h = {};
  const out = [];
  const weight = num(q.gewicht);
  if (weight > 30 && weight < 300) out.push(`${String(r1(weight)).replace('.', ',')} kg`);
  const sleep = num(q.schlaf);
  if (sleep > 0 && sleep < 16) {
    h.sleepH = r1(sleep);
    out.push(`${String(r1(sleep)).replace('.', ',')} h Schlaf`);
  }
  const steps = Math.round(num(q.schritte));
  if (steps > 0) {
    h.steps = steps;
    out.push(`${steps.toLocaleString('de-DE')} Schritte`);
  }
  const active = Math.round(num(q.aktiv));
  if (active > 0) {
    h.activeKcal = active;
    out.push(`${active} kcal aktiv`);
  }
  patchDay(k, (d) => ({ ...(weight > 30 && weight < 300 ? { weight: r1(weight) } : {}), health: { ...(d.health || {}), ...h, at: Date.now() } }));
  return out.length ? `Aus Health übernommen: ${out.join(' · ')}` : 'Keine Health-Werte im Link gefunden';
}

/** Schlafdauer → Auswahl der Wellness-Abfrage */
export const sleepBucket = (h) => (h == null ? null : h < 6 ? '< 6 h' : h < 6.75 ? '6 h' : h < 7.75 ? '7 h' : h < 8.75 ? '8 h' : '9 h +');

export const appUrl = () => location.origin + location.pathname;
export { S };
