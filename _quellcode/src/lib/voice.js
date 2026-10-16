// Sprachaufnahme im Browser (auch als iPhone-Home-Bildschirm-App): MediaRecorder → 16-kHz-Mono-WAV → Base64.
// WAV versteht Gemini sicher; Safari nimmt sonst mp4/AAC, Chrome webm/Opus auf.

export const canRecord = () => !!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined');

const pickMime = () => {
  const list = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return list.find((m) => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(m)) || '';
};

const blobToBase64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

function wavFrom(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

async function toWav(blob, ctx) {
  const data = await blob.arrayBuffer();
  const decoded = await new Promise((res, rej) => {
    const p = ctx.decodeAudioData(data, res, rej);
    if (p && p.then) p.then(res, rej);
  });
  const rate = 16000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return wavFrom(out.getChannelData(0), rate);
}

/** Fehlertext für Mikrofon-Probleme */
export function micErrText(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'Kein Zugriff aufs Mikrofon. Erlaube es beim Nachfragen – oder auf dem iPhone unter Einstellungen → Apps → Safari → Mikrofon (bzw. „Fragen“).';
  if (n === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  return 'Aufnahme ging nicht: ' + ((e && e.message) || 'unbekannter Fehler');
}

/**
 * Aufnahme starten. onLevel(0..1) für die Pegelanzeige, nach maxMs stoppt sie von selbst (onAuto).
 * Rückgabe: { stop(): Promise<{ mime, base64, ms }>, cancel() }
 */
export async function startRecording({ onLevel, maxMs = 60000, onAuto } = {}) {
  // AudioContext noch im Tipp-Ereignis anlegen (iOS lässt ihn sonst stumm)
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    try {
      ctx.close();
    } catch (x) {}
    throw e;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  let raf = 0;
  try {
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const arr = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(arr);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) sum += ((arr[i] - 128) / 128) ** 2;
      onLevel && onLevel(Math.min(1, Math.sqrt(sum / arr.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {}

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  rec.start(250);
  const cleanup = () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
  };
  const timer = setTimeout(() => onAuto && onAuto(), maxMs);
  let done = null;
  const finish = () => {
    if (done) return done;
    clearTimeout(timer);
    done = new Promise((res) => {
      rec.onstop = res;
      if (rec.state !== 'inactive') rec.stop();
      else res();
    }).then(async () => {
      cleanup();
      const ms = Date.now() - t0;
      const raw = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/mp4').split(';')[0] });
      let blob = raw;
      try {
        blob = await toWav(raw, ctx);
      } catch (e) {
        // Umwandeln ging nicht → Original schicken
      }
      try {
        ctx.close();
      } catch (e) {}
      return { mime: blob.type || 'audio/mp4', base64: await blobToBase64(blob), ms, size: raw.size };
    });
    return done;
  };
  return {
    stop: finish,
    cancel: () => {
      clearTimeout(timer);
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch (e) {}
      cleanup();
      try {
        ctx.close();
      } catch (e) {}
    },
  };
}
