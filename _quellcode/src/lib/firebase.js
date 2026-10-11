// Firebase: eigene App-Instanz „tagesform“ im selben Projekt wie Kartenschatz.
// Daten liegen unter users/{uid}/tf_* – Kartenschatz (users/{uid}/items, meta) wird nicht angefasst.
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  documentId,
} from 'firebase/firestore';

let app, auth, db;

export function init(cfg) {
  if (app) return;
  app = initializeApp(cfg, 'tagesform');
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (e) {
    db = initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
  }
}

export const onAuth = (cb) => onAuthStateChanged(auth, cb);
export const login = (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw);
export const register = (email, pw) => createUserWithEmailAndPassword(auth, email.trim(), pw);
export const resetPw = (email) => sendPasswordResetEmail(auth, email.trim());
export const logout = () => signOut(auth);
export const projectId = () => app && app.options.projectId;

export function cloudBackend(uid, onError) {
  const ref = (path) => doc(db, 'users', uid, ...path.split('/'));
  const col = (path) => collection(db, 'users', uid, path);
  const guard = (p) => p.catch((e) => onError && onError(e));
  return {
    mode: 'cloud',
    watchDoc(path, cb) {
      return onSnapshot(
        ref(path),
        { includeMetadataChanges: true },
        (s) => cb(s.exists() ? s.data() : null, { fromCache: s.metadata.fromCache }),
        (e) => onError && onError(e),
      );
    },
    watchCol(path, cb, since) {
      const q = since ? query(col(path), where(documentId(), '>=', since)) : col(path);
      return onSnapshot(
        q,
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => onError && onError(e),
      );
    },
    set(path, data, merge = true) {
      guard(setDoc(ref(path), data, { merge }));
    },
    del(path) {
      guard(deleteDoc(ref(path)));
    },
  };
}

export function errText(e) {
  const code = String((e && e.code) || '');
  const map = {
    'auth/invalid-email': 'Die E-Mail-Adresse ist ungültig.',
    'auth/missing-password': 'Bitte gib dein Passwort ein.',
    'auth/weak-password': 'Das Passwort muss mindestens 6 Zeichen haben.',
    'auth/email-already-in-use': 'Für diese E-Mail gibt es schon ein Konto – melde dich an.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/invalid-login-credentials': 'E-Mail oder Passwort stimmt nicht.',
    'auth/wrong-password': 'E-Mail oder Passwort stimmt nicht.',
    'auth/user-not-found': 'Zu dieser E-Mail gibt es kein Konto.',
    'auth/too-many-requests': 'Zu viele Versuche. Warte kurz und versuch es erneut.',
    'auth/network-request-failed': 'Keine Verbindung. Prüfe dein Internet.',
    'permission-denied': 'Keine Berechtigung für die Datenbank (Regeln prüfen).',
    unavailable: 'Datenbank gerade nicht erreichbar – Änderungen werden später übertragen.',
  };
  return map[code] || (e && e.message) || 'Unbekannter Fehler';
}
