// Statistik: Wochen-Check (Ernährung, Gewicht) und Training (Fortschritt, Kraftverlauf, letzte Einheiten)
import { useS } from '../lib/store.js';
import { Seg } from './common.jsx';
import { Week } from './week.jsx';
import { ProgressCard, StrengthCharts } from './progress.jsx';
import { WorkoutHistoryCard } from './wedit.jsx';
import { Last7Card } from './form.jsx';
import { workoutLog } from '../lib/training.js';
import { nav } from './router.js';
import { Dumbbell } from 'lucide-preact';

function TrainingStats() {
  useS();
  const any = workoutLog().some((w) => (w.items || []).length);
  return (
    <div class="page">
      <header class="pagehead">
        <h1>Fortschritt</h1>
      </header>
      {!any && (
        <section class="card empty">
          <Dumbbell size={28} class="muted" />
          <p>
            <b>Noch keine Trainings</b>
          </p>
          <p class="small muted">Nach deinem ersten Training siehst du hier Fortschritt, Kraftverlauf je Übung und deine letzten Einheiten.</p>
          <button class="btn btn--primary" onClick={() => nav('/training')}>
            Zum Training
          </button>
        </section>
      )}
      <ProgressCard />
      <StrengthCharts />
      <WorkoutHistoryCard />
      <Last7Card />
    </div>
  );
}

export function Stats({ query = {} }) {
  const tab = query.tab === 'training' ? 'training' : 'woche';
  return (
    <div class="page">
      <div class="stattabs">
        <Seg
          options={[
            { id: 'woche', label: 'Wochen-Check' },
            { id: 'training', label: 'Training' },
          ]}
          value={tab}
          onChange={(t) => nav('/woche' + (t === 'training' ? '?tab=training' : ''))}
        />
      </div>
      {tab === 'woche' ? <Week query={query} key={query.last || 'w'} /> : <TrainingStats />}
    </div>
  );
}
