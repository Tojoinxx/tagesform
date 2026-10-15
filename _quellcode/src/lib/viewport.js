// iOS-Fehler im Home-Bildschirm-Modus: Nach dem Schließen der Tastatur bleibt der Viewport
// manchmal „geschrumpft“ – die Navigationsleiste hängt dann mitten im Bild.
// Abhilfe: merken, wie hoch der Viewport war, und ihn bei Bedarf neu vermessen lassen
// (Root kurz aus- und wieder einblenden, Scrollposition bleibt).

const isTyping = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'TEXTAREA' || a.isContentEditable || (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file|color)$/i.test(a.type)));
};

export function installViewportFix() {
  if (typeof window === 'undefined') return;
  // Nur als App vom Home-Bildschirm – in Safari ändert die Werkzeugleiste die Höhe ganz normal
  const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (!standalone && !/[?&]vvtest/.test(location.search)) return;
  const portrait = () => (window.innerWidth < window.innerHeight ? 'p' : 'l');
  const maxH = { p: 0, l: 0 };
  const note = () => {
    if (!isTyping()) maxH[portrait()] = Math.max(maxH[portrait()], window.innerHeight);
  };
  note();

  let busy = false;
  const heal = () => {
    if (busy || isTyping()) return;
    const want = maxH[portrait()];
    const vv = window.visualViewport;
    const stuck = (want && want - window.innerHeight > 4) || (vv && Math.abs(vv.scale - 1) < 0.01 && window.innerHeight - vv.height > 40);
    if (!stuck) return;
    busy = true;
    const root = document.body;
    const y = window.scrollY;
    if (root) {
      root.style.display = 'none';
      void root.offsetHeight; // erzwingt Neuberechnung
      root.style.display = '';
    }
    window.scrollTo(window.scrollX, y);
    document.documentElement.style.setProperty('--vvfix', String(Date.now() % 2)); // Stil-Neuberechnung anstoßen
    setTimeout(() => {
      busy = false;
      note();
    }, 300);
  };
  const later = (ms) => () => setTimeout(heal, ms);

  window.addEventListener('resize', () => (note(), later(120)()));
  window.addEventListener('orientationchange', later(400));
  window.addEventListener('pageshow', later(200));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && later(250)());
  // Tastatur zu: kurz warten, bis iOS die Animation beendet hat – einmal früh, einmal sicherheitshalber später
  document.addEventListener('focusout', () => {
    later(160)();
    later(600)();
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', later(150));
  window.__tfHealViewport = heal;
}
