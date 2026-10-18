// Datenschutz & Privatsphäre: Speicherort der Fotos, Sicherheits-Check, wer worauf zugreifen kann, Export & Löschen
import { useEffect, useState } from 'preact/hooks';
import { useS, S, toast, exportAll, wipeAll } from '../lib/store.js';
import { picsInCloud, movePics, checkList } from '../lib/checks.js';
import { Download, ShieldCheck, ShieldAlert, Shield, Trash2, Lock } from 'lucide-preact';
import { Spinner } from './common.jsx';

function RulesCheck() {
  const s = useS();
  const [st, setSt] = useState('checking');
  useEffect(() => {
    if (s.mode !== 'cloud') return setSt('local');
    import('../lib/firebase.js').then((fb) => fb.rulesCheck().then(setSt, () => setSt('unknown')));
  }, [s.mode]);
  if (st === 'local') return null;
  if (st === 'checking')
    return (
      <div class="notice small">
        <Spinner size={16} /> Prüfe, ob deine Daten vor anderen Nutzern geschützt sind …
      </div>
    );
  if (st === 'ok')
    return (
      <div class="notice notice--ok small">
        <ShieldCheck size={18} />
        <span>
          <b>Geschützt:</b> Andere Nutzer dieser App können deine Daten nicht lesen (gerade geprüft).
        </span>
      </div>
    );
  return (
    <div class="notice notice--warn small">
      <ShieldAlert size={18} />
      <span>
        {st === 'open' ? (
          <>
            <b>Achtung:</b> Die Datenbank-Regeln sind offen – andere Nutzer könnten fremde Daten lesen. Sag dem Betreiber der App Bescheid (Firestore → Regeln: nur <code>request.auth.uid == uid</code> erlauben).
          </>
        ) : (
          'Schutz konnte gerade nicht geprüft werden (offline?).'
        )}
      </span>
    </div>
  );
}

