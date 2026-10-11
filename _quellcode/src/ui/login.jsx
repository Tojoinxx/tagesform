import { useState } from 'preact/hooks';
import { useS, useLocal } from '../lib/store.js';
import { Logo } from './logo.jsx';
import { Spinner, Field } from './common.jsx';

export function Login() {
  const s = useS();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(s.auth.error ? { ok: false, text: s.auth.error } : null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const fb = await import('../lib/firebase.js');
      if (mode === 'reset') {
        await fb.resetPw(email);
        setMsg({ ok: true, text: 'E-Mail zum Zurücksetzen ist unterwegs (auch im Spam schauen).' });
        setMode('login');
      } else if (mode === 'register') await fb.register(email, pw);
      else await fb.login(email, pw);
    } catch (err) {
      const fb = await import('../lib/firebase.js');
      setMsg({ ok: false, text: fb.errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="auth">
      <div class="auth__brand">
        <Logo size={64} />
        <h1>Tagesform</h1>
        <p class="muted">Training &amp; Ernährung – dein eigener Coach</p>
      </div>
      <form class="card form" onSubmit={submit}>
        <h2>{mode === 'register' ? 'Konto erstellen' : mode === 'reset' ? 'Passwort vergessen' : 'Anmelden'}</h2>
        {mode === 'login' && <p class="small muted">Gleiches Konto wie bei Kartenschatz – deine Daten synchronisieren dann zwischen iPhone und PC.</p>}
        <Field label="E-Mail">
          <input class="input" type="email" autoComplete="username" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </Field>
        {mode !== 'reset' && (
          <Field label="Passwort">
            <input class="input" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={pw} onInput={(e) => setPw(e.currentTarget.value)} required />
          </Field>
        )}
        {msg && <div class={'notice ' + (msg.ok ? 'notice--ok' : 'notice--warn')}>{msg.text}</div>}
        <button class="btn btn--primary btn--block btn--lg" type="submit" disabled={busy}>
          {busy && <Spinner size={16} />} {mode === 'register' ? 'Konto erstellen' : mode === 'reset' ? 'Link senden' : 'Anmelden'}
        </button>
        <div class="row row--between">
          <button type="button" class="btn--link small" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Neues Konto' : 'Zur Anmeldung'}
          </button>
          {mode === 'login' && (
            <button type="button" class="btn--link small" onClick={() => setMode('reset')}>
              Passwort vergessen?
            </button>
          )}
        </div>
      </form>
      <button class="btn--link small center" onClick={() => useLocal(true)}>
        Erst mal ohne Konto ausprobieren (nur auf diesem Gerät)
      </button>
    </div>
  );
}
