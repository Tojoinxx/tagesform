import { useS, saveTraining, S, toast } from '../lib/store.js';
import { CYCLE, cycleWeek, weeklyVolume, MUSCLE_LABEL, setupOf, sportOf, hasSport } from '../lib/training.js';
import { todayKey, n1 } from '../lib/util.js';
import { Sheet } from './common.jsx';
import { TrendingUp, Repeat, Layers, Gauge, HeartPulse, Shield, BookOpen, CalendarRange } from 'lucide-preact';

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
        Der Plan folgt dem, was die Trainingswissenschaft zum Muskelaufbau gut belegt hat: <b>genug harte Sätze</b>, <b>jeder Muskel ca. 2× pro Woche</b>, <b>nah ans Muskelversagen</b> und <b>stetige Steigerung</b> – plus Erholung, wenn der Körper sie braucht.
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
              <span class="vol__m">{MUSCLE_LABEL[m]}</span>
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
          Jeder Muskel wird etwa <b>2× pro Woche</b> trainiert – das ist bei gleichem Volumen mindestens so gut wie 1× und verteilt die Last besser. Deshalb: 2× = Ganzkörper, 3× = Oberkörper/Unterkörper/Oberkörper, 4× = je 2× Ober- und Unterkörper.
        </p>
      </Sec>

      <Sec icon={<Gauge size={18} />} title="5. Intensität & Wiederholungen">
        <p>
          Muskeln wachsen in einem breiten Bereich von ca. 5–30 Wiederholungen ähnlich gut – <b>solange die Sätze nah ans Muskelversagen gehen</b>. Schwere Grundübungen nutzen 5–10 Wdh. (auch für Kraft), kleinere Übungen 10–15 Wdh. (gelenkschonend). Pausen: ca. 2 Min. bei Grundübungen, 75 Sek. sonst – längere Pausen ermöglichen mehr Leistung im nächsten Satz.
        </p>
      </Sec>

      <Sec icon={<HeartPulse size={18} />} title="6. Tagesform, Schmerzen & Erholung">
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
            <b>Deload (Woche 5):</b> halbe Sätze, leichter. Die Studienlage dazu ist noch dünn – kurze Entlastung kostet aber keine Muskeln und hilft Gelenken und Kopf, gerade neben Vereinssport.
          </li>
        </ul>
      </Sec>

      {hasSport(setup) && (
        <Sec icon={<Shield size={18} />} title={`7. Abgestimmt auf ${sp.name}`}>
          <ul class="algo__list">
            <li>Keine schweren Bein-Einheiten am Tag vor {sp.name} oder Spiel.</li>
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
          <li>Andersson et al. (2017): Schulter-Präventionsprogramm im Handball. Br J Sports Med.</li>
          <li>van Dyk et al. (2019): Nordic Hamstring halbiert Oberschenkelzerrungen. Br J Sports Med.</li>
          <li>Harøy et al. (2019): Copenhagen-Adduktorenprogramm gegen Leistenprobleme. Br J Sports Med.</li>
        </ul>
        <p class="small muted">Hinweis: Das ist eine allgemeine Trainingslogik, keine medizinische Beratung. Bei anhaltenden Schmerzen lieber ärztlich oder physiotherapeutisch abklären lassen.</p>
      </Sec>
    </Sheet>
  );
}