export function PrivacyCard() {
  const s = useS();
  const cloud = picsInCloud();
  const nChecks = checkList().length;
  const [busy, setBusy] = useState(null);
  const [wipe, setWipe] = useState({ open: false, txt: '', account: false });

  const toggleCloud = async (toCloud) => {
    setBusy('pics');
    try {
      const n = await movePics(toCloud);
      toast(toCloud ? `${n} Fotos ins Konto verschoben` : `${n} Fotos aufs Handy geholt und im Konto gelöscht`);
    } finally {
      setBusy(null);
    }
  };

  const doWipe = async () => {
    setBusy('wipe');
    try {
      const r = await wipeAll({ account: wipe.account });
      if (r.account === 'elsewhere') toast('Daten gelöscht. Das Anmelde-Konto wird noch von einer anderen App genutzt und bleibt bestehen.');
      else toast(r.account ? 'Alles gelöscht – auch dein Konto.' : 'Alle Tagesform-Daten gelöscht.');
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      const code = String((e && e.code) || '');
      toast(code.includes('requires-recent-login') ? 'Daten sind gelöscht. Zum Löschen des Kontos bitte ab- und wieder anmelden und nochmal tippen.' : 'Löschen ging nicht: ' + ((e && e.message) || e), 'error');
      setBusy(null);
    }
  };

  return (
    <section class="card form privacy">
      <RulesCheck />

      <label class="toggle">
        <span>
          <b>Formcheck-Fotos nur auf diesem Handy</b>
          <small class="muted">
            {cloud
              ? 'Aus: Fotos liegen verschlüsselt in deinem Konto und sind auf all deinen Geräten da.'
              : 'An (empfohlen): Fotos werden nie hochgeladen – nicht mal der Betreiber der App kann sie sehen. Werte wie Gewicht & Körperfett synchronisieren trotzdem.'}
            {!cloud && ' Achtung: Löschst du die App vom Home-Bildschirm, sind die Fotos weg – wichtige Fotos lang drücken → „In Fotos sichern“.'}
          </small>
        </span>
        {busy === 'pics' ? <Spinner size={18} /> : <input type="checkbox" checked={!cloud} disabled={s.mode === 'local'} onChange={(e) => toggleCloud(!e.currentTarget.checked)} />}
      </label>

      <details class="more">
        <summary>
          <Shield size={14} /> Wo liegen meine Daten – und wer kann theoretisch zugreifen?
        </summary>
        <div class="privacy__list small">
          <p>
            <b>🔐 Du</b> – auf allen Geräten, auf denen du angemeldet bist. Beim Abmelden wird der Zwischenspeicher auf dem Gerät gelöscht.
          </p>
          <p>
            <b>🧑‍💻 Betreiber der App</b> (wer das Firebase-Projekt verwaltet) – sieht in der Firebase-Konsole technisch alles, was in deinem Konto gespeichert ist: E-Mail, Essen, Training, Gewicht, Körperfett, Notizen und deinen KI-Schlüssel. <u>Nicht</u> die Formcheck-Fotos, solange „nur auf diesem Handy“ an ist.
          </p>
          <p>
            <b>☁️ Google (Firebase)</b> – betreibt die Server, auf denen dein Konto liegt. Daten werden verschlüsselt übertragen und gespeichert; Google nutzt sie laut eigenen Bedingungen nicht für Werbung und greift nur für Betrieb, Sicherheit oder auf gesetzliche Anordnung zu. Streng genommen kann Google als Betreiber technisch auf die Server zugreifen, und als US-Firma kann Google auch von US-Behörden zur Herausgabe verpflichtet werden (z. B. CLOUD Act) – das gilt für fast alle Cloud-Apps.
          </p>
          <p>
            <b>🤖 Google Gemini (KI)</b> – bekommt nur, was du aktiv auslöst: Essensfoto, Nährwerttabelle, Sprachaufnahme, Text, Wochenwerte für das Fazit, Formcheck-Fotos & -Werte. Mit Wohnsitz in der EU gilt laut Google auch beim kostenlosen Schlüssel: keine Nutzung fürs KI-Training, nur kurze Speicherung zur Missbrauchserkennung. Außerhalb der EU darf Google beim kostenlosen Tarif Inhalte zur Verbesserung nutzen und von Menschen prüfen lassen.
          </p>
          <p>
            <b>🍎 Open Food Facts</b> – bekommt Suchbegriffe und Barcodes, wenn du online suchst oder scannst. Kein Name, kein Konto (nur die IP-Adresse, wie bei jeder Webseite).
          </p>
          <p>
            <b>🐙 GitHub</b> – liefert nur das Programm aus und sieht dabei die IP-Adresse. Deine Daten liegen dort nicht.
          </p>
          <p>
            <b>❤️ Apple Health / Kurzbefehle</b> – läuft nur auf deinem iPhone. Tagesform liest nur, was dein Kurzbefehl übergibt.
          </p>
          <p class="muted">Kein Tracking, keine Werbung, keine Analyse-Tools, keine Weitergabe an Dritte.</p>
        </div>
      </details>

      <button
        class="btn"
        onClick={() => {
          const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `tagesform-export-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }}
      >
        <Download size={16} /> Meine Daten herunterladen (JSON)
      </button>

      {!wipe.open ? (
        <button class="btn btn--danger" onClick={() => setWipe({ open: true, txt: '', account: false })}>
          <Trash2 size={16} /> Alle meine Daten löschen
        </button>
      ) : (
        <div class="notice notice--warn privacy__wipe">
          <p>
            <b>Wirklich alles löschen?</b> Essen, Training, Gewichte, Plan, eigene Produkte, KI-Schlüssel{nChecks ? `, ${nChecks} Formchecks samt Fotos` : ''} – im Konto und auf diesem Handy. Das lässt sich nicht rückgängig machen. Tipp: vorher „Meine Daten herunterladen“.
          </p>
          {s.mode === 'cloud' && (
            <label class="check">
              <input type="checkbox" checked={wipe.account} onChange={(e) => setWipe((w) => ({ ...w, account: e.currentTarget.checked }))} />
              <span>Auch mein Anmelde-Konto (E-Mail) löschen</span>
            </label>
          )}
          <input class="input" placeholder="Zum Bestätigen LÖSCHEN eintippen" value={wipe.txt} onInput={(e) => setWipe((w) => ({ ...w, txt: e.currentTarget.value }))} autoCapitalize="characters" />
          <div class="row">
            <button class="btn btn--sm" onClick={() => setWipe({ open: false, txt: '', account: false })} disabled={busy === 'wipe'}>
              Abbrechen
            </button>
            <button class="btn btn--sm btn--dangerfill" disabled={wipe.txt.trim().toUpperCase() !== 'LÖSCHEN' || busy === 'wipe'} onClick={doWipe}>
              {busy === 'wipe' ? <Spinner size={16} /> : <Trash2 size={16} />} Endgültig löschen
            </button>
          </div>
        </div>
      )}
      <p class="small muted">
        <Lock size={12} /> Fotos, Sprache & Texte gehen nur an die KI, wenn du eine KI-Funktion antippst – nie automatisch im Hintergrund.
      </p>
    </section>
  );
}
