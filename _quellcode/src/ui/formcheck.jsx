// Formcheck: Fotos + Gewicht + Körperfett + Maße – Verlauf, Vergleich, Auswertung & Vorschläge
import { useEffect, useRef, useState } from 'preact/hooks';
import { useS, S, openSheet, closeSheet, toast, saveProfile } from '../lib/store.js';
import { picsInCloud, POSES, MEASURES, INTERVALS, checkList, prevCheckOf, saveCheck, deleteCheck, savePic, delPic, loadPic, checkDue, intervalOf, navyBf, bfLevel, recentWeight, evalCheck, aiRecos, applyReco } from '../lib/checks.js';
import { setupOf, FOCUS } from '../lib/training.js';
import { hasAi, aiErrText } from '../lib/ai.js';
import { aiFormCheck } from '../lib/aitasks.js';
import { downscaleImage, fmtShortDate, n0, n1, num, todayKey } from '../lib/util.js';
import { Sheet, Seg, Field, NumInput } from './common.jsx';
import { nav } from './router.js';
import { useAiJob, AiProgress } from './aiprogress.jsx';
import { Camera, Check, ChevronRight, Columns2, Sparkles, Trash2, X, Ruler, CalendarClock } from 'lucide-preact';

const sgn = (v, unit = '', digits = 1) => (v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${digits ? n1(Math.abs(v)) : n0(Math.abs(v))}${unit}`);

/** Foto eines Checks (lädt nach) */
function Pic({ date, pose, onClick, cls = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let on = true;
    loadPic(date, pose).then((s) => on && setSrc(s || ''));
    return () => (on = false);
  }, [date, pose]);
  if (src === '') return <div class={'fcpic fcpic--none ' + cls}>{cls.includes('thumb') ? '🔒' : 'Foto liegt auf einem anderen Gerät'}</div>;
  return src ? <img class={'fcpic ' + cls} src={src} alt={`Formcheck ${pose} vom ${fmtShortDate(date)}`} onClick={onClick} /> : <div class={'fcpic fcpic--load ' + cls} />;
}

// =============== Karte in „Woche“ ===============
export function FormCheckCard() {
  const s = useS();
  const list = checkList();
  const due = checkDue();
  const last = list[0];
  const prev = list[1];
  const adj = Number((s.profile || {}).kcalAdjust) || 0;
  const every = intervalOf();
  return (
    <section class="card fc">
      <div class="fc__head">
        <div>
          <h3>Formcheck</h3>
          <p class="small muted">
            {!last
              ? 'Fotos, Gewicht & Körperfett in festen Abständen – so siehst du, was sich wirklich tut, und die App justiert Plan & Kalorien nach.'
              : due.due
                ? `Fällig – der letzte war vor ${due.days} Tagen.`
                : every
                  ? `Nächster ab ${fmtShortDate(due.next)} · ${INTERVALS.find((i) => i.id === every)?.label || ''}`
                  : 'Ohne Erinnerung'}
          </p>
        </div>
        {due.due && <span class="badge badge--warn">fällig</span>}
      </div>

      {last && (
        <div class="fc__stats">
          <div>
            <span class="muted small">Gewicht</span>
            <b class="tnum">{last.weight ? `${n1(last.weight)} kg` : '–'}</b>
            {prev && last.weight && prev.weight && <small class="tnum">{sgn(last.weight - prev.weight, ' kg')}</small>}
          </div>
          <div>
            <span class="muted small">Körperfett</span>
            <b class="tnum">{last.bf ? `${n1(last.bf)} %` : '–'}</b>
            {prev && last.bf && prev.bf && <small class="tnum">{sgn(last.bf - prev.bf, ' %')}</small>}
          </div>
          <div>
            <span class="muted small">Bauch</span>
            <b class="tnum">{last.waist ? `${n1(last.waist)} cm` : '–'}</b>
            {prev && last.waist && prev.waist && <small class="tnum">{sgn(last.waist - prev.waist, ' cm')}</small>}
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div class="fc__strip">
          {list.slice(0, 8).map((c) => (
            <button class="fc__thumb" onClick={() => openSheet('checkview', { date: c.date })} aria-label={`Formcheck vom ${fmtShortDate(c.date)} ansehen`}>
              {(c.poses || []).length ? <Pic date={c.date} pose={c.poses[0]} cls="fcpic--thumb" /> : <div class="fcpic fcpic--thumb fcpic--none">{c.bf ? n1(c.bf) + ' %' : n1(c.weight || 0)}</div>}
              <span class="small tnum">{fmtShortDate(c.date)}</span>
            </button>
          ))}
        </div>
      )}

      <div class="row">
        <button class={'btn btn--sm' + (!last || due.due ? ' btn--primary' : '')} onClick={() => openSheet('formcheck', {})}>
          <Camera size={16} /> {last ? 'Neuer Formcheck' : 'Ersten Formcheck machen'}
        </button>
        {list.length > 1 && (
          <button class="btn btn--sm" onClick={() => openSheet('checkcompare', {})}>
            <Columns2 size={16} /> Vorher / Nachher
          </button>
        )}
      </div>

      {adj !== 0 && (
        <p class="small muted fc__adj">
          Kalorienziel durch Formcheck angepasst: <b>{sgn(adj, ' kcal', 0)}</b> pro Tag ·{' '}
          <button class="btn--link small" onClick={() => (saveProfile({ ...S.profile, kcalAdjust: 0 }), toast('Anpassung zurückgesetzt'))}>
            zurücksetzen
          </button>
        </p>
      )}
      {last && (
        <details class="more">
          <summary>
            <CalendarClock size={14} /> Erinnerung
          </summary>
          <Seg value={every} onChange={(v) => saveProfile({ ...S.profile, checkEvery: v })} options={INTERVALS} />
          <p class="small muted">Alle 4 Wochen ist ein guter Rhythmus: lang genug, dass man echte Veränderungen sieht, kurz genug zum Nachsteuern.</p>
        </details>
      )}
    </section>
  );
}

/** Hinweis auf „Heute“, wenn ein Check fällig ist */
export function FormCheckDue() {
  useS();
  const due = checkDue();
  if (!due.due) return null;
  return (
    <button class="notice fcdue" onClick={() => openSheet('formcheck', {})}>
      <Camera size={18} />
      <span>
        <b>Formcheck fällig</b>
        <small class="muted"> · {due.days} Tage seit dem letzten – dauert 3 Minuten</small>
      </span>
      <ChevronRight size={18} class="muted" />
    </button>
  );
}

// =============== Neuer Check ===============
function PhotoSlot({ pose, img, onImg, onRemove }) {
  const ref = useRef();
  return (
    <div class="fcslot">
      {img ? (
        <>
          <img class="fcpic" src={img} alt={pose.label} onClick={() => ref.current.click()} />
          <button class="fcslot__x" onClick={onRemove} aria-label={`${pose.label}-Foto entfernen`}>
            <X size={14} />
          </button>
        </>
      ) : (
        <button class="fcslot__add" onClick={() => ref.current.click()}>
          <Camera size={22} />
          <span>{pose.label}</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.currentTarget.files && e.currentTarget.files[0];
          e.currentTarget.value = '';
          if (!f) return;
          try {
            const im = await downscaleImage(f, 900, 0.75);
            onImg(im.dataUrl);
          } catch (err) {
            toast('Das Bild konnte nicht gelesen werden', 'error');
          }
        }}
      />
    </div>
  );
}

export function FormCheckSheet({ date: date0 }) {
  const s = useS();
  const p = s.profile || {};
  const date = date0 || todayKey();
  const existing = (s.checks || {})[date];
  const prev = prevCheckOf(date);
  const [v, setV] = useState(() => {
    const e = existing || {};
    const o = { weight: e.weight || recentWeight() || '', bf: e.bfSrc === 'manuell' ? e.bf : '', note: e.note || '' };
    MEASURES.forEach((m) => (o[m.id] = e[m.id] || (m.id === 'neck' && prev && prev.neck) || ''));
    return o;
  });
  const [mode, setMode] = useState((existing && existing.bfSrc) || (prev && prev.bfSrc) || 'umfang');
  const [imgs, setImgs] = useState({});
  useEffect(() => {
    // vorhandene Fotos beim Bearbeiten laden
    if (existing) (existing.poses || []).forEach((pose) => loadPic(date, pose).then((src) => src && setImgs((o) => ({ ...o, [pose]: o[pose] || src }))));
  }, []);
  const set = (patch) => setV((o) => ({ ...o, ...patch }));
  const navy = navyBf({ sex: p.sex, height: p.heightCm, waist: v.waist, neck: v.neck, hip: v.hip });
  const bf = mode === 'manuell' ? num(v.bf) || null : mode === 'umfang' ? navy : existing && existing.bfSrc === 'ki' ? existing.bf : null;
  const nPics = Object.values(imgs).filter(Boolean).length;
  const canSave = nPics > 0 || num(v.weight) > 30 || bf;

  const save = () => {
    const data = { picsAt: picsInCloud() ? 'cloud' : 'device', weight: num(v.weight) > 30 ? Math.round(num(v.weight) * 10) / 10 : null, bf: bf ? Math.round(bf * 10) / 10 : null, bfSrc: bf ? mode : null, note: v.note.trim(), poses: POSES.map((x) => x.id).filter((id) => imgs[id]), createdAt: (existing && existing.createdAt) || Date.now() };
    MEASURES.forEach((m) => (data[m.id] = num(v[m.id]) > 0 ? Math.round(num(v[m.id]) * 10) / 10 : null));
    if (existing && existing.ai) data.ai = existing.ai;
    POSES.forEach((x) => {
      if (imgs[x.id]) savePic(date, x.id, imgs[x.id]);
      else if (existing && (existing.poses || []).includes(x.id)) delPic(date, x.id);
    });
    saveCheck(date, data);
    toast('Formcheck gespeichert 📸');
    openSheet('checkview', { date, autoAi: mode === 'ki' });
  };

  const needHip = p.sex === 'w';
  return (
    <Sheet
      title={existing ? 'Formcheck bearbeiten' : 'Formcheck'}
      tall
      footer={
        <button class="btn btn--primary btn--block" disabled={!canSave} onClick={save}>
          <Check size={18} /> Speichern & auswerten
        </button>
      }
    >
      <h4 class="sect">Fotos</h4>
      <div class="fcslots">
        {POSES.map((pose) => (
          <PhotoSlot pose={pose} img={imgs[pose.id]} onImg={(src) => setImgs((o) => ({ ...o, [pose.id]: src }))} onRemove={() => setImgs((o) => ({ ...o, [pose.id]: null }))} />
        ))}
      </div>
      <p class="small muted">Tipp: morgens, gleiche Stelle, gleiches Licht, enge Kleidung oder Unterwäsche – dann sind die Fotos vergleichbar. Selbstauslöser oder Spiegel.</p>
      <p class="small fcprivacy">🔒 {picsInCloud() ? 'Fotos werden in deinem Konto gespeichert (Sync auf alle Geräte).' : 'Fotos bleiben nur auf diesem Handy – sie werden nirgends hochgeladen.'} An die KI gehen sie nur, wenn du es auslöst. <button class="btn--link small" onClick={() => (closeSheet(), nav('/einstellungen?privat=1'))}>Datenschutz</button></p>

      <h4 class="sect">Gewicht</h4>
      <NumInput value={v.weight} onChange={(x) => set({ weight: x })} suffix="kg" placeholder="z. B. 78,4" />

      <h4 class="sect">Körperfett</h4>
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { id: 'umfang', label: 'Maßband' },
          { id: 'manuell', label: 'Weiß ich' },
          { id: 'ki', label: 'KI schätzt' },
        ]}
      />
      {mode === 'manuell' && (
        <Field label="Körperfett" hint="z. B. von deiner Waage, Caliper oder Studio-Messung (InBody). Am besten immer gleich messen.">
          <NumInput value={v.bf} onChange={(x) => set({ bf: x })} suffix="%" placeholder="z. B. 16,5" />
        </Field>
      )}
      {mode === 'umfang' && (
        <>
          <div class="fcmeas">
            {['waist', 'neck', ...(needHip ? ['hip'] : [])].map((id) => {
              const m = MEASURES.find((x) => x.id === id);
              return (
                <Field label={m.label} hint={m.hint}>
                  <NumInput value={v[id]} onChange={(x) => set({ [id]: x })} suffix="cm" />
                </Field>
              );
            })}
          </div>
          <p class="small fcbf">
            {navy ? (
              <>
                ≈ <b class="tnum">{n1(navy)} %</b> Körperfett <span class="muted">({bfLevel(navy, p.sex)} · US-Navy-Formel, ± 3 %)</span>
              </>
            ) : (
              <span class="muted">{p.heightCm ? `Bauch & Hals${needHip ? ' & Hüfte' : ''} eintragen – die App rechnet den Körperfettanteil aus.` : 'Für die Berechnung fehlt deine Größe (Einstellungen → Profil).'}</span>
            )}
          </p>
        </>
      )}
      {mode === 'ki' && <p class="small muted">{hasAi() ? 'Nach dem Speichern schickt die App deine Fotos an Google Gemini, die KI schätzt den Körperfettanteil (grobe Spanne). Mit Maßband oder Waage wird es genauer – und die Fotos bleiben bei dir.' : 'Dafür brauchst du den KI-Schlüssel (Einstellungen → KI) – oder nimm das Maßband.'}</p>}

      <details class="more" open={MEASURES.some((m) => !['waist', 'neck', 'hip'].includes(m.id) && v[m.id])}>
        <summary>
          <Ruler size={14} /> Weitere Maße (optional)
        </summary>
        <div class="fcmeas">
          {MEASURES.filter((m) => !(mode === 'umfang' && ['waist', 'neck', ...(needHip ? ['hip'] : [])].includes(m.id))).map((m) => (
            <Field label={m.label} hint={m.hint}>
              <NumInput value={v[m.id]} onChange={(x) => set({ [m.id]: x })} suffix="cm" />
            </Field>
          ))}
        </div>
      </details>
      <Field label="Notiz (optional)">
        <input class="input" value={v.note} placeholder="z. B. nach Urlaub, wenig geschlafen" onInput={(e) => set({ note: e.currentTarget.value })} />
      </Field>
    </Sheet>
  );
}

// =============== Ergebnis / Ansicht ===============
const FOCUS_IDS = FOCUS.map((f) => `${f.id} (${f.label})`).join(', ');

export function CheckViewSheet({ date, autoAi }) {
  const s = useS();
  const c = (s.checks || {})[date];
  const job = useAiJob();
  const [ai, setAi] = useState({ status: 'idle' });
  const [big, setBig] = useState(null);
  const autoRan = useRef(false);
  const prev = c ? prevCheckOf(date) : null;

  const runAi = async () => {
    if (!c) return;
    setAi({ status: 'loading' });
    const o = job.start();
    try {
      const pics = [];
      for (const pose of c.poses || []) {
        const src = await loadPic(date, pose);
        if (src) pics.push({ label: `Bild: aktuell – ${pose} (${fmtShortDate(date)})`, mime: 'image/jpeg', base64: src.split(',')[1] });
      }
      if (prev) {
        for (const pose of (prev.poses || []).filter((x) => (c.poses || []).includes(x)).slice(0, 2)) {
          const src = await loadPic(prev.date, pose);
          if (src) pics.push({ label: `Bild: vorher – ${pose} (${fmtShortDate(prev.date)})`, mime: 'image/jpeg', base64: src.split(',')[1] });
        }
      }
      if (!pics.length) throw Object.assign(new Error('keine Fotos'), { friendly: 'Für die KI-Analyse brauchst du mindestens ein Foto.' });
      const r = await aiFormCheck({ pics, cur: c, prev, profile: S.profile, setup: setupOf(), focusList: FOCUS_IDS }, o);
      const patch = { ai: r };
      if (r.bodyFat && (!c.bf || c.bfSrc === 'ki')) Object.assign(patch, { bf: Math.round(((r.bodyFat.low + r.bodyFat.high) / 2) * 10) / 10, bfSrc: 'ki' });
      saveCheck(date, { ...c, ...patch });
      setAi({ status: 'idle' });
    } catch (e) {
      setAi(e.aborted ? { status: 'idle' } : { status: 'error', error: aiErrText(e) });
    }
  };
  useEffect(() => {
    // „KI schätzt“ gewählt → Analyse direkt starten
    if (autoAi && c && hasAi() && !c.ai && !autoRan.current && (c.poses || []).length) {
      autoRan.current = true;
      runAi();
    }
  }, [!!c]);
  const confirmDel = useRef(false);

  if (!c) {
    return (
      <Sheet title="Formcheck">
        <p class="muted">Wird geladen …</p>
      </Sheet>
    );
  }
  const ev = evalCheck(c, prev);
  const recos = [...ev.recos, ...aiRecos(c.ai)];
  const applied = c.applied || [];
  const take = (r) => {
    const msg = applyReco(r);
    saveCheck(date, { ...c, applied: [...applied, r.id] });
    toast(msg + ' ✓');
  };
  const p = s.profile || {};
  const row = (label, cur, old, unit, digits = 1) =>
    cur ? (
      <li>
        <span class="muted">{label}</span>
        <b class="tnum">
          {digits ? n1(cur) : n0(cur)} {unit}
        </b>
        <small class="tnum">{old ? sgn(cur - old, ' ' + unit, digits) : ''}</small>
      </li>
    ) : null;

  return (
    <Sheet title={`Formcheck · ${fmtShortDate(date)}`} tall>
      {(c.poses || []).length > 0 && (
        <div class="fcpics">
          {c.poses.map((pose) => (
            <Pic date={date} pose={pose} onClick={() => setBig(pose)} />
          ))}
        </div>
      )}
      {big && (
        <div class="fcbig" onClick={() => setBig(null)}>
          <Pic date={date} pose={big} cls="fcpic--big" />
        </div>
      )}

      <div class={'fcverdict fcverdict--' + ev.verdict.tone}>
        <b>{ev.verdict.title}</b>
        <p>{ev.verdict.text}</p>
      </div>

      <ul class="fcvals">
        {row('Gewicht', c.weight, prev && prev.weight, 'kg')}
        {c.bf ? (
          <li>
            <span class="muted">
              Körperfett <small>· {bfLevel(c.bf, p.sex)}{c.bfSrc === 'ki' ? ', KI' : c.bfSrc === 'umfang' ? ', Maßband' : ''}</small>
            </span>
            <b class="tnum">{n1(c.bf)} %</b>
            <small class="tnum">{prev && prev.bf ? sgn(c.bf - prev.bf, ' %') : ''}</small>
          </li>
        ) : null}
        {ev.stats.leanKg ? (
          <li>
            <span class="muted">Fettfreie Masse</span>
            <b class="tnum">{n1(ev.stats.leanKg)} kg</b>
            <small class="tnum">{ev.stats.dLean != null ? sgn(ev.stats.dLean, ' kg') : ''}</small>
          </li>
        ) : null}
        {MEASURES.map((m) => row(m.label, c[m.id], prev && prev[m.id], 'cm'))}
      </ul>
      {prev && <p class="small muted">Vergleich mit {fmtShortDate(prev.date)} ({ev.stats.days} Tage).</p>}

      {recos.length > 0 && (
        <>
          <h4 class="sect">Vorschläge</h4>
          <ul class="fcrecos">
            {recos.map((r) => (
              <li class="card fcreco">
                <div>
                  <b>{r.title}</b>
                  <p class="small muted">{r.text}</p>
                </div>
                {applied.includes(r.id) ? (
                  <span class="badge">
                    <Check size={14} /> übernommen
                  </span>
                ) : (
                  <button class="btn btn--sm btn--primary" onClick={() => take(r)}>
                    Übernehmen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 class="sect">KI-Analyse der Fotos</h4>
      {ai.status === 'loading' ? (
        <AiProgress p={job.p} steps={['Fotos laden', 'An die KI senden', 'KI betrachtet Proportionen & Veränderungen', 'Einschätzung schreiben']} expect={700} namesLabel="Thema" onCancel={job.cancel} />
      ) : c.ai ? (
        <div class="fcai">
          {c.ai.bodyFat && (
            <p>
              <b>
                Körperfett ca. {c.ai.bodyFat.low}–{c.ai.bodyFat.high} %
              </b>{' '}
              <span class="small muted">(Schätzung aus Fotos)</span>
            </p>
          )}
          {c.ai.summary && <p>{c.ai.summary}</p>}
          {c.ai.changes && (
            <p>
              <b>Veränderung:</b> {c.ai.changes}
            </p>
          )}
          {c.ai.strengths.length > 0 && (
            <ul class="good">
              {c.ai.strengths.map((x) => (
                <li>
                  <Check size={16} /> {x}
                </li>
              ))}
            </ul>
          )}
          {c.ai.posture && (
            <p>
              <b>Haltung:</b> {c.ai.posture}
            </p>
          )}
          {c.ai.tip && (
            <p>
              <b>Tipp:</b> {c.ai.tip}
            </p>
          )}
          <button class="btn--link small" onClick={runAi}>
            Neu analysieren
          </button>
        </div>
      ) : (c.poses || []).length ? (
        hasAi() ? (
          <>
            <p class="small muted">Die KI schätzt den Körperfettanteil, vergleicht mit dem letzten Check und sagt dir, welche Muskeln mehr Fokus vertragen. Die Fotos gehen dafür einmalig an Google Gemini.</p>
            <button class="btn btn--sm" onClick={runAi}>
              <Sparkles size={16} /> Fotos analysieren
            </button>
          </>
        ) : (
          <p class="small muted">Mit KI-Schlüssel (Einstellungen → KI) kann die App deine Fotos auswerten.</p>
        )
      ) : (
        <p class="small muted">Ohne Fotos keine KI-Analyse – Werte & Vorschläge oben gelten trotzdem.</p>
      )}
      {ai.status === 'error' && <div class="notice notice--warn small">{ai.error}</div>}
      {c.note && <p class="small muted">📝 {c.note}</p>}

      <div class="row fcactions">
        <button class="btn btn--sm" onClick={() => openSheet('formcheck', { date })}>
          Bearbeiten
        </button>
        {checkList().length > 1 && (
          <button class="btn btn--sm" onClick={() => openSheet('checkcompare', { b: date })}>
            <Columns2 size={16} /> Vergleichen
          </button>
        )}
        <button
          class="btn btn--sm btn--danger"
          onClick={() => {
            if (!confirmDel.current) {
              confirmDel.current = true;
              toast('Nochmal tippen zum Löschen');
              setTimeout(() => (confirmDel.current = false), 3000);
              return;
            }
            deleteCheck(c);
            closeSheet();
            toast('Formcheck gelöscht');
          }}
          aria-label="Formcheck löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Sheet>
  );
}

// =============== Vorher / Nachher ===============
export function CheckCompareSheet({ a: a0, b: b0 }) {
  const s = useS();
  const list = checkList();
  const [b, setB] = useState(b0 || (list[0] && list[0].date));
  const [a, setA] = useState(a0 || (list[list.length - 1] && list[list.length - 1].date));
  const ca = (s.checks || {})[a];
  const cb = (s.checks || {})[b];
  const poses = POSES.filter((x) => ca && cb && (ca.poses || []).includes(x.id) && (cb.poses || []).includes(x.id));
  const [pose, setPose] = useState(null);
  const pz = pose && poses.some((x) => x.id === pose) ? pose : poses[0] && poses[0].id;
  if (!ca || !cb) return <Sheet title="Vorher / Nachher" />;
  const days = Math.round((new Date(b) - new Date(a)) / 864e5);
  const opts = list.map((c) => ({ id: c.date, label: fmtShortDate(c.date) }));
  const d = (k, unit) => (ca[k] && cb[k] ? <small class="tnum">{sgn(cb[k] - ca[k], ' ' + unit)}</small> : null);
  return (
    <Sheet title="Vorher / Nachher" tall>
      <div class="fccmp__pick">
        <label>
          <span class="small muted">Vorher</span>
          <select class="input" value={a} onChange={(e) => setA(e.currentTarget.value)}>
            {opts.map((o) => (
              <option value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span class="small muted">Nachher</span>
          <select class="input" value={b} onChange={(e) => setB(e.currentTarget.value)}>
            {opts.map((o) => (
              <option value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      {poses.length > 1 && <Seg value={pz} onChange={setPose} options={poses.map((x) => ({ id: x.id, label: x.label }))} />}
      {pz ? (
        <div class="fccmp">
          <figure>
            <Pic date={a} pose={pz} />
            <figcaption class="small muted">{fmtShortDate(a)}</figcaption>
          </figure>
          <figure>
            <Pic date={b} pose={pz} />
            <figcaption class="small muted">{fmtShortDate(b)}</figcaption>
          </figure>
        </div>
      ) : (
        <p class="small muted">Für diese beiden Termine gibt es keine Fotos aus der gleichen Ansicht.</p>
      )}
      <ul class="fcvals">
        <li>
          <span class="muted">Zeitraum</span>
          <b class="tnum">{Math.abs(days)} Tage</b>
          <small />
        </li>
        {ca.weight && cb.weight && (
          <li>
            <span class="muted">Gewicht</span>
            <b class="tnum">{n1(cb.weight)} kg</b>
            {d('weight', 'kg')}
          </li>
        )}
        {ca.bf && cb.bf && (
          <li>
            <span class="muted">Körperfett</span>
            <b class="tnum">{n1(cb.bf)} %</b>
            {d('bf', '%')}
          </li>
        )}
        {MEASURES.map((m) =>
          ca[m.id] && cb[m.id] ? (
            <li>
              <span class="muted">{m.label}</span>
              <b class="tnum">{n1(cb[m.id])} cm</b>
              {d(m.id, 'cm')}
            </li>
          ) : null,
        )}
      </ul>
    </Sheet>
  );
}
