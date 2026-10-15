import { useState } from 'preact/hooks';
import { toast } from '../lib/store.js';
import { healthOn, setHealthOn, sendDayToHealth, sendWorkoutToHealth, SC_FOOD, SC_WORKOUT, SC_IMPORT, appUrl } from '../lib/health.js';
import { Copy } from 'lucide-preact';

function Steps({ items }) {
  return (
    <ol class="hsteps">
      {items.map((x, i) => (
        <li>
          <span class="exsteps__n">{i + 1}</span>
          <span>{x}</span>
        </li>
      ))}
    </ol>
  );
}

/** Einstellungen: Apple Health über Kurzbefehle */
export function HealthSettings() {
  const [on, setOn] = useState(healthOn());
  const link = `${appUrl()}#/?do=health&gewicht=[Gewicht]&schlaf=[Schlaf]&schritte=[Schritte]&aktiv=[Aktiv]`;
  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      toast('Kopiert');
    } catch (e) {
      toast('Kopieren ging nicht – bitte manuell markieren', 'error');
    }
  };
  return (
    <section class="card form">
      <label class="toggle">
        <span>
          <b>Mit Apple Health verbinden</b>
          <small class="muted">Über die Kurzbefehle-App – Web-Apps dürfen nicht direkt auf Health zugreifen. Einmal einrichten, dann ein Tipp.</small>
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setHealthOn(e.currentTarget.checked);
            setOn(e.currentTarget.checked);
          }}
        />
      </label>
      {on && (
        <>
          <p class="small muted">Lege in der Kurzbefehle-App diese Kurzbefehle an. Die Namen müssen genau so heißen. Aktionen findest du über die Suche unten in der Kurzbefehle-App (Namen können je nach iOS-Version leicht abweichen).</p>

          <details class="more">
            <summary>1. „{SC_FOOD}“ – Essen & Trinken → Health</summary>
            <Steps
              items={[
                <>
                  Neuer Kurzbefehl, Name: <b>{SC_FOOD}</b>
                </>,
                <>
                  Aktion <b>„Wörterbuch abrufen“</b> – Eingabe: <i>Kurzbefehleingabe</i>
                </>,
                <>
                  <b>„Wörterbuchwert abrufen“</b> für Schlüssel <code>kcal</code>, danach <b>„Gesundheitsmuster protokollieren“</b>: Typ <i>Nahrungsenergie</i>, Wert = Wörterbuchwert, Einheit kcal
                </>,
                <>
                  Dasselbe für <code>eiweiss</code> → <i>Protein</i> (g), <code>kohlenhydrate</code> → <i>Kohlenhydrate</i> (g), <code>fett</code> → <i>Fett gesamt</i> (g), <code>wasser_ml</code> → <i>Wasser</i> (ml)
                </>,
                <>Beim ersten Start fragt iOS, ob der Kurzbefehl in Health schreiben darf → erlauben</>,
              ]}
            />
            <p class="small muted">Tipp: Am Abend einmal auf „Heute → An Health senden“ tippen. Mehrfach senden trägt die Werte doppelt ein.</p>
            <button class="btn btn--sm" onClick={() => sendDayToHealth()}>
              Testen: heute senden
            </button>
          </details>

          <details class="more">
            <summary>2. „{SC_WORKOUT}“ – Training → Health</summary>
            <Steps
              items={[
                <>
                  Neuer Kurzbefehl, Name: <b>{SC_WORKOUT}</b>
                </>,
                <>
                  <b>„Wörterbuch abrufen“</b> – Eingabe: <i>Kurzbefehleingabe</i>
                </>,
                <>
                  <b>„Wörterbuchwert abrufen“</b> für <code>start</code>, dann <b>„Datum abrufen“</b> aus diesem Wert
                </>,
                <>
                  <b>„Wörterbuchwert abrufen“</b> für <code>minuten</code>
                </>,
                <>
                  <b>„Workout protokollieren“</b>: Typ <i>Traditionelles Krafttraining</i>, Start = Datum, Dauer = minuten Minuten
                </>,
              ]}
            />
            <p class="small muted">Nach jedem Training erscheint in der Zusammenfassung „❤️ Health“. Trägt deine Apple Watch das Training schon ein, brauchst du diesen Kurzbefehl nicht.</p>
            <button class="btn btn--sm" onClick={() => sendWorkoutToHealth({ name: 'Test', minutes: 1, startedAt: Date.now() - 60000, finishedAt: Date.now() })}>
              Testen (1 Minute)
            </button>
          </details>

          <details class="more">
            <summary>3. „{SC_IMPORT}“ – Gewicht, Schlaf, Schritte → Tagesform</summary>
            <Steps
              items={[
                <>
                  Neuer Kurzbefehl, Name: <b>{SC_IMPORT}</b>
                </>,
                <>
                  <b>„Gesundheitsmuster suchen“</b>: Typ <i>Gewicht</i>, sortiert nach Startdatum (neueste zuerst), Limit 1 → Variable <i>Gewicht</i>
                </>,
                <>
                  <b>„Gesundheitsmuster suchen“</b>: <i>Schritte</i>, Startdatum ist heute → <b>„Statistik berechnen“</b> (Summe) → Variable <i>Schritte</i>
                </>,
                <>
                  Dasselbe mit <i>Aktive Energie</i> → Variable <i>Aktiv</i>
                </>,
                <>
                  Optional: <i>Schlafanalyse</i> der letzten Nacht als Stunden → Variable <i>Schlaf</i> (sonst den Teil <code>&schlaf=…</code> im Link weglassen)
                </>,
                <>
                  Aktion <b>„URL“</b> mit diesem Link, die Platzhalter in [ ] durch die Variablen ersetzen – danach <b>„URLs öffnen“</b>
                </>,
                <>
                  Automatisch jeden Morgen: Kurzbefehle → <b>Automation</b> → <i>Tageszeit</i> (z. B. 7:30) → „Sofort ausführen“
                </>,
              ]}
            />
            <div class="codebox">
              <code>{link}</code>
              <button class="iconbtn" onClick={() => copy(link)} aria-label="Link kopieren">
                <Copy size={16} />
              </button>
            </div>
            <p class="small muted">Der Link öffnet Tagesform in Safari – melde dich dort einmal mit deinem Konto an, dann landen die Werte automatisch auch in der App auf dem Home-Bildschirm. Gewicht erscheint im Wochen-Check, Schlaf wird in der Wellness-Abfrage vorausgewählt, Schritte & aktive Kalorien siehst du auf „Heute“.</p>
          </details>
        </>
      )}
    </section>
  );
}
