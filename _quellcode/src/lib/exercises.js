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
    E('latzug', 'Latzug (breit)', { equip: 'Maschine', reps: [8, 12], main: true, stress: ['Schulter', 'Ellbogen'], alt: ['latzug-eng', 'klimmzug-assist'], cue: 'Brust raus, Stange zur oberen Brust ziehen, nicht hinter den Kopf.' }),
    E('latzug-eng', 'Latzug enger Neutralgriff', { equip: 'Maschine', reps: [8, 12], stress: ['Ellbogen'], alt: ['rudern-kabel'], cue: 'Ellbogen nach unten zu den Hüften ziehen.' }),
    E('klimmzug-assist', 'Klimmzüge (ggf. mit Unterstützung)', { equip: 'Maschine', reps: [5, 10], main: true, inc: 2.5, stress: ['Schulter', 'Ellbogen'], alt: ['latzug', 'latzug-eng'], cue: 'Bei der Assist-Maschine ist das Gewicht die Unterstützung – weniger ist schwerer.' }),
    E('rudern-kabel', 'Rudern am Kabel (sitzend)', { equip: 'Kabel', reps: [8, 12], stress: ['Ellbogen'], alt: ['rudern-brust', 'rudern-kh'], cue: 'Aufrecht sitzen, Schulterblätter zusammen, Griff zum Bauch.' }),
    E('rudern-brust', 'Rudermaschine brustgestützt', { equip: 'Maschine', reps: [8, 12], stress: [], alt: ['rudern-kabel'], cue: 'Brust bleibt am Polster – schont den unteren Rücken.' }),
    E('rudern-kh', 'Einarmiges Kurzhantelrudern', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Rücken unten'], alt: ['rudern-brust', 'rudern-kabel'], cue: 'Gewicht pro Hand. Knie und Hand auf der Bank, Rücken gerade.' }),
    E('facepull', 'Face Pulls (Kabel)', { equip: 'Kabel', reps: [12, 15], inc: 1, stress: [], alt: ['reverse-fly'], cue: 'Seil zur Stirn, Daumen nach hinten drehen – gut für Haltung und gesunde Schultern.' }),
    E('reverse-fly', 'Reverse Butterfly (Maschine)', { equip: 'Maschine', reps: [12, 15], stress: [], alt: [], cue: 'Arme leicht gebeugt, hintere Schulter arbeitet.' }),
    E('aussenrotation', 'Außenrotation am Kabel', { equip: 'Kabel', reps: [12, 15], inc: 1, stress: [], alt: ['facepull'], cue: 'Leichtes Gewicht! Ellbogen am Körper, Unterarm nach außen drehen. Vorbeugung für Wurf- und Überkopfsportler.' }),
    E('bizeps-kh', 'Bizepscurls Kurzhantel', { equip: 'Kurzhantel', reps: [10, 12], inc: 1, stress: ['Ellbogen', 'Handgelenk'], alt: ['bizeps-kabel'], cue: 'Gewicht pro Hand. Ellbogen ruhig, nicht schwingen.' }),
    E('bizeps-kabel', 'Bizepscurls am Kabel', { equip: 'Kabel', reps: [10, 15], stress: ['Ellbogen'], alt: [], cue: 'Konstante Spannung, oben kurz halten.' }),
    E('hammercurls', 'Hammercurls', { equip: 'Kurzhantel', reps: [10, 12], inc: 1, stress: ['Ellbogen'], alt: ['bizeps-kabel'], cue: 'Gewicht pro Hand. Daumen zeigen nach oben.' }),
    // ---- Beine ----
    E('kniebeuge', 'Kniebeuge (Langhantel)', { equip: 'Langhantel', reps: [5, 8], main: true, stress: ['Knie', 'Rücken unten', 'Hüfte'], alt: ['beinpresse', 'goblet'], cue: 'Brust raus, Knie in Richtung Zehen, mindestens parallel runter.' }),
    E('beinpresse', 'Beinpresse', { equip: 'Maschine', reps: [8, 12], inc: 5, main: true, stress: ['Knie'], alt: ['hip-thrust', 'beinbeuger'], cue: 'Füße schulterbreit, unten nicht den Po vom Polster heben.' }),
    E('goblet', 'Goblet Squat (Kurzhantel)', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Knie', 'Hüfte'], alt: ['beinpresse'], cue: 'Kurzhantel vor der Brust, aufrecht tief runter.' }),
    E('rdl', 'Rumänisches Kreuzheben', { equip: 'Langhantel', reps: [6, 10], main: true, stress: ['Rücken unten', 'Oberschenkel'], alt: ['hip-thrust', 'beinbeuger'], cue: 'Hüfte nach hinten schieben, Stange nah am Bein, Rücken gerade.' }),
    E('hip-thrust', 'Hip Thrust', { equip: 'Langhantel', reps: [8, 12], stress: ['Hüfte'], alt: ['beinbeuger'], cue: 'Schultern auf der Bank, oben Po fest anspannen.' }),
    E('beinbeuger', 'Beinbeuger (Maschine)', { equip: 'Maschine', reps: [10, 12], stress: ['Oberschenkel'], alt: ['hip-thrust'], cue: 'Langsam ablassen – schützt die hintere Oberschenkelmuskulatur.' }),
    E('beinstrecker', 'Beinstrecker (Maschine)', { equip: 'Maschine', reps: [10, 15], stress: ['Knie'], alt: ['goblet'], cue: 'Oben kurz halten, kontrolliert runter.' }),
    E('split-squat', 'Bulgarian Split Squat', { equip: 'Kurzhantel', reps: [8, 10], inc: 2, stress: ['Knie', 'Hüfte'], alt: ['ausfallschritte', 'beinpresse'], cue: 'Gewicht pro Hand, Wdh. pro Bein. Hinterer Fuß auf der Bank.' }),
    E('ausfallschritte', 'Ausfallschritte gehend', { equip: 'Kurzhantel', reps: [8, 12], inc: 2, stress: ['Knie'], alt: ['beinpresse'], cue: 'Wdh. pro Bein, Oberkörper aufrecht.' }),
    E('nordic', 'Nordic Hamstring Curls', { equip: 'Körpergewicht', reps: [4, 8], inc: 0, stress: ['Oberschenkel', 'Knie'], alt: ['beinbeuger'], cue: 'Füße fixieren, so langsam wie möglich nach vorne ablassen. Top-Prävention gegen Zerrungen.' }),
    E('copenhagen', 'Copenhagen Plank (Adduktoren)', { equip: 'Körpergewicht', reps: [20, 40], inc: 0, unit: 'Sek.', stress: ['Hüfte', 'Knie'], alt: ['pallof'], cue: 'Seitstütz, oberes Bein auf der Bank. Pro Seite. Schützt die Leiste.' }),
    E('wadenheben', 'Wadenheben (Maschine)', { equip: 'Maschine', reps: [10, 15], stress: ['Wade', 'Sprunggelenk'], alt: [], cue: 'Ganz runter dehnen, oben 1 Sek. halten.' }),
    // ---- Rumpf ----
    E('pallof', 'Pallof Press (Kabel)', { equip: 'Kabel', reps: [10, 12], inc: 1, stress: [], alt: ['plank'], cue: 'Pro Seite. Seitlich zum Kabel, Arme gerade nach vorn drücken, nicht verdrehen lassen.' }),
    E('plank', 'Unterarmstütz', { equip: 'Körpergewicht', reps: [30, 60], inc: 0, unit: 'Sek.', stress: ['Schulter', 'Rücken unten'], alt: ['deadbug'], cue: 'Po anspannen, kein Hohlkreuz.' }),
    E('deadbug', 'Dead Bug', { equip: 'Körpergewicht', reps: [8, 12], inc: 0, stress: [], alt: [], cue: 'Pro Seite. Unterer Rücken bleibt am Boden.' }),
    E('kabelcrunch', 'Kabel-Crunch', { equip: 'Kabel', reps: [12, 15], stress: ['Rücken unten', 'Nacken'], alt: ['deadbug'], cue: 'Kniend, Bauch einrollen – nicht mit den Armen ziehen.' }),
  ].map((e) => [e.id, e]),
);

