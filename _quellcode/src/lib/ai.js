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

const STALL_MS = 25000; // so lange ohne neue Daten → nächstes Modell
const TOTAL_MS = 100000; // danach endgültig aufgeben

/**
 * Anfrage an Gemini, Antwort als JSON-Objekt.
 * onProgress({ step: 'send'|'think'|'write'|'retry', model, thought, names, chars }) – für die Fortschrittsanzeige
 * signal: AbortSignal zum Abbrechen
 */
export async function askJson(prompt, { image, temperature = 0.4, onProgress, signal } = {}) {
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
  const parts = [{ text: prompt + '\n(Falls du vorher nachdenkst: fasse deine Gedanken kurz auf Deutsch zusammen.)' }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  const t0 = Date.now();
  let lastErr;
  let first = true;
  for (const model of models) {
    for (const thinking of [true, false]) {
      if (signal && signal.aborted) throw abortErr();
      if (Date.now() - t0 > TOTAL_MS) break;
      if (!first) prog({ step: 'retry', model: prettyModel(model), reason: lastErr && (lastErr.friendly || lastErr.message) });
      first = false;
      prog({ step: 'send', model: prettyModel(model) });
      const generationConfig = { responseMimeType: 'application/json', temperature };
      if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low', includeThoughts: true };
      // eigener Abbruch: Nutzer, Stillstand oder Gesamtzeit
      const ctl = new AbortController();
      let why = null;
      const kill = (w) => {
        why = w;
        ctl.abort();
      };
      const onUser = () => kill('user');
      if (signal) signal.addEventListener('abort', onUser);
      let stall;
      const armStall = () => {
        clearTimeout(stall);
        stall = setTimeout(() => kill('stall'), STALL_MS);
      };
      armStall();
      const total = setTimeout(() => kill('total'), Math.max(5000, TOTAL_MS - (Date.now() - t0)));
      try {
        const r = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
          signal: ctl.signal,
        });
        if (!r.ok) {
          const err = await apiError(r);
          lastErr = err;
          if (r.status === 400 && thinking && /thinking|thought/i.test(err.message)) continue; // ohne Denk-Einstellung erneut
          if (r.status === 404 || r.status === 429 || r.status >= 500) break; // nächstes Modell
          throw err;
        }
        let text = '';
        let finish = '';
        await readStream(
          r,
          (chunk) => {
            const cand = chunk && chunk.candidates && chunk.candidates[0];
            if (!cand) return;
            if (cand.finishReason) finish = cand.finishReason;
            ((cand.content && cand.content.parts) || []).forEach((p) => {
              if (!p.text) return;
              if (p.thought) prog({ step: 'think', model: prettyModel(model), thought: thoughtLine(p.text) });
              else {
                text += p.text;
                prog({ step: 'write', model: prettyModel(model), chars: text.length, names: partialNames(text) });
              }
            });
          },
          armStall,
          ctl.signal,
        );
        if (!text) {
          lastErr = new Error('Leere KI-Antwort' + (finish ? ' (' + finish + ')' : ''));
          break;
        }
        return extractJson(text);
      } catch (e) {
        if (why === 'user' || (signal && signal.aborted)) throw abortErr();
        if (why === 'stall' || why === 'total') {
          lastErr = new Error('Zeitüberschreitung');
          lastErr.friendly = 'Die KI hat zu lange nicht geantwortet – vermutlich gerade überlastet. Bitte gleich nochmal versuchen.';
          if (why === 'total') break;
          break; // nächstes Modell
        }
        if (e.status && e.status !== 404 && e.status !== 429 && e.status < 500) throw e;
        lastErr = e;
        if (!e.status) {
          if (e instanceof SyntaxError || /JSON/.test(e.message || '')) continue; // kaputte Antwort → ohne Denken nochmal
          if (!navigator.onLine) {
            const off = new Error('offline');
            off.friendly = 'Du bist offline – für die KI brauchst du Internet.';
            throw off;
          }
          break;
        }
      } finally {
        clearTimeout(stall);
        clearTimeout(total);
        if (signal) signal.removeEventListener('abort', onUser);
      }
    }
    if (Date.now() - t0 > TOTAL_MS) break;
  }
  if (lastErr && lastErr.status === 404) {
    // Modellliste veraltet -> beim nächsten Mal neu ermitteln
    saveAi({ models: null });
  }
  throw lastErr || new Error('KI-Anfrage fehlgeschlagen');
}

function abortErr() {
  const e = new Error('abgebrochen');
  e.aborted = true;
  e.friendly = 'Abgebrochen.';
  return e;
}

export const aiErrText = (e) => (e && (e.friendly || e.message)) || 'Unbekannter Fehler';
