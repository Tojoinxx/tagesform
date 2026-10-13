import { useS, saveTraining, S, toast } from '../lib/store.js';
import { CYCLE, cycleWeek, weeklyVolume, MUSCLE_LABEL, setupOf, sportOf, hasSport, SPORT_PROFILE, TRAIN_GOALS, goalOf, focusMgs } from '../lib/training.js';
import { todayKey, n1 } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { Battery } from './workout.jsx';
import { TrendingUp, Repeat, Layers, Gauge, HeartPulse, Shield, BookOpen, CalendarRange, SlidersHorizontal, Flame } from 'lucide-preact';

function Sec({ icon, title, children }) {
  return (
    <section class="card algo__sec">
      <h3>
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

export function AlgoSheet() {
  useS();
  const setup = setupOf();
  const cw = cycleWeek();
  const vol = weeklyVolume(setup);
  const sp = sportOf(setup);
  const maxVol = 20;

  return (
    <Sheet title="So funktioniert dein Plan" tall>
      <p class="algo__lead">
        Der Plan folgt dem, was die Trainingswissenschaft gut belegt hat: <b>genug harte Sätze</b>, <b>jeder Muskel ca. 2× pro Woche</b>, <b>nah ans Muskelversagen</b> und <b>stetige Steigerung</b> – plus Erholung, wenn der Körper sie braucht. Dein Ziel: <b>{goalOf(setup).label}</b>.
      </p>

      <Sec icon={<TrendingUp size={18} />} title="1. Steigerung von Training zu Training">
        <p>
          Jede Übung hat einen Wiederholungsbereich, z. B. <b>8–12</b>. Gesteigert wird in zwei Stufen („doppelte Progression“):
        </p>
        <ol class="algo__steps">
          <li>
            <b>Erst Wiederholungen:</b> Gleiches Gewicht, jedes Mal ca. 1 Wdh. mehr pro Satz anpeilen.
          </li>
          <li>
            <b>Dann Gewicht:</b> Schaffst du in <u>allen</u> Sätzen das obere Ende (z. B. 3 × 12), schlägt die App beim nächsten Mal mehr Gewicht vor und du startest wieder unten (8 Wdh.).
          </li>
          <li>
            <b>Zu schwer?</b> Schaffst du nicht mal das untere Ende, geht das Gewicht um ca. 10 % runter.
          </li>
        </ol>
        <table class="algo__table">
          <thead>
            <tr>
              <th>Übungsart</th>
              <th>Steigerung</th>
              <th>≈ in %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Langhantel (Bank, Kniebeuge, RDL)</td>
              <td>+2,5 kg</td>
              <td>2–5 %</td>
            </tr>
            <tr>
              <td>Beinpresse</td>
              <td>+5 kg</td>
              <td>2–4 %</td>
            </tr>
            <tr>
              <td>Maschinen & Kabel</td>
              <td>+2,5 kg</td>
              <td>3–8 %</td>
            </tr>
            <tr>
              <td>Kurzhanteln (pro Hand)</td>
              <td>+2 kg</td>
              <td>5–10 %</td>
            </tr>
            <tr>
              <td>Kleine Übungen (Seitheben, Curls)</td>
              <td>+1 kg</td>
              <td>5–10 %</td>
            </tr>
            <tr>
              <td>Körpergewicht / Halten</td>
              <td>+1 Wdh. / +5 Sek.</td>
              <td>–</td>
            </tr>
          </tbody>
        </table>
        <p class="small muted">Beispiel Brustpresse 8–12 Wdh.: 40 kg × 9/8/8 → 40 kg × 10/9/9 → … → 40 kg × 12/12/12 → nächstes Mal 42,5 kg × 8. So steigt die Last typischerweise alle 2–4 Einheiten.</p>
      </Sec>

      <Sec icon={<CalendarRange size={18} />} title="2. Woche für Woche: der 5-Wochen-Zyklus">
        <p>Zusätzlich zur Steigerung pro Training wird die Belastung über 5 Wochen langsam hochgefahren und dann bewusst gesenkt:</p>
        <div class="cycle">
          {CYCLE.map((c, i) => (
            <div class={'cycle__w' + (i === cw.index ? ' cycle__w--now' : '') + (c.deload ? ' cycle__w--deload' : '')}>
              <span class="cycle__n">W{i + 1}</span>
              <b>{c.label}</b>
              <span class="cycle__rir">RIR {c.rir}</span>
              <span class="cycle__t">{c.text}</span>
            </div>
          ))}
        </div>
        <p class="small">
          Du bist gerade in <b>Woche {cw.n}: {cw.label}</b>.
        </p>
        <p class="small muted">
          <b>RIR</b> = „Reps in Reserve“: wie viele Wiederholungen du am Satzende noch geschafft hättest. RIR 2 heißt: aufhören, wenn noch 2 gehen würden. Kleine Isolationsübungen gehen 1 Wdh. näher ran.
        </p>
        <button
          class="btn--link small"
          onClick={() => {
            if (confirm('Zyklus ab dieser Woche neu bei Woche 1 starten? (z. B. nach Urlaub oder Krankheit)')) {
              saveTraining({ setup: { ...setup, cycleStart: todayKey() } });
              toast('Zyklus neu gestartet');
            }
          }}
        >
          Zyklus neu starten (nach Pause/Urlaub)
        </button>
      </Sec>

      <Sec icon={<Layers size={18} />} title="3. Volumen: harte Sätze pro Muskel und Woche">
        <p>
          Studien zeigen: Mehr Sätze bringen mehr Muskel, mit abnehmendem Zusatznutzen. <b>Ab ca. 4–6 Sätzen</b> pro Muskel und Woche gibt es deutliche Zuwächse, <b>ca. 10–20</b> gelten als sehr effektiv. Hilfsmuskeln zählen halb (Bankdrücken = 1 Satz Brust + ½ Satz Trizeps).
        </p>
        <div class="vol">
          {Object.entries(vol).map(([m, v]) => (
            <div class="vol__row">
              <span class="vol__m">
                {MUSCLE_LABEL[m]}
                {focusMgs(setup).includes(m) ? ' ★' : ''}
              </span>
              <div class="vol__track">
                <div class="vol__zone" />
                <div class={'vol__fill' + (v >= 10 ? ' vol__fill--ok' : v >= 5 ? ' vol__fill--mid' : '')} style={{ width: Math.min(100, (v / maxVol) * 100) + '%' }} />
              </div>
              <b class="vol__v tnum">{n1(v)}</b>
            </div>
          ))}
          <p class="small muted">Dein aktueller Plan in einer normalen Woche (Wochen 3–4 etwas mehr). Grün markierter Bereich = 10–20 Sätze.</p>
        </div>
        {hasSport(setup) && (
          <p class="small muted">
            Beine & Rumpf bekommen zusätzlich Reiz durch {sp.name}. Mehr Beinvolumen? Wähle 4 Einheiten pro Woche.
          </p>
        )}
      </Sec>

      <Sec icon={<Repeat size={18} />} title="4. Frequenz & Aufteilung">
        <p>
          Jeder Muskel wird möglichst <b>2× pro Woche</b> trainiert – das ist bei gleichem Volumen mindestens so gut wie 1× und verteilt die Last besser. Welche Aufteilung die App dir empfiehlt (⭐), hängt von dir ab:
        </p>
        <ul class="algo__list">
          <li>
            <b>Einsteiger:</b> Ganzkörper – jede Übung oft üben, Technik sitzt schneller.
          </li>
          <li>
            <b>Mit Vereinssport:</b> wenig Beintage (z. B. Ober/Unter/Ober), damit die Beine fürs Training und Spiel frisch sind.
          </li>
          <li>
            <b>Schwerpunkt Po/Beine oder Arme:</b> Aufteilungen mit mehr Tagen für diese Muskeln.
          </li>
          <li>
            <b>Ohne Geräte:</b> eigener Ganzkörper-Plan mit Körpergewicht.
          </li>
        </ul>
      </Sec>

      <Sec icon={<Gauge size={18} />} title="5. Dein Ziel: Wiederholungen, Sätze, Pausen">
        <p>
          Muskeln wachsen in einem breiten Bereich von ca. 5–30 Wiederholungen ähnlich gut – <b>solange die Sätze nah ans Muskelversagen gehen</b>. Für Maximalkraft sind dagegen schwere Lasten (≤ 6 Wdh.) klar im Vorteil. Deshalb stellt dein Ziel die Bereiche ein:
        </p>
        <table class="algo__table">
          <thead>
            <tr>
              <th>Ziel</th>
              <th>Hauptübungen</th>
              <th>Pausen</th>
            </tr>
          </thead>
          <tbody>
            {TRAIN_GOALS.map((g) => (
              <tr class={goalOf(setup).id === g.id ? 'algo__now' : ''}>
                <td>
                  <b>{g.label}</b>
                </td>
                <td>{g.text}</td>
                <td>
                  {g.rest[0] >= 120 ? `${String(g.rest[0] / 60).replace('.', ',')} Min` : `${g.rest[0]} s`} / {g.rest[1]} s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="small muted">Sehr schwere Wiederholungen (3–6) gibt es nur bei Langhantel-Grundübungen; Maschinen und rumänisches Kreuzheben bleiben bei 5–8. Längere Pausen ermöglichen mehr Leistung im nächsten Satz, kürzere sparen Zeit. Wechselst du das Ziel, rechnet die App deine Gewichte über das geschätzte Maximum passend um.</p>
      </Sec>

      <Sec icon={<SlidersHorizontal size={18} />} title="6. Individuell: Ausstattung, Beschwerden, Schwerpunkte">
        <ul class="algo__list">
          <li>
            <b>Ausstattung:</b> Fehlt ein Gerät, nimmt die App automatisch eine Übung für denselben Muskel, die mit deinen Geräten geht (z. B. Latzug → Klimmzüge oder Rudern unter dem Tisch).
          </li>
          <li>
            <b>Dauerhafte Beschwerden:</b> Übungen, die die Stelle stark belasten, werden gegen schonende Varianten getauscht – wie bei Schmerzen in der Tagesform, nur dauerhaft.
          </li>
          <li>
            <b>Schwerpunkt-Muskeln:</b> mehr Volumen = mehr Wachstum. Bis zu 2 Übungen pro Einheit bekommen 1 Satz mehr, dazu kommt bei Bedarf eine passende Zusatzübung.
          </li>
          <li>
            <b>„Nicht mehr vorschlagen“:</b> Übungen, die du nicht magst oder die dein Gym nicht hat, ersetzt die App überall automatisch.
          </li>
        </ul>
      </Sec>

      <Sec icon={<Flame size={18} />} title="7. Trainingsmethoden">
        <ul class="algo__list">
          <li>
            <b>Aufwärmsätze:</b> Vor Hauptübungen 2–3 leichtere Sätze (ca. 40–80 %) – bereitet Gelenke und Technik vor und macht die Arbeitssätze besser. Zählen nicht als Sätze.
          </li>
          <li>
            <b>Supersätze:</b> Zwei Nebenübungen für verschiedene Muskeln im Wechsel, Pause erst nach beiden. Spart rund ein Viertel der Zeit bei gleichem Effekt. Standard beim Ziel „Fitness“, sonst in den Einstellungen.
          </li>
          <li>
            <b>Schnellkraft (Sprünge, Würfe):</b> wenige, explosive Wiederholungen mit voller Pause, immer am Anfang – nie im Wiedereinstieg oder an schlechten Tagen.
          </li>
          <li>
            <b>Abwechslung (optional):</b> Nebenübungen wechseln jede zweite Zyklusrunde zu einer Variante. Hauptübungen bleiben, damit dein Fortschritt messbar bleibt – zu viel Wechsel bremst die Steigerung.
          </li>
          <li>
            <b>Scheibenrechner:</b> Bei Langhantel-Übungen zeigt die App, welche Scheiben pro Seite auf die Stange gehören.
          </li>
        </ul>
      </Sec>

      <Sec icon={<TrendingUp size={18} />} title="8. Stagnation & Ermüdung">
        <ul class="algo__list">
          <li>
            <b>Stagnation:</b> Gibt es bei einer Übung 4 Einheiten hintereinander keinen Fortschritt (weder Gewicht noch Wiederholungen noch geschätztes Maximum), macht die App einen <b>Reset</b>: ~10 % leichter, dann in 2–3 Einheiten wieder vorbei. Bei Körpergewichts-Übungen schlägt sie eine schwerere Variante vor.
          </li>
          <li>
            <b>Ermüdung:</b> Warst du an 3 von 7 Tagen müde, hast schlecht geschlafen oder starken Muskelkater – oder fallen mehrere Übungen unter deinen Bereich –, bietet die App eine <b>vorgezogene Entlastungswoche</b> an. Danach startet ein neuer Zyklus.
          </li>
          <li>
            <b>Fortschritt sichtbar:</b> Nach jedem Training siehst du Rekorde und den Vergleich zum letzten Mal, im Training-Tab deinen Kraftverlauf der letzten 8 Wochen.
          </li>
        </ul>
      </Sec>

      <Sec icon={<HeartPulse size={18} />} title="9. Tagesform, Schmerzen & Erholung">
        <ul class="algo__list">
          <li>
            <b>Wenig Schlaf / Energie:</b> leichte Version (1 Satz weniger, ~10 % weniger Gewicht). Zählt nicht als Maßstab für die nächste Steigerung.
          </li>
          <li>
            <b>Top-Form:</b> bei Hauptübungen 1 Wdh. mehr anpeilen.
          </li>
          <li>
            <b>Schmerzen ab 4/10:</b> belastende Übungen werden gegen schonende getauscht, ab 7/10 fallen sie weg.
          </li>
          <li>
            <b>Längere Pause (Urlaub, Krankheit, Prüfungen):</b> Die App erkennt die Pause automatisch:
            <table class="algo__table" style={{ marginTop: '6px' }}>
              <thead>
                <tr>
                  <th>Pause</th>
                  <th>Wiedereinstieg</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10–20 Tage</td>
                  <td>1 Einheit mit −10 %, 1 Satz weniger</td>
                </tr>
                <tr>
                  <td>3–6 Wochen</td>
                  <td>2 Einheiten: −20 %, dann −10 %; Zyklus startet bei Woche 1</td>
                </tr>
                <tr>
                  <td>über 6 Wochen</td>
                  <td>3 Einheiten: −30 %, −20 %, −10 %, max. 2 Sätze; Zyklus bei Woche 1</td>
                </tr>
              </tbody>
            </table>
            Danach geht es direkt mit deinen alten Gewichten weiter. Kraft hält sich etwa 2–3 Wochen gut und kommt nach Pausen schnell zurück – der vorsichtige Start schützt vor starkem Muskelkater und überlasteten Sehnen. Einzelne Übungen, die du über 4 Wochen nicht gemacht hast, starten ~10 % leichter.
          </li>
          <li>
            <b>Krank:</b> Mit „Krank melden“ pausiert der Plan. Faustregel („Neck Check“): Beschwerden nur oberhalb des Halses ohne Fieber → lockere Bewegung ok; Fieber, Husten, Gliederschmerzen → kein Sport. Danach startest du leichter: ab 3 Tagen krank 1 Einheit −10 %, mit Fieber oder ab 7 Tagen 2 Einheiten (−20 %, −10 %, weniger Sätze). Sprünge kommen erst danach wieder dazu.
          </li>
          <li>
            <b>Urlaub:</b> Ohne Gym gibt es einen Erhaltungsplan (Körpergewicht oder Kurzhanteln, plus Laufen nach Wunsch). Studien zeigen: Schon etwa ⅓ des normalen Volumens und 1–2 Einheiten pro Woche erhalten Kraft und Muskeln, wenn die Sätze fordernd sind. Wer im Urlaub so weitertrainiert, braucht danach nur einen kurzen Wiedereinstieg.
          </li>
          <li>
            <b>Deload (Woche 5):</b> halbe Sätze, leichter. Die Studienlage dazu ist noch dünn – kurze Entlastung kostet aber keine Muskeln und hilft Gelenken und Kopf, gerade neben Vereinssport.
          </li>
        </ul>
      </Sec>

      {hasSport(setup) && (
        <Sec icon={<Shield size={18} />} title={`10. Abgestimmt auf ${sp.name}`}>
          <ul class="algo__list">
            {SPORT_PROFILE[sp.id] && setup.sportFocus !== false && (
              <li>
                <b>Schwerpunkt für {sp.name}:</b> {SPORT_PROFILE[sp.id].focus}. Passende Übungen werden in deine Einheiten eingebaut
                {SPORT_PROFILE[sp.id].athletic.length ? ' – Sprünge bzw. Würfe am Anfang der Bein-Tage, solange du frisch bist (wenige, explosive Wiederholungen, volle Pause)' : ''}. Abschaltbar unter „Plan anpassen“.
              </li>
            )}
            <li>Keine schweren Bein-Einheiten am Tag vor dem {sp.name}-Training.</li>
            {sp.games && (
              <li>
                <b>Spielwochen (Saison):</b> Am Tag vor dem Spiel kein Gym, Beine mit mindestens 48 h Abstand zum Spiel, am Tag danach keine Beine (Regeneration). Beine bekommen in Spielwochen 1 Satz weniger pro Übung, die Gewichte bleiben – Studien zeigen, dass schon etwa ein Drittel des Volumens reicht, um Kraft zu halten, solange die Intensität hoch bleibt. Passt eine Einheit nicht sinnvoll in die Woche, fällt sie weg.
              </li>
            )}
            {sp.overhead && (
              <li>
                <b>Schulter-Vorbeugung:</b> Außenrotation & Face Pulls – in Studien mit Handballern senkte so ein Programm Schulterprobleme deutlich.
              </li>
            )}
            {sp.sprint && (
              <li>
                <b>Beinbeuger & Leiste:</b> Nordic Curls und Copenhagen Plank – beide senken in Studien Zerrungen bzw. Leistenprobleme stark.
              </li>
            )}
          </ul>
        </Sec>
      )}

      <Sec icon={<BookOpen size={18} />} title="Quellen">
        <ul class="algo__refs small">
          <li>Schoenfeld, Ogborn & Krieger (2017): Dosis-Wirkung von Trainingsvolumen auf Muskelwachstum. J Sports Sci.</li>
          <li>Pelland et al. (2024): Meta-Regression zu Volumen & Frequenz (Hypertrophie, Kraft). SportRxiv.</li>
          <li>Schoenfeld, Ogborn & Krieger (2016): Trainingsfrequenz und Hypertrophie. Sports Med.</li>
          <li>Schoenfeld et al. (2017): Niedrige vs. hohe Lasten. J Strength Cond Res.</li>
          <li>Refalo et al. (2023): Nähe zum Muskelversagen und Hypertrophie. Sports Med.</li>
          <li>Plotkin et al. (2022): Progression über Wiederholungen vs. Gewicht. PeerJ.</li>
          <li>Coleman et al. (2024): Effekte einer Deload-Woche. PeerJ.</li>
          <li>Bosquet et al. (2013): Trainingspause und Muskelleistung – Meta-Analyse. Scand J Med Sci Sports.</li>
          <li>Ogasawara et al. (2013): Durchgehendes vs. periodisches Krafttraining mit Pausen. Eur J Appl Physiol.</li>
          <li>Bickel, Cross & Bamman (2011): Mindestdosis zum Erhalt von Kraft und Muskelmasse. Med Sci Sports Exerc.</li>
          <li>Spiering et al. (2021): Minimale Trainingsdosis zum Erhalt der Leistungsfähigkeit. J Strength Cond Res.</li>
          <li>Andersson et al. (2017): Schulter-Präventionsprogramm im Handball. Br J Sports Med.</li>
          <li>van Dyk et al. (2019): Nordic Hamstring halbiert Oberschenkelzerrungen. Br J Sports Med.</li>
          <li>Harøy et al. (2019): Copenhagen-Adduktorenprogramm gegen Leistenprobleme. Br J Sports Med.</li>
          <li>Markovic (2007): Plyometrisches Training verbessert die Sprunghöhe – Meta-Analyse. Br J Sports Med.</li>
          <li>Hewett et al. (1999): Sprung- und Landetraining senkt Knieverletzungen bei Sportlerinnen. Am J Sports Med.</li>
          <li>Hupperets, Verhagen & van Mechelen (2009): Balancetraining gegen erneutes Umknicken. BMJ.</li>
          <li>Eichner (1993): Infekt und Sport – der „Neck Check“. Phys Sportsmed.</li>
          <li>Lopez et al. (2021): Trainingslast, Muskelwachstum und Kraft – Netzwerk-Meta-Analyse. Med Sci Sports Exerc.</li>
          <li>Weakley et al. (2017): Traditionelle Sätze vs. Supersätze – Belastung und Zeitbedarf. Eur J Appl Physiol.</li>
          <li>Kassiano et al. (2022): Bringt Übungsvariation mehr Muskelwachstum? – Systematischer Review. J Strength Cond Res.</li>
          <li>Fradkin, Zazryn & Smoliga (2010): Aufwärmen und Leistung – Meta-Analyse. J Strength Cond Res.</li>
        </ul>
        <p class="small muted">Hinweis: Das ist eine allgemeine Trainingslogik, keine medizinische Beratung. Bei anhaltenden Schmerzen lieber ärztlich oder physiotherapeutisch abklären lassen.</p>
      </Sec>
    </Sheet>
  );
}

export function RirSheet() {
  return (
    <Sheet title="Was ist RIR?">
      <div class="rirlegend">
        {[0, 1, 2, 3].map((v) => (
          <span>
            <b>{v === 3 ? '3+' : v}</b> <Battery v={v} />
          </span>
        ))}
      </div>
      <p>
        <b>Reps in Reserve (RIR)</b> gibt an, <b>wie viele saubere Wiederholungen du am Ende eines Satzes noch geschafft hättest</b>.
      </p>
      <p class="muted">RIR 0 heißt: keine weitere Wiederholung mehr möglich – du bist am Limit. RIR 2 heißt: zwei wären noch gegangen.</p>
      <section class="card algo__sec">
        <h3>So nutzt die App deine Angabe</h3>
        <ul class="algo__list">
          <li>
            <b>Viel leichter als geplant</b> (z. B. 3+ statt 2): nächstes Mal sofort mehr Gewicht.
          </li>
          <li>
            <b>RIR 0, obwohl Reserve geplant war:</b> nächstes Mal gleiches Ziel statt noch mehr.
          </li>
          <li>
            <b>Mehrere Sätze bis zum Limit:</b> Hinweis, etwas Reserve zu lassen – das spart Erholung.
          </li>
          <li>Kein Eintrag? Dann steigert die App wie bisher nur über die Wiederholungen.</li>
        </ul>
      </section>
      <p class="small muted">Das Ziel-RIR hängt von der Zykluswoche ab (3 → 2 → 1, Deload 4). Halte es möglichst ein – so trainierst du hart genug für Wachstum, ohne dich auszubrennen.</p>
    </Sheet>
  );
}
