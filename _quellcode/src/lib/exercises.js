import { MORE } from './exercises2.js';
// Übungsbibliothek fürs Fitnessstudio (Technogym-Geräte, Kurz-/Langhantel, Kabel)
// stress = Körperstellen, die die Übung belastet (gleiche Namen wie im Tagesform-Check)
// alt = Ausweichübungen in sinnvoller Reihenfolge
// inc = Gewichtssteigerung in kg, unit = 'Wdh.' oder 'Sek.', main = Hauptübung (längere Pause)

const E = (id, name, o) => ({ id, name, unit: 'Wdh.', inc: 2.5, alt: [], stress: [], ...o });

export const EXERCISES = Object.fromEntries(
  [
    // ---- Drücken ----
    E('bankdruecken', 'Bankdrücken (Langhantel)', { equip: 'Langhantel', reps: [6, 10], main: true, stress: ['Schulter', 'Ellbogen', 'Handgelenk'], alt: ['kh-bank', 'brustpresse', 'liegestuetz'], cue: 'Schulterblätter zusammen, Füße fest am Boden, Stange zur unteren Brust.' }),
    E('kh-bank', 'Kurzhantel-Bankdrücken', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Schulter', 'Ellbogen'], alt: ['brustpresse', 'bankdruecken', 'liegestuetz'], cue: 'Gewicht pro Hand. Ellbogen ca. 45° vom Körper, kontrolliert ablassen.' }),
    E('schraeg-kh', 'Schrägbankdrücken Kurzhantel', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Schulter', 'Ellbogen'], alt: ['brustpresse', 'kh-bank'], cue: 'Bank auf ca. 30°. Gewicht pro Hand.' }),
    E('brustpresse', 'Brustpresse (Maschine)', { equip: 'Maschine', reps: [8, 12], stress: ['Ellbogen'], alt: ['kh-bank', 'liegestuetz'], cue: 'Griffe auf Brusthöhe, Schultern unten lassen.' }),
    E('liegestuetz', 'Liegestütze', { equip: 'Körpergewicht', reps: [8, 20], inc: 0, stress: ['Handgelenk', 'Schulter'], alt: ['brustpresse'], cue: 'Körper wie ein Brett. Zu schwer? Hände erhöht auf eine Bank.' }),
    E('schulterdruecken', 'Schulterdrücken Kurzhantel (sitzend)', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Schulter', 'Ellbogen', 'Nacken'], alt: ['schulterpresse', 'seitheben'], cue: 'Gewicht pro Hand. Rücken an der Lehne, nicht ins Hohlkreuz.' }),
    E('schulterpresse', 'Schulterpresse (Maschine)', { equip: 'Maschine', reps: [8, 12], stress: ['Schulter', 'Nacken'], alt: ['seitheben'], cue: 'Sitz so einstellen, dass die Griffe auf Schulterhöhe starten.' }),
    E('seitheben', 'Seitheben Kurzhantel', { equip: 'Kurzhantel', reps: [12, 15], inc: 1, stress: ['Schulter'], alt: ['seitheben-kabel'], cue: 'Gewicht pro Hand. Leicht vorgebeugt, bis Schulterhöhe heben – nicht schwingen.' }),
    E('seitheben-kabel', 'Seitheben am Kabel', { equip: 'Kabel', reps: [12, 15], inc: 1, stress: ['Schulter'], alt: [], cue: 'Einarmig, Kabel hinter dem Körper führen.' }),
    E('trizeps-kabel', 'Trizepsdrücken am Kabel', { equip: 'Kabel', reps: [10, 15], stress: ['Ellbogen'], alt: ['trizeps-ueberkopf'], cue: 'Ellbogen bleiben am Körper, nur Unterarme bewegen.' }),
    E('trizeps-ueberkopf', 'Trizeps über Kopf (Kabel)', { equip: 'Kabel', reps: [10, 15], stress: ['Ellbogen', 'Schulter'], alt: [], cue: 'Mit dem Rücken zum Kabelturm, Ellbogen zeigen nach vorn.' }),
    // ---- Ziehen ----
    E('latzug', 'Latzug (breit)', { equip: 'Maschine', reps: [8, 12], main: true, stress: ['Schulter', 'Ellbogen'], alt: ['latzug-eng', 'klimmzug-assist', 'klimmzug', 'inverted-row'], cue: 'Brust raus, Stange zur oberen Brust ziehen, nicht hinter den Kopf.' }),
    E('latzug-eng', 'Latzug enger Neutralgriff', { equip: 'Maschine', reps: [8, 12], stress: ['Ellbogen'], alt: ['rudern-kabel'], cue: 'Ellbogen nach unten zu den Hüften ziehen.' }),
    E('klimmzug-assist', 'Klimmzüge (ggf. mit Unterstützung)', { equip: 'Maschine', reps: [5, 10], main: true, inc: 2.5, stress: ['Schulter', 'Ellbogen'], alt: ['latzug', 'latzug-eng'], cue: 'Bei der Assist-Maschine ist das Gewicht die Unterstützung – weniger ist schwerer.' }),
    E('rudern-kabel', 'Rudern am Kabel (sitzend)', { equip: 'Kabel', reps: [8, 12], stress: ['Ellbogen'], alt: ['rudern-brust', 'rudern-kh'], cue: 'Aufrecht sitzen, Schulterblätter zusammen, Griff zum Bauch.' }),
    E('rudern-brust', 'Rudermaschine brustgestützt', { equip: 'Maschine', reps: [8, 12], stress: [], alt: ['rudern-kabel', 'rudern-reardelt'], cue: 'Brust bleibt am Polster – schont den unteren Rücken.' }),
    E('rudern-kh', 'Einarmiges Kurzhantelrudern', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Rücken unten'], alt: ['rudern-brust', 'rudern-kabel'], cue: 'Gewicht pro Hand. Knie und Hand auf der Bank, Rücken gerade.' }),
    E('facepull', 'Face Pulls (Kabel)', { equip: 'Kabel', reps: [12, 15], inc: 1, stress: [], alt: ['reverse-fly'], cue: 'Seil zur Stirn, Daumen nach hinten drehen – gut für Haltung und gesunde Schultern.' }),
    E('reverse-fly', 'Reverse Butterfly (Maschine)', { equip: 'Maschine', reps: [12, 15], stress: [], alt: ['rudern-reardelt', 'facepull'], cue: 'Arme leicht gebeugt, hintere Schulter arbeitet.' }),
    E('aussenrotation', 'Außenrotation am Kabel', { equip: 'Kabel', reps: [12, 15], inc: 1, stress: [], alt: ['facepull'], cue: 'Leichtes Gewicht! Ellbogen am Körper, Unterarm nach außen drehen. Vorbeugung für Wurf- und Überkopfsportler.' }),
    E('bizeps-kh', 'Bizepscurls Kurzhantel', { equip: 'Kurzhantel', reps: [10, 12], inc: 1, stress: ['Ellbogen', 'Handgelenk'], alt: ['bizeps-kabel'], cue: 'Gewicht pro Hand. Ellbogen ruhig, nicht schwingen.' }),
    E('bizeps-kabel', 'Bizepscurls am Kabel', { equip: 'Kabel', reps: [10, 15], stress: ['Ellbogen'], alt: [], cue: 'Konstante Spannung, oben kurz halten.' }),
    E('hammercurls', 'Hammercurls', { equip: 'Kurzhantel', reps: [10, 12], inc: 1, stress: ['Ellbogen'], alt: ['bizeps-kabel'], cue: 'Gewicht pro Hand. Daumen zeigen nach oben.' }),
    // ---- Beine ----
    E('kniebeuge', 'Kniebeuge (Langhantel)', { equip: 'Langhantel', reps: [5, 8], main: true, stress: ['Knie', 'Rücken unten', 'Hüfte'], alt: ['beinpresse', 'goblet'], cue: 'Brust raus, Knie in Richtung Zehen, mindestens parallel runter.' }),
    E('beinpresse', 'Beinpresse', { equip: 'Maschine', reps: [8, 12], inc: 5, main: true, stress: ['Knie'], alt: ['hip-thrust', 'beinbeuger'], cue: 'Füße schulterbreit, unten nicht den Po vom Polster heben.' }),
    E('goblet', 'Goblet Squat (Kurzhantel)', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Knie', 'Hüfte'], alt: ['beinpresse'], cue: 'Kurzhantel vor der Brust, aufrecht tief runter.' }),
    E('rdl', 'Rumänisches Kreuzheben', { equip: 'Langhantel', reps: [6, 10], main: true, stress: ['Rücken unten', 'Oberschenkel'], alt: ['kh-rdl', 'hip-thrust', 'beinbeuger'], cue: 'Hüfte nach hinten schieben, Stange nah am Bein, Rücken gerade.' }),
    E('hip-thrust', 'Hip Thrust', { equip: 'Langhantel', reps: [8, 12], stress: ['Hüfte'], alt: ['beinbeuger'], cue: 'Schultern auf der Bank, oben Po fest anspannen.' }),
    E('beinbeuger', 'Beinbeuger (Maschine)', { equip: 'Maschine', reps: [10, 12], stress: ['Oberschenkel'], alt: ['hip-thrust'], cue: 'Langsam ablassen – schützt die hintere Oberschenkelmuskulatur.' }),
    E('beinstrecker', 'Beinstrecker (Maschine)', { equip: 'Maschine', reps: [10, 15], stress: ['Knie'], alt: ['goblet'], cue: 'Oben kurz halten, kontrolliert runter.' }),
    E('split-squat', 'Bulgarian Split Squat', { equip: 'Kurzhantel', reps: [8, 10], inc: 2, stress: ['Knie', 'Hüfte'], alt: ['ausfallschritte', 'beinpresse'], cue: 'Gewicht pro Hand, Wdh. pro Bein. Hinterer Fuß auf der Bank.' }),
    E('ausfallschritte', 'Ausfallschritte gehend', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Knie'], alt: ['beinpresse'], cue: 'Wdh. pro Bein, Oberkörper aufrecht.' }),
    E('nordic', 'Nordic Hamstring Curls', { equip: 'Körpergewicht', reps: [4, 8], inc: 0, stress: ['Oberschenkel', 'Knie'], alt: ['beinbeuger'], cue: 'Füße fixieren, so langsam wie möglich nach vorne ablassen. Top-Prävention gegen Zerrungen.' }),
    E('copenhagen', 'Copenhagen Plank (Adduktoren)', { equip: 'Körpergewicht', reps: [20, 40], inc: 0, unit: 'Sek.', stress: ['Hüfte', 'Knie'], alt: ['pallof'], cue: 'Seitstütz, oberes Bein auf der Bank. Pro Seite. Schützt die Leiste.' }),
    E('wadenheben', 'Wadenheben (Maschine)', { equip: 'Maschine', reps: [10, 15], stress: ['Wade', 'Sprunggelenk'], alt: ['wadenheben-kh', 'waden-beinpresse', 'wadenheben-sitzend'], cue: 'Ganz runter dehnen, oben 1 Sek. halten.' }),
    // ---- Rumpf ----
    E('pallof', 'Pallof Press (Kabel)', { equip: 'Kabel', reps: [10, 12], inc: 1, stress: [], alt: ['plank'], cue: 'Pro Seite. Seitlich zum Kabel, Arme gerade nach vorn drücken, nicht verdrehen lassen.' }),
    E('plank', 'Unterarmstütz', { equip: 'Körpergewicht', reps: [30, 60], inc: 0, unit: 'Sek.', stress: ['Schulter', 'Rücken unten'], alt: ['deadbug'], cue: 'Po anspannen, kein Hohlkreuz.' }),
    E('deadbug', 'Dead Bug', { equip: 'Körpergewicht', reps: [8, 12], inc: 0, stress: [], alt: [], cue: 'Pro Seite. Unterer Rücken bleibt am Boden.' }),
    E('kabelcrunch', 'Kabel-Crunch', { equip: 'Kabel', reps: [12, 15], stress: ['Rücken unten', 'Nacken'], alt: ['deadbug'], cue: 'Kniend, Bauch einrollen – nicht mit den Armen ziehen.' }),
  ].map((e) => [e.id, e]),
);

// Erweiterte Bibliothek zum Suchen & Anpassen
for (const e of MORE) EXERCISES[e.id] = e;

/** Einheiten-Vorlagen. Reihenfolge = Priorität (kürzere Einheit schneidet hinten ab) */
export const SESSIONS = {
  OKA: { id: 'OKA', name: 'Oberkörper A', short: 'OK A', focus: 'Drücken-Schwerpunkt', legs: false, ex: ['bankdruecken', 'latzug', 'schulterdruecken', 'rudern-kabel', 'seitheben', 'trizeps-kabel', 'aussenrotation'] },
  OKB: { id: 'OKB', name: 'Oberkörper B', short: 'OK B', focus: 'Ziehen-Schwerpunkt', legs: false, ex: ['klimmzug-assist', 'schraeg-kh', 'rudern-kh', 'brustpresse', 'facepull', 'bizeps-kh', 'trizeps-ueberkopf'] },
  UKA: { id: 'UKA', name: 'Unterkörper A', short: 'UK A', focus: 'Kraft', legs: true, ex: ['kniebeuge', 'rdl', 'beinpresse', 'beinbeuger', 'wadenheben', 'pallof', 'kabelcrunch'] },
  UKB: { id: 'UKB', name: 'Unterkörper B', short: 'UK B', focus: 'Athletik & Verletzungsprävention', legs: true, ex: ['split-squat', 'hip-thrust', 'nordic', 'copenhagen', 'beinstrecker', 'plank', 'wadenheben'] },
  GK1: { id: 'GK1', name: 'Ganzkörper 1', short: 'GK 1', focus: 'Ganzkörper', legs: true, ex: ['goblet', 'bankdruecken', 'latzug', 'rdl', 'rudern-kabel', 'facepull', 'pallof'] },
  GK2: { id: 'GK2', name: 'Ganzkörper 2', short: 'GK 2', focus: 'Ganzkörper', legs: true, ex: ['beinpresse', 'schulterdruecken', 'rudern-brust', 'hip-thrust', 'kh-bank', 'nordic', 'plank'] },
};

Object.assign(SESSIONS, {
  GK3: { id: 'GK3', name: 'Ganzkörper 3', short: 'GK 3', focus: 'Ganzkörper', legs: true, ex: ['split-squat', 'schraeg-kh', 'klimmzug-assist', 'beinbeuger', 'seitheben', 'rudern-kh', 'kabelcrunch'] },
  PUSH: { id: 'PUSH', name: 'Push', short: 'Push', focus: 'Brust, Schulter, Trizeps', legs: false, ex: ['bankdruecken', 'schraeg-kh', 'schulterdruecken', 'seitheben', 'brustpresse', 'trizeps-kabel', 'trizeps-ueberkopf'] },
  PULL: { id: 'PULL', name: 'Pull', short: 'Pull', focus: 'Rücken, hintere Schulter, Bizeps', legs: false, ex: ['latzug', 'rudern-kabel', 'rudern-kh', 'facepull', 'bizeps-kh', 'hammercurls', 'aussenrotation'] },
  BEINE: { id: 'BEINE', name: 'Beine', short: 'Beine', focus: 'Beine & Rumpf', legs: true, ex: ['kniebeuge', 'rdl', 'beinpresse', 'beinbeuger', 'wadenheben', 'pallof', 'kabelcrunch'] },
  BBPA: { id: 'BBPA', name: 'Po & Beine A', short: 'Po A', focus: 'Po-Fokus mit Kraft', legs: true, ex: ['hip-thrust', 'plie-squat', 'rdl', 'reverse-lunge', 'abduktoren', 'kabel-kickback', 'reverse-crunch'] },
  BBPB: { id: 'BBPB', name: 'Po & Beine B', short: 'Po B', focus: 'Po seitlich, Beine & Bauch', legs: true, ex: ['beinpresse', 'pull-through', 'curtsy-lunge', 'beinbeuger', 'glute-bridge-einbeinig', 'seitstuetz', 'fahrrad-crunch'] },
  OKBAUCH: { id: 'OKBAUCH', name: 'Oberkörper & Bauch', short: 'OK+Bauch', focus: 'Rücken, Schultern, Arme & Bauch', legs: false, ex: ['latzug', 'brustpresse', 'rudern-kabel', 'schulterpresse', 'seitheben', 'trizeps-kabel', 'holzhacker'] },
  // Urlaub / unterwegs – Muskeln erhalten (2× pro Woche reicht dafür, wenn die Sätze fordernd sind)
  URLA: { id: 'URLA', name: 'Urlaub Ganzkörper A', short: 'Urlaub A', focus: 'Ohne Geräte · ca. 30 Min', legs: true, away: true, ex: ['kniebeuge-kg', 'liegestuetz', 'inverted-row', 'glute-bridge', 'bench-dips', 'plank'] },
  URLB: { id: 'URLB', name: 'Urlaub Ganzkörper B', short: 'Urlaub B', focus: 'Ohne Geräte · ca. 30 Min', legs: true, away: true, ex: ['split-squat', 'liegestuetz-erhoeht', 'klimmzug', 'standwaage', 'superman', 'seitstuetz'] },
  URLKA: { id: 'URLKA', name: 'Urlaub Kurzhantel A', short: 'KH A', focus: 'Kurzhanteln / kleines Hotel-Gym · ca. 35 Min', legs: true, away: true, ex: ['goblet', 'kh-bank', 'rudern-kh', 'reverse-lunge', 'schulterdruecken', 'plank'] },
  URLKB: { id: 'URLKB', name: 'Urlaub Kurzhantel B', short: 'KH B', focus: 'Kurzhanteln / kleines Hotel-Gym · ca. 35 Min', legs: true, away: true, ex: ['split-squat', 'schraeg-kh', 'rudern-kh', 'glute-bridge-einbeinig', 'seitheben', 'bizeps-kh', 'seitstuetz'] },
  LAUF1: { id: 'LAUF1', name: 'Lockerer Lauf', short: 'Laufen', focus: '30–45 Min. ruhig', legs: false, away: true, cardio: true, ex: [], minutes: 40,
    steps: ['5 Min. zügig gehen zum Aufwärmen.', '30–40 Min. so locker laufen, dass du dich noch unterhalten könntest (Puls ca. 60–70 % vom Maximum).', 'Lieber langsamer als zu schnell – Gehpausen sind völlig ok.', '5 Min. auslaufen, danach kurz Waden und Hüfte dehnen.'] },
  LAUF2: { id: 'LAUF2', name: 'Intervall-Lauf', short: 'Intervalle', focus: 'ca. 30 Min. mit Tempowechsel', legs: false, away: true, cardio: true, ex: [], minutes: 30,
    steps: ['10 Min. locker einlaufen.', '6 × 1 Min. zügig (anstrengend, aber kontrolliert), dazwischen je 2 Min. locker traben oder gehen.', 'Für Mannschaftssportler: 6–8 kurze Sprints à 10–15 s mit voller Erholung passen hier gut.', '5 Min. locker auslaufen.'] },
  // Zuhause ohne Geräte (Ausstattung „Ohne Geräte“) – mit Progression über Wiederholungen
  KGA: { id: 'KGA', name: 'Ganzkörper ohne Geräte A', short: 'KG A', focus: 'Körpergewicht · Zuhause oder draußen', legs: true, ex: ['kniebeuge-kg', 'liegestuetz', 'inverted-row', 'glute-bridge-einbeinig', 'bench-dips', 'seitstuetz', 'wadenheben-kh'] },
  KGB: { id: 'KGB', name: 'Ganzkörper ohne Geräte B', short: 'KG B', focus: 'Körpergewicht · Zuhause oder draußen', legs: true, ex: ['ausfallschritte-kg', 'liegestuetz-erhoeht', 'klimmzug', 'glute-bridge', 'liegestuetz-eng', 'superman', 'reverse-crunch'] },
  KGC: { id: 'KGC', name: 'Ganzkörper ohne Geräte C', short: 'KG C', focus: 'Körpergewicht · mit Sprüngen', legs: true, ex: ['curtsy-lunge', 'liegestuetz', 'inverted-row', 'jump-squat', 'donkey-kicks', 'mountain-climber', 'plank'] },
  ARME: { id: 'ARME', name: 'Schultern & Arme', short: 'Arme', focus: 'Schultern, Bizeps, Trizeps', legs: false, ex: ['schulterpresse', 'seitheben-kabel', 'reverse-fly', 'sz-curl', 'french-press', 'hammercurls', 'trizeps-kabel'] },
});

export const ROTATIONS = {
  1: ['GK1'],
  2: ['GK1', 'GK2'],
  3: ['OKA', 'UKA', 'OKB'],
  4: ['OKA', 'UKA', 'OKB', 'UKB'],
  5: ['OKA', 'UKA', 'OKB', 'UKB', 'GK1'],
  6: ['PUSH', 'PULL', 'BEINE', 'PUSH', 'PULL', 'BEINE'],
};

/** Plan ohne Geräte (Ausstattung „Ohne Geräte“) */
export const KG_SPLITS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((n) => [n, [{ id: 'kg' + n, name: 'Ganzkörper ohne Geräte', hint: 'Körpergewicht – Steigerung über Wiederholungen und schwerere Varianten', rot: Array.from({ length: n }, (_, i) => ['KGA', 'KGB', 'KGC'][i % (n >= 3 ? 3 : 2)]) }]]),
);

/** Plan-Vorschläge je Trainingshäufigkeit (wie in Studio-Apps üblich). Erster = Standard. */
export const SPLITS = {
  1: [{ id: 'gk1', name: 'Ganzkörper', hint: 'Ein kompletter Durchgang pro Woche', rot: ['GK1'] }],
  2: [
    { id: 'gk2', name: 'Ganzkörper A / B', hint: 'Jeder Muskel 2× pro Woche – ideal bei wenig Zeit', rot: ['GK1', 'GK2'], sport: true },
    { id: 'bbp2', name: 'Bauch-Beine-Po + Oberkörper', hint: 'Po & Beine 1×, Oberkörper & Bauch 1×', rot: ['BBPA', 'OKBAUCH'] },
    { id: 'okuk2', name: 'Oberkörper / Unterkörper', hint: 'Je 1× pro Woche, dafür mehr Übungen pro Bereich', rot: ['OKA', 'UKA'] },
  ],
  3: [
    { id: 'okuk3', name: 'Oberkörper / Unterkörper / Oberkörper', hint: 'Nur 1 Beintag – passt gut neben Vereinssport', rot: ['OKA', 'UKA', 'OKB'], sport: true },
    { id: 'bbp3', name: 'Bauch-Beine-Po-Fokus', hint: 'Po & Beine 2×, Oberkörper & Bauch 1×', rot: ['BBPA', 'OKBAUCH', 'BBPB'] },
    { id: 'gk3', name: 'Ganzkörper A / B / C', hint: 'Alle Muskeln jedes Mal – gut für Einsteiger', rot: ['GK1', 'GK2', 'GK3'] },
    { id: 'ppl', name: 'Push / Pull / Beine', hint: 'Klassischer Split, jeder Bereich 1× pro Woche', rot: ['PUSH', 'PULL', 'BEINE'] },
    { id: 'ukokuk', name: 'Unterkörper / Oberkörper / Unterkörper', hint: 'Beine-Schwerpunkt – 2 Beintage, 1 Oberkörper', rot: ['UKA', 'OKA', 'UKB'] },
    { id: 'okukgk', name: 'Oberkörper / Unterkörper / Ganzkörper', hint: 'Mischung – Beine 2×, Oberkörper 2×', rot: ['OKA', 'UKA', 'GK1'] },
  ],
  4: [
    { id: 'okuk4', name: 'Oberkörper / Unterkörper ×2', hint: 'Jeder Muskel 2× pro Woche – der Klassiker', rot: ['OKA', 'UKA', 'OKB', 'UKB'], sport: true },
    { id: 'bbp4', name: 'Bauch-Beine-Po ×2 + Oberkörper ×2', hint: 'Po & Beine 2×, Oberkörper & Bauch 2×', rot: ['BBPA', 'OKBAUCH', 'BBPB', 'OKBAUCH'] },
    { id: 'ppl4', name: 'Push / Pull / Beine + Oberkörper', hint: 'PPL mit Extra-Oberkörper', rot: ['PUSH', 'PULL', 'BEINE', 'OKA'] },
    { id: 'ukok4', name: 'Unterkörper ×2 / Oberkörper ×2 (Beine zuerst)', hint: 'Wie OK/UK, Woche startet mit Beinen', rot: ['UKA', 'OKA', 'UKB', 'OKB'] },
    { id: 'gk4', name: 'Ganzkörper A / B / C / A', hint: 'Viel Frequenz, kürzere Belastung pro Muskel', rot: ['GK1', 'GK2', 'GK3', 'GK1'] },
    { id: 'okuk-arme', name: 'Oberkörper / Unterkörper / Ganzkörper / Arme', hint: 'Mit eigenem Schulter-&-Arm-Tag', rot: ['OKA', 'UKA', 'GK1', 'ARME'] },
  ],
  5: [
    { id: 'okuk5', name: 'OK / UK ×2 + Ganzkörper', hint: 'Ausgewogen mit Bonus-Einheit', rot: ['OKA', 'UKA', 'OKB', 'UKB', 'GK1'], sport: true },
    { id: 'bbp5', name: 'Bauch-Beine-Po-Fokus ×5', hint: 'Po & Beine 3×, Oberkörper & Bauch 2×', rot: ['BBPA', 'OKBAUCH', 'BBPB', 'OKBAUCH', 'BBPA'] },
    { id: 'ppl-okuk', name: 'Push / Pull / Beine + OK / UK', hint: 'Beliebter 5er-Split', rot: ['PUSH', 'PULL', 'BEINE', 'OKA', 'UKA'] },
    { id: 'okuk-arme5', name: 'OK / UK ×2 + Arme', hint: 'Mit Schulter-&-Arm-Tag', rot: ['OKA', 'UKA', 'OKB', 'UKB', 'ARME'] },
  ],
  6: [
    { id: 'ppl2', name: 'Push / Pull / Beine ×2', hint: 'Jeder Bereich 2× – für Erfahrene', rot: ['PUSH', 'PULL', 'BEINE', 'PUSH', 'PULL', 'BEINE'] },
    { id: 'okuk6', name: 'Oberkörper / Unterkörper ×3', hint: 'Hohe Frequenz, gut steuerbar', rot: ['OKA', 'UKA', 'OKB', 'UKB', 'OKA', 'UKA'] },
  ],
};

export const exName = (id) => (EXERCISES[id] ? EXERCISES[id].name : id);
