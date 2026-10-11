import { useEffect, useRef, useState } from 'preact/hooks';
import { S, useS, closeSheet } from '../lib/store.js';
import { X, Minus, Plus, ChevronLeft } from 'lucide-preact';
import { n0, num } from '../lib/util.js';

export function Sheet({ title, onClose = closeSheet, onBack, children, footer, tall }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <div class="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={'sheet' + (tall ? ' sheet--tall' : '')} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet__head">
          <div class="sheet__grab" />
          {onBack ? (
            <button class="iconbtn" onClick={onBack} aria-label="Zurück">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span class="iconbtn-spacer" />
          )}
          <h2>{title}</h2>
          <button class="iconbtn" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        <div class="sheet__body">{children}</div>
        {footer && <div class="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Ring({ value, max, size = 132, stroke = 12, color = 'var(--kcal)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max;
  return (
    <div class="ring" style={{ width: size + 'px', height: size + 'px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--danger)' : color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <div class="ring__inner">{children}</div>
    </div>
  );
}

export function Bar({ label, value, max, color, unit = 'g' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div class="bar">
      <div class="bar__top">
        <span>{label}</span>
        <span class="tnum">
          <b>{n0(value)}</b> / {n0(max)} {unit}
        </span>
      </div>
      <div class="bar__track">
        <div class="bar__fill" style={{ width: pct + '%', background: value > max * 1.15 ? 'var(--danger)' : color }} />
      </div>
    </div>
  );
}

export function Chip({ active, onClick, children, small }) {
  return (
    <button type="button" class={'chip' + (active ? ' chip--on' : '') + (small ? ' chip--sm' : '')} onClick={onClick} aria-pressed={!!active}>
      {children}
    </button>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div class="seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.id} class={'seg__opt' + (value === o.id ? ' seg__opt--on' : '')} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step = 10, min = 0, unit = 'g', big }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const commit = (v) => onChange(Math.max(min, Math.round(num(v))));
  return (
    <div class={'stepper' + (big ? ' stepper--big' : '')}>
      <button type="button" class="stepper__btn" onClick={() => commit(value - step)} aria-label="Weniger">
        <Minus size={18} />
      </button>
      <div class="stepper__val">
        <input
          inputMode="decimal"
          value={txt}
          onInput={(e) => {
            setTxt(e.currentTarget.value);
            const v = num(e.currentTarget.value);
            if (v >= min) onChange(Math.round(v));
          }}
          onBlur={() => commit(txt)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Menge"
        />
        <span>{unit}</span>
      </div>
      <button type="button" class="stepper__btn" onClick={() => commit(value + step)} aria-label="Mehr">
        <Plus size={18} />
      </button>
    </div>
  );
}

export function Field({ label, hint, children, group }) {
  const inner = (
    <>
      <span class="field__label">{label}</span>
      {children}
      {hint && <span class="field__hint">{hint}</span>}
    </>
  );
  return group ? (
    <div class="field" role="group" aria-label={label}>
      {inner}
    </div>
  ) : (
    <label class="field">{inner}</label>
  );
}

export function NumInput({ value, onChange, placeholder, suffix, ...rest }) {
  return (
    <div class="numin">
      <input class="input" inputMode="decimal" value={value ?? ''} placeholder={placeholder} onInput={(e) => onChange(e.currentTarget.value)} {...rest} />
      {suffix && <span class="numin__suf">{suffix}</span>}
    </div>
  );
}

export const Spinner = ({ size = 18 }) => <span class="spinner" style={{ width: size + 'px', height: size + 'px' }} />;

export function Macros({ v, compact }) {
  return (
    <span class={'macros' + (compact ? ' macros--c' : '')}>
      <span class="m-p">E {n0(v.p)}</span>
      <span class="m-c">K {n0(v.c)}</span>
      <span class="m-f">F {n0(v.f)}</span>
    </span>
  );
}

export function Toast() {
  const s = useS();
  if (!s.toast) return null;
  return (
    <div class={'toast toast--' + s.toast.kind} role="status" key={s.toast.id}>
      {s.toast.text}
    </div>
  );
}

export function Empty({ icon, title, text, children }) {
  return (
    <div class="empty">
      {icon && <div class="empty__icon">{icon}</div>}
      <div class="empty__title">{title}</div>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
