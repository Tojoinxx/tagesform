import { useState, useEffect } from 'preact/hooks';
import { useS, saveProfile, toast, logout, exportAll, S, deleteFood } from '../lib/store.js';
import { num, lsGet, lsSet } from '../lib/util.js';
import { BodyFields, ActivityFields, GoalFields, TargetsCard, PrefsFields, AiSetup } from './profile.jsx';
import { Seg } from './common.jsx';
import { Download, LogOut, Smartphone, Bell, Trash2 } from 'lucide-preact';

export const VERSION = '1.0.0';

export function applyTheme(t) {
  const el = document.documentElement;
  if (!t || t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

export function Settings({ query }) {
  const s = useS();
  const [p, setP] = useState(() => ({ ...(s.profile || {}) }));
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState(lsGet('tf.theme', 'system'));
  const set = (patch) => {
    setP((o) => ({ ...o, ...patch }));
    setDirty(true);
  };
  useEffect(() => {
    if (query && query.ki) setTimeout(() => document.getElementById('ki')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  const save = () => {
    saveProfile({ ...p, heightCm: num(p.heightCm), weightKg: num(p.weightKg), birthYear: num(p.birthYear), trainingDays: num(p.trainingDays) });
    setDirty(false);
    toast('Gespeichert');
  };
  const own = Object.values(s.foods).filter((f) => f.source === 'custom');
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div class="page">
      <header class="pagehead">
        <h1>Einstellungen</h1>
      </header>

      <h4 class="sect sect--page">Über dich</h4>
      <section class="card form">
        <BodyFields p={p} set={set} />
        <ActivityFields p={p} set={set} />
        <GoalFields p={p} set={set} />
      </section>

      <h4 class="sect sect--page">Tagesziele</h4>
      <section class="card form">
        <TargetsCard p={p} set={set} />
      </section>

      <h4 class="sect sect--page">Essens-Vorlieben</h4>
      <section class="card form">
        <PrefsFields p={p} set={set} />
      </section>

      {dirty && (
        <div class="savebar">
          <button class="btn btn--primary btn--block btn--lg" onClick={save}>
            Änderungen speichern
          </button>
        </div>
      )}

      <h4 class="sect sect--page" id="ki">
        KI (Google Gemini, kostenlos)
      </h4>
      <section class="card form">
        <AiSetup />
      </section>

      {own.length > 0 && (
        <>
          <h4 class="sect sect--page">Eigene Produkte ({own.length})</h4>
          <section class="card">
            <ul class="flist">
              {own.map((f) => (
                <li class="frow">
                  <span class="frow__main frow__main--static">
                    <span class="frow__name">
                      {f.name}
                      <small class="muted">
                        {f.brand ? f.brand + ' · ' : ''}
                        {f.per100.kcal} kcal / 100 {f.unit || 'g'}
                        {f.barcode ? ' · ' + f.barcode : ''}
                      </small>
                    </span>
                  </span>
                  <button class="frow__quick" onClick={() => confirm(`„${f.name}“ löschen?`) && deleteFood(f.id)} aria-label={`${f.name} löschen`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h4 class="sect sect--page">App</h4>
      <section class="card form">
        <div class="field">
          <span class="field__label">Darstellung</span>
          <Seg
            value={theme}
            onChange={(v) => {
              setTheme(v);
              lsSet('tf.theme', v);
              applyTheme(v);
            }}
            options={[
              { id: 'system', label: 'Automatisch' },
              { id: 'light', label: 'Hell' },
              { id: 'dark', label: 'Dunkel' },
            ]}
          />
        </div>
        {!standalone && (
          <div class="notice">
            <Smartphone size={16} />
            <span>
              <b>Als App aufs iPhone:</b> In Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Dann startet Tagesform im Vollbild wie eine normale App.
            </span>
          </div>
        )}
        <div class="notice">
          <Bell size={16} />
          <span>
            <b>Sonntags-Erinnerung:</b> Leg dir in der Erinnerungen-App eine wöchentliche Erinnerung „Tagesform Wochen-Check“ für Sonntag 19 Uhr an – am Sonntag zeigt dir die App den Check direkt auf der Startseite.
          </span>
        </div>
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
          <Download size={16} /> Daten exportieren (JSON)
        </button>
      </section>

      <h4 class="sect sect--page">Konto</h4>
      <section class="card form">
        {s.mode === 'local' ? (
          <p class="small">
            Testmodus: Daten liegen nur auf diesem Gerät. <b>Für Sync zwischen iPhone und PC melde dich mit deinem Kartenschatz-Konto an.</b>
          </p>
        ) : (
          <p class="small">
            Angemeldet als <b>{s.auth.user && s.auth.user.email}</b> – Daten synchronisieren live zwischen deinen Geräten.
          </p>
        )}
        <button class="btn" onClick={() => (s.mode === 'local' || confirm('Abmelden?')) && logout()}>
          <LogOut size={16} /> {s.mode === 'local' ? 'Zur Anmeldung' : 'Abmelden'}
        </button>
      </section>
      <p class="small muted center">Tagesform {VERSION} · Lebensmitteldaten: Open Food Facts (ODbL)</p>
    </div>
  );
}
