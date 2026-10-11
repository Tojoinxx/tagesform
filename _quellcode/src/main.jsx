import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { useS, boot, setS, S, patchDay, openSheet, toast } from './lib/store.js';
import { todayKey, lsGet, timeOfDayMeal } from './lib/util.js';
import { useRoute, nav } from './ui/router.js';
import { Today } from './ui/today.jsx';
import { Week } from './ui/week.jsx';
import { Training } from './ui/training.jsx';
import { Workout } from './ui/workout.jsx';
import { Settings, applyTheme } from './ui/settings.jsx';
import { Onboarding } from './ui/onboarding.jsx';
import { Login } from './ui/login.jsx';
import { Toast } from './ui/common.jsx';
import { Logo } from './ui/logo.jsx';
import { AddSheet, AmountSheet, EntrySheet, CustomSheet, PhotoSheet, LabelSheet, BarcodeSheet } from './ui/addfood.jsx';
import { SuggestSheet } from './ui/suggest.jsx';
import { ExerciseSheet, SessionPage, ExercisePicker } from './ui/exui.jsx';
import { AlgoSheet, RirSheet } from './ui/algo.jsx';
import { ImportSheet } from './ui/importsheet.jsx';
import { WellnessSheet } from './ui/form.jsx';
import { House, ChartColumn, Dumbbell, Settings as SettingsIcon } from 'lucide-preact';

applyTheme(lsGet('tf.theme', 'system'));
setS({ day: todayKey() });

const SHEETS = { add: AddSheet, amount: AmountSheet, entry: EntrySheet, custom: CustomSheet, photo: PhotoSheet, label: LabelSheet, barcode: BarcodeSheet, suggest: SuggestSheet, exercise: ExerciseSheet, algo: AlgoSheet, pick: ExercisePicker, import: ImportSheet, wellness: WellnessSheet, rir: RirSheet };

function SheetHost() {
  const s = useS();
  if (!s.sheet) return null;
  const C = SHEETS[s.sheet.name];
  return C ? <C key={s.sheet.id} {...s.sheet.props} /> : null;
}

const TABS = [
  { path: '/', label: 'Heute', Icon: House },
  { path: '/woche', label: 'Woche', Icon: ChartColumn },
  { path: '/training', label: 'Training', Icon: Dumbbell },
  { path: '/einstellungen', label: 'Einstellungen', Icon: SettingsIcon },
];

/** Direkt-Links für iPhone-Kurzbefehle, z. B. #/?do=wasser&ml=250 */
function runAction(q) {
  const k = todayKey();
  const meal = q.mahlzeit || timeOfDayMeal();
  setS({ day: k });
  switch (q.do) {
    case 'wasser': {
      const ml = Math.max(50, Math.min(2000, Number(q.ml) || 250));
      patchDay(k, (d) => ({ waterMl: (d.waterMl || 0) + ml }));
      toast(`+${ml} ml Wasser 💧`);
      break;
    }
    case 'obst':
      patchDay(k, (d) => ({ fvExtra: (d.fvExtra || 0) + 1 }));
      toast('+1 Portion Obst/Gemüse 🍎');
      break;
    case 'essen':
    case 'foto':
      openSheet('add', { dayKey: k, meal });
      break;
    case 'scan':
      openSheet('barcode', { dayKey: k, meal });
      break;
    case 'vorschlag':
      openSheet('suggest', { dayKey: k });
      break;
    case 'training':
      return nav('/training');
    case 'woche':
      return nav('/woche');
    default:
      return;
  }
  history.replaceState(null, '', location.pathname + location.search + '#/');
}

function Shell() {
  const r = useRoute();
  useEffect(() => {
    if (r.query.do) runAction(r.query);
  }, [r.query.do, r.query.ml, r.query.mahlzeit]);
  const page =
    r.path === '/woche' ? <Week query={r.query} key={r.query.last || 'w'} /> : r.path === '/training' || r.path === '/tagesform' ? <Training /> : r.path === '/workout' ? <Workout /> : r.path === '/einheit' ? <SessionPage query={r.query} key={r.query.s} /> : r.path === '/einstellungen' ? <Settings query={r.query} /> : <Today />;
  return (
    <>
      <main class="main">{page}</main>
      <nav class="tabbar" aria-label="Navigation">
        {TABS.map(({ path, label, Icon }) => (
          <button
            class={'tab' + (r.path === path || (path === '/training' && (r.path === '/workout' || r.path === '/einheit')) ? ' tab--on' : '')}
            onClick={() => {
              if (path === '/' && r.path === '/') setS({ day: todayKey() });
              nav(path);
            }}
            aria-current={r.path === path ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <SheetHost />
    </>
  );
}

function Splash() {
  return (
    <div class="splash">
      <Logo size={72} />
    </div>
  );
}

function App() {
  const s = useS();
  let body;
  if (s.auth.status === 'loading') body = <Splash />;
  else if (s.auth.status === 'out') body = <Login />;
  else if (!s.profileLoaded) body = <Splash />;
  else if (!s.profile || !s.profile.onboarded) body = <Onboarding />;
  else body = <Shell />;
  return (
    <>
      {body}
      <Toast />
    </>
  );
}

render(<App />, document.getElementById('app'));
boot();

// Tageswechsel (App bleibt über Nacht offen)
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastToday) {
    if (S.day === lastToday) setS({ day: todayKey() });
    lastToday = todayKey();
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
