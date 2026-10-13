import { useState } from 'preact/hooks';
import { useS, saveProfile, S } from '../lib/store.js';
import { num } from '../lib/util.js';
import { BodyFields, ActivityFields, GoalFields, TargetsCard, PrefsFields, AiSetup } from './profile.jsx';
import { Logo } from './logo.jsx';
import { SetupCard } from './training.jsx';
import { ChevronLeft } from 'lucide-preact';

const STEPS = ['start', 'body', 'activity', 'goal', 'targets', 'prefs', 'training', 'ai'];

export function Onboarding() {
  useS();
  const [i, setI] = useState(0);
  const [p, setP] = useState(() => ({ sex: 'm', activity: 'leicht', goal: 'halten', pace: 'entspannt', prefs: { diet: 'Alles' }, ...(S.profile || {}) }));
  const set = (patch) => setP((o) => ({ ...o, ...patch }));
  const step = STEPS[i];
  const valid = {
    start: true,
    body: num(p.heightCm) > 120 && num(p.heightCm) < 230 && num(p.weightKg) > 35 && num(p.weightKg) < 250 && num(p.birthYear) > 1930 && num(p.birthYear) < new Date().getFullYear() - 10,
    activity: !!p.activity && p.trainingDays !== undefined && p.trainingDays !== '',
    goal: !!p.goal,
    targets: true,
    prefs: true,
    training: true,
    ai: true,
  }[step];
  const finish = () => {
    const clean = { ...p, heightCm: num(p.heightCm), weightKg: num(p.weightKg), birthYear: num(p.birthYear), trainingDays: num(p.trainingDays), onboarded: true };
    saveProfile(clean);
  };
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());

  return (
    <div class="onb">
      {i > 0 && (
        <div class="onb__top">
          <button class="iconbtn" onClick={() => setI(i - 1)} aria-label="Zurück">
            <ChevronLeft size={22} />
          </button>
          <div class="progress" aria-label={`Schritt ${i} von ${STEPS.length - 1}`}>
            <div style={{ width: (i / (STEPS.length - 1)) * 100 + '%' }} />
          </div>
          <span class="iconbtn-spacer" />
        </div>
      )}
      <div class="onb__body">
        {step === 'start' && (
          <div class="onb__hero">
            <Logo size={84} />
            <h1>Willkommen bei Tagesform</h1>
            <p class="muted">Dein eigener Fitness- und Ernährungs-Begleiter. Kostenlos, ohne Abo, deine Daten in deinem Konto.</p>
            <ul class="feat">
              <li>🍽️ Essen tracken – per Suche, Barcode oder Foto</li>
              <li>✨ „Was soll ich jetzt essen?“ – passend zu deinem Tag</li>
              <li>📊 Wochen-Check am Sonntag mit konkreten Tipps</li>
              <li>💪 Trainingsplan für Studio oder Zuhause – passt sich an Ziel, Tagesform, Sport & Schmerzen an</li>
            </ul>
            <p class="small muted">Dauert ca. 2 Minuten. Alles kannst du später in den Einstellungen ändern.</p>
          </div>
        )}
        {step === 'body' && (
          <>
            <h1>Über dich</h1>
            <p class="muted">Damit berechne ich deinen Kalorienbedarf.</p>
            <BodyFields p={p} set={set} />
          </>
        )}
        {step === 'activity' && (
          <>
            <h1>Alltag &amp; Training</h1>
            <ActivityFields p={p} set={set} />
          </>
        )}
        {step === 'goal' && (
          <>
            <h1>Was ist dein Ziel?</h1>
            <GoalFields p={p} set={set} />
          </>
        )}
        {step === 'targets' && (
          <>
            <h1>Deine Tagesziele</h1>
            <p class="muted">Ein guter Startpunkt. Passt du nach 2–3 Wochen an, wenn sich das Gewicht anders entwickelt als gewünscht.</p>
            <TargetsCard p={p} set={set} />
          </>
        )}
        {step === 'prefs' && (
          <>
            <h1>Was isst du gern?</h1>
            <p class="muted">Optional – macht die Essensvorschläge persönlicher.</p>
            <PrefsFields p={p} set={set} />
          </>
        )}
        {step === 'training' && (
          <>
            <h1>Dein Trainingsplan</h1>
            <p class="muted">Ob Studio, Zuhause oder ganz ohne Geräte: Die App stellt dir einen Plan zusammen – passend zu deinem Ziel, deiner Ausstattung, deinem Sport und deiner Erfahrung. Alles später änderbar.</p>
            <SetupCard embedded onDone={() => setI(i + 1)} />
          </>
        )}
        {step === 'ai' && (
          <>
            <h1>KI einschalten</h1>
            <p class="muted">Optional, aber empfohlen: für Foto-Scan vom Teller, Nährwerttabellen lesen und persönliche Vorschläge. Kostenlos über Google Gemini.</p>
            <AiSetup />
          </>
        )}
      </div>
      <div class="onb__foot">
        <button class={'btn btn--block btn--lg' + (step === 'training' ? '' : ' btn--primary')} onClick={next} disabled={!valid}>
          {step === 'start' ? 'Los geht’s' : step === 'training' ? 'Ohne Trainingsplan weiter' : step === 'ai' ? (S.ai && S.ai.apiKey ? 'Fertig' : 'Später einrichten & starten') : step === 'prefs' ? 'Weiter' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}
