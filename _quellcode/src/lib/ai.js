// Gemini (Google AI Studio, kostenloser Tarif) – direkt aus dem Browser mit deinem eigenen Schlüssel.
// Der Schlüssel liegt nur in deinem Konto (users/{uid}/tf_meta/ai), nicht im Code.
import { S, saveAi } from './store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const hasAi = () => !!(S.ai && S.ai.apiKey);

const verOf = (name) => {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
};

/** Verfügbare Modelle abfragen und eine sinnvolle Reihenfolge wählen (Flash > Flash-Lite) */
export async function discoverModels(apiKey) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  if (!r.ok) throw await apiError(r);
  const j = await r.json();
  const names = (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-/.test(n) && !/(image|tts|live|audio|embedding|robotics|computer|thinking-exp)/.test(n));
  const flash = names.filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => verOf(b) - verOf(a));
  const flashPrev = names.filter((n) => /^gemini-[\d.]+-flash-preview$/.test(n)).sort((a, b) => verOf(b) - verOf(a));
  const lite = names.filter((n) => /^gemini-[\d.]+-flash-lite$/.test(n)).sort((a, b) => verOf(b) - verOf(a));
  const order = [...flash.slice(0, 2), ...lite.slice(0, 1), ...flashPrev.slice(0, 1)];
  if (!order.length) order.push(...names.slice(0, 2));
  if (!order.length) throw new Error('Keine passenden Gemini-Modelle für diesen Schlüssel gefunden.');
  return order;
}

async function apiError(r) {
  let msg = 'HTTP ' + r.status;
  try {
    const j = await r.json();
    msg = (j.error && j.error.message) || msg;
  } catch (e) {}
  const err = new Error(msg);
  err.status = r.status;
  if (r.status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg)) err.friendly = 'Der KI-Schlüssel ist ungültig. Prüfe ihn in den Einstellungen.';
  else if (r.status === 403) err.friendly = 'Der KI-Schlüssel hat keinen Zugriff (403). Erstelle in AI Studio einen neuen Schlüssel.';
  else if (r.status === 429) err.friendly = 'Kostenloses KI-Kontingent gerade erschöpft. Probier es in ein paar Minuten nochmal.';
  else if (r.status >= 500) err.friendly = 'Die KI ist gerade überlastet. Bitte gleich nochmal versuchen.';
  return err;
}

export async function testKey(apiKey) {
  const models = await discoverModels(apiKey.trim());
  await saveAi({ apiKey: apiKey.trim(), models, checkedAt: Date.now() });
  return models;
}

function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(t);
  } catch (e) {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('Die KI-Antwort war kein gültiges JSON.');
  }
}

const prettyModel = (m) =>
  String(m || '')
    .replace(/^gemini-/, 'Gemini ')
    .replace(/-flash-lite/, ' Flash-Lite')
    .replace(/-flash-preview/, ' Flash (Preview)')
    .replace(/-flash/, ' Flash')
    .replace(/-pro/, ' Pro');

/** „**Überschrift**\n\nText“ aus einer Denk-Zusammenfassung → kurze Zeile */
function thoughtLine(t) {
  const s = String(t || '').trim();
  const m = s.match(/\*\*(.+?)\*\*/);
  const line = (m ? m[1] : s.split('\n')[0]).replace(/[*_#`]/g, '').trim();
  return line.length > 90 ? line.slice(0, 88) + ' …' : line;
}

/** Namen aus noch unvollständigem JSON ziehen (für „Erkannt: …“) */
const partialNames = (txt) => [...String(txt).matchAll(/"(?:name|title)"\s*:\s*"([^"]{2,60})"/g)].map((m) => m[1]);

/** Antwort lesen: SSE-Stream (data: {...}) oder – falls der Server kein SSE liefert – normales JSON */
async function readStream(r, onChunk, armStall, signal) {
  const handle = (obj) => (Array.isArray(obj) ? obj.forEach(onChunk) : onChunk(obj));
  const ct = r.headers.get('content-type') || '';
  if (!r.body || !r.body.getReader || !/event-stream/.test(ct)) {
    const t = await r.text();
    if (/^\s*data:/m.test(t)) t.split(/\n/).forEach((l) => l.startsWith('data:') && handle(JSON.parse(l.slice(5))));
    else handle(JSON.parse(t));
    return;
  }
  const reader = r.body.getReader();
  // Abbruch soll auch ein hängendes Lesen sofort beenden
  const stop = () => reader.cancel().catch(() => {});
  if (signal) signal.addEventListener('abort', stop);
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (signal && signal.aborted) throw new DOMException('abgebrochen', 'AbortError');
    if (done) break;
    armStall();
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) {
        const d = line.slice(5).trim();
        if (d && d !== '[DONE]') handle(JSON.parse(d));
      }
    }
  }
  if (signal) signal.removeEventListener('abort', stop);
  if (buf.trim().startsWith('data:')) handle(JSON.parse(buf.trim().slice(5)));
}

