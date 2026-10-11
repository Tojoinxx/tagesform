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

/** Anfrage an Gemini, Antwort als JSON-Objekt */
export async function askJson(prompt, { image, temperature = 0.4 } = {}) {
  if (!hasAi()) {
    const e = new Error('KI nicht eingerichtet');
    e.friendly = 'Für diese Funktion fehlt noch der kostenlose KI-Schlüssel (Einstellungen → KI).';
    e.noKey = true;
    throw e;
  }
  const key = S.ai.apiKey;
  let models = S.ai.models && S.ai.models.length ? S.ai.models : null;
  if (!models) {
    models = await discoverModels(key);
    saveAi({ models });
  }
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  let lastErr;
  for (const model of models) {
    for (const thinking of [true, false]) {
      const generationConfig = { responseMimeType: 'application/json', temperature };
      if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
      try {
        const r = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
        });
        if (!r.ok) {
          const err = await apiError(r);
          lastErr = err;
          if (r.status === 400 && thinking && /thinking/i.test(err.message)) continue; // ohne thinkingConfig erneut
          if (r.status === 404 || r.status === 429 || r.status >= 500) break; // nächstes Modell
          throw err;
        }
        const j = await r.json();
        const cand = j.candidates && j.candidates[0];
        const text = ((cand && cand.content && cand.content.parts) || [])
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join('');
        if (!text) {
          lastErr = new Error('Leere KI-Antwort' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
          break;
        }
        return extractJson(text);
      } catch (e) {
        if (e.status && e.status !== 404 && e.status !== 429 && e.status < 500) throw e;
        lastErr = e;
        if (!e.status) break;
      }
    }
  }
  if (lastErr && lastErr.status === 404) {
    // Modellliste veraltet -> beim nächsten Mal neu ermitteln
    saveAi({ models: null });
  }
  throw lastErr || new Error('KI-Anfrage fehlgeschlagen');
}

export const aiErrText = (e) => (e && (e.friendly || e.message)) || 'Unbekannter Fehler';