/** Einheiten-Vorlagen. Reihenfolge = Priorität (kürzere Einheit schneidet hinten ab) */
export const SESSIONS = {
  OKA: { id: 'OKA', name: 'Oberkörper A', short: 'OK A', focus: 'Drücken-Schwerpunkt', legs: false, ex: ['bankdruecken', 'latzug', 'schulterdruecken', 'rudern-kabel', 'seitheben', 'trizeps-kabel', 'aussenrotation'] },
  OKB: { id: 'OKB', name: 'Oberkörper B', short: 'OK B', focus: 'Ziehen-Schwerpunkt', legs: false, ex: ['klimmzug-assist', 'schraeg-kh', 'rudern-kh', 'brustpresse', 'facepull', 'bizeps-kh', 'trizeps-ueberkopf'] },
  UKA: { id: 'UKA', name: 'Unterkörper A', short: 'UK A', focus: 'Kraft', legs: true, ex: ['kniebeuge', 'rdl', 'beinpresse', 'beinbeuger', 'wadenheben', 'pallof', 'kabelcrunch'] },
  UKB: { id: 'UKB', name: 'Unterkörper B', short: 'UK B', focus: 'Athletik & Verletzungsprävention', legs: true, ex: ['split-squat', 'hip-thrust', 'nordic', 'copenhagen', 'beinstrecker', 'plank', 'wadenheben'] },
  GK1: { id: 'GK1', name: 'Ganzkörper 1', short: 'GK 1', focus: 'Ganzkörper', legs: true, ex: ['goblet', 'bankdruecken', 'latzug', 'rdl', 'rudern-kabel', 'facepull', 'pallof'] },
  GK2: { id: 'GK2', name: 'Ganzkörper 2', short: 'GK 2', focus: 'Ganzkörper', legs: true, ex: ['beinpresse', 'schulterdruecken', 'rudern-brust', 'hip-thrust', 'kh-bank', 'nordic', 'plank'] },
};

export const ROTATIONS = {
  2: ['GK1', 'GK2'],
  3: ['OKA', 'UKA', 'OKB'],
  4: ['OKA', 'UKA', 'OKB', 'UKB'],
};

export const exName = (id) => (EXERCISES[id] ? EXERCISES[id].name : id);