const STALL_MS = 20000; // so lange ohne neue Daten → Versuch gilt als hängend
const TOTAL_MS = 90000; // danach endgültig aufgeben

// Zuletzt schnell funktionierendes Modell merken (nur auf diesem Gerät) – kommt beim nächsten Mal zuerst dran
const PREF_KEY = 'tf.ai.fast.v1';
const prefModel = () => {
  try {
    const j = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    return j && Date.now() - j.at < 6 * 3600e3 ? j.model : null;
  } catch (e) {
    return null;
  }
};
const notePref = (model) => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ model, at: Date.now() }));
  } catch (e) {}
};
const noteBad = (model) => {
  try {
    const j = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (j && j.model === model) localStorage.removeItem(PREF_KEY);
  } catch (e) {}
};

/**
 * Denk-Einstellung je Modell: Gemini 3+ kennt thinkingLevel, 2.x nur thinkingBudget.
 * fast = einfache Aufgaben (Sprache, Text, Etikett, Schätzung): so wenig Nachdenken wie möglich → deutlich schneller.
 */
function thinkCfg(model, fast, level) {
  const v = verOf(model);
  const lite = /flash-lite/.test(model);
  if (level === 0) return null;
  if (v >= 3) return { thinkingLevel: fast ? 'minimal' : lite ? 'low' : 'low', includeThoughts: !fast };
  if (/-pro/.test(model)) return { thinkingBudget: fast ? 128 : 512, includeThoughts: !fast };
  return { thinkingBudget: fast ? 0 : 512, includeThoughts: !fast };
}

/**
 * Anfrage an Gemini, Antwort als JSON-Objekt.
 * onProgress({ step: 'send'|'think'|'write'|'retry', model, thought, names, chars }) – für die Fortschrittsanzeige
 * signal: AbortSignal zum Abbrechen
 * fast: einfache Aufgabe – minimales Nachdenken, schneller Zweitversuch
 *
 * Tempo: Kommt vom ersten Modell nach ein paar Sekunden noch nichts zurück, startet parallel ein zweites
 * („Hedging“). Die schnellere Antwort gewinnt, die andere wird abgebrochen. Das spart die langen Hänger,
 * wenn ein Modell gerade überlastet ist.
 */
export async function askJson(prompt, { image, images, temperature = 0.4, onProgress, signal, fast = false } = {}) {
  const prog = (p) => {
    try {
      onProgress && onProgress(p);
    } catch (e) {}
  };
  if (!hasAi()) {
    const e = new Error('KI nicht eingerichtet');
    e.friendly = 'Für diese Funktion fehlt noch der kostenlose KI-Schlüssel (Einstellungen → KI).';
    e.noKey = true;
    throw e;
  }
  const key = S.ai.apiKey;
  let models = S.ai.models && S.ai.models.length ? S.ai.models : null;
  if (!models) {
    prog({ step: 'send', model: '' });
    models = await discoverModels(key);
    saveAi({ models });
  }
  const pm = prefModel();
  if (pm && models.includes(pm)) models = [pm, ...models.filter((m) => m !== pm)];

  const parts = [{ text: fast ? prompt : prompt + '\n(Falls du vorher nachdenkst: fasse deine Gedanken kurz auf Deutsch zusammen.)' }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  (images || []).forEach((im) => {
    if (im.label) parts.push({ text: im.label });
    parts.push({ inline_data: { mime_type: im.mime, data: im.base64 } });
  });
  const t0 = Date.now();
  const heavy = (images && images.length > 1) || !!image;
  const HEDGE_MS = fast ? (heavy ? 9000 : 6000) : heavy ? 14000 : 10000;

  // Warteschlange der Versuche: jedes Modell mit Denk-Einstellung, bei Problemen ohne
  const queue = models.map((m) => ({ model: m, level: 1 }));
  let lastErr = null;
  let shown = null; // Modell, dessen Fortschritt angezeigt wird
  const running = new Set();
  const userAbort = () => running.forEach((a) => a.kill('user'));
  if (signal) signal.addEventListener('abort', userAbort);

  const attempt = ({ model, level }) => {
    const ctl = new AbortController();
    const a = { model, level, why: null, first: false };
    a.kill = (w) => {
      if (!a.why) a.why = w;
      ctl.abort();
    };
    running.add(a);
    let stall;
    const armStall = () => {
      clearTimeout(stall);
      stall = setTimeout(() => a.kill('stall'), STALL_MS);
    };
    armStall();
    const total = setTimeout(() => a.kill('total'), Math.max(5000, TOTAL_MS - (Date.now() - t0)));
    if (!shown) shown = model;
    const mine = () => shown === model;
    const generationConfig = { responseMimeType: 'application/json', temperature };
    const tc = thinkCfg(model, fast, level);
    if (tc) generationConfig.thinkingConfig = tc;
    a.promise = (async () => {
      try {
        const r = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
          signal: ctl.signal,
        });
        if (!r.ok) {
          const err = await apiError(r);
          // Denk-Einstellung passt nicht zum Modell → gleiches Modell ohne
          if (r.status === 400 && level && /thinking|thought|budget/i.test(err.message)) err.retryPlain = true;
          else if (!(r.status === 404 || r.status === 429 || r.status >= 500)) err.fatal = true;
          throw err;
        }
        let text = '';
        let finish = '';
        await readStream(
          r,
          (chunk) => {
            const cand = chunk && chunk.candidates && chunk.candidates[0];
            if (!cand) return;
            if (!a.first) {
              a.first = true;
              shown = model; // wer zuerst Daten liefert, wird angezeigt
            }
            if (cand.finishReason) finish = cand.finishReason;
            ((cand.content && cand.content.parts) || []).forEach((p) => {
              if (!p.text) return;
              if (p.thought) mine() && prog({ step: 'think', model: prettyModel(model), thought: thoughtLine(p.text) });
              else {
                text += p.text;
                mine() && prog({ step: 'write', model: prettyModel(model), chars: text.length, names: partialNames(text) });
              }
            });
          },
          armStall,
          ctl.signal,
        );
        if (!text) {
          const e = new Error('Leere KI-Antwort' + (finish ? ' (' + finish + ')' : ''));
          throw e;
        }
        try {
          return extractJson(text);
        } catch (e) {
          e.retryPlain = !!level; // kaputtes JSON → ohne Nachdenken nochmal
          throw e;
        }
      } catch (e) {
        if (a.why === 'user') throw abortErr();
        if (a.why === 'hedge-lost') {
          const x = new Error('überholt');
          x.lost = true;
          throw x;
        }
        if (a.why === 'stall' || a.why === 'total') {
          const x = new Error('Zeitüberschreitung');
          x.friendly = 'Die KI hat zu lange nicht geantwortet – vermutlich gerade überlastet. Bitte gleich nochmal versuchen.';
          x.timeout = a.why;
          throw x;
        }
        if (!e.status && !e.retryPlain && typeof navigator !== 'undefined' && !navigator.onLine) {
          const off = new Error('offline');
          off.friendly = 'Du bist offline – für die KI brauchst du Internet.';
          off.fatal = true;
          throw off;
        }
        throw e;
      } finally {
        clearTimeout(stall);
        clearTimeout(total);
        running.delete(a);
      }
    })();
    return a;
  };

  try {
    prog({ step: 'send', model: prettyModel(queue[0].model) });
    let active = [attempt(queue.shift())];
    for (;;) {
      if (signal && signal.aborted) throw abortErr();
      // Warten: auf eine Antwort, einen Fehler – oder bis Zeit fürs parallele Zweitmodell ist
      const waitHedge = active.length === 1 && queue.length && !active[0].first ? new Promise((res) => setTimeout(() => res('hedge'), Math.max(0, HEDGE_MS - (Date.now() - t0)))) : null;
      const settled = await Promise.race([
        ...active.map((a) => a.promise.then((v) => ({ a, v }), (e) => ({ a, e }))),
        ...(waitHedge ? [waitHedge.then(() => ({ hedge: true }))] : []),
      ]);
      if (settled.hedge) {
        if (active.length === 1 && !active[0].first && queue.length && Date.now() - t0 < TOTAL_MS - 10000) {
          const next = queue.shift();
          prog({ step: 'retry', model: prettyModel(next.model), reason: 'antwortet langsam – frage parallel ein zweites Modell' });
          active.push(attempt(next));
        }
        continue;
      }
      const { a, v, e } = settled;
      if (!e) {
        active.filter((x) => x !== a).forEach((x) => x.kill('hedge-lost'));
        notePref(a.model);
        return v;
      }
      active = active.filter((x) => x !== a);
      if (e.aborted) throw e;
      if (e.lost) continue;
      if (e.fatal) {
        active.forEach((x) => x.kill('hedge-lost'));
        throw e;
      }
      lastErr = e;
      noteBad(a.model);
      if (e.retryPlain) queue.unshift({ model: a.model, level: 0 });
      if (e.status === 404) saveAi({ models: null }); // Modellliste veraltet → beim nächsten Mal neu ermitteln
      if (!active.length) {
        if (!queue.length || Date.now() - t0 > TOTAL_MS) throw lastErr;
        const next = queue.shift();
        shown = null;
        prog({ step: 'retry', model: prettyModel(next.model), reason: e.friendly || e.message });
        active = [attempt(next)];
      }
    }
  } finally {
    if (signal) signal.removeEventListener('abort', userAbort);
    running.forEach((x) => x.kill('hedge-lost'));
  }
}

function abortErr() {
  const e = new Error('abgebrochen');
  e.aborted = true;
  e.friendly = 'Abgebrochen.';
  return e;
}

export const aiErrText = (e) => (e && (e.friendly || e.message)) || 'Unbekannter Fehler';
