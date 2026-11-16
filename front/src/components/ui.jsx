import { useEffect } from 'react'
import { CircleMinus, CirclePlus, X } from 'lucide-react'
import { fa } from '../lib/format.js'

export function SectionCard({ title, subtitle, icon: Icon, actions, badge, children, className = '', id }) {
  return (
    <section className={`section-card ${className}`} id={id}>
      <div className="section-card__head">
        <div className="section-card__heading">
          {Icon && (
            <span className="section-card__icon">
              <Icon size={18} strokeWidth={1.9} />
            </span>
          )}
          <div>
            <div className="section-card__title-row">
              <h2>{title}</h2>
              {badge}
            </div>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="section-card__actions">{actions}</div>}
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  )
}

export function Field({ label, hint, children, className = '', error }) {
  return (
    <div className={`field ${className} ${error ? 'field--error' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

export function TextInput({ value, onChange, className = '', ...props }) {
  return (
    <input
      {...props}
      className={`input ${className}`}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function NumberInput({ value, onChange, className = '', ...props }) {
  return (
    <input
      {...props}
      type="number"
      className={`input ${className}`}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        onChange(raw === '' ? '' : Number(raw))
      }}
    />
  )
}

export function Select({ value, onChange, options = [], placeholder, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`select ${className}`}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const normalized = typeof option === 'string' ? { value: option, label: option } : option
        return (
          <option key={String(normalized.value)} value={normalized.value}>
            {normalized.label}
          </option>
        )
      })}
    </select>
  )
}

export function Stepper({ value, onChange, min = 1, max = 10, unit }) {
  const numeric = Number(value)
  const current = Number.isFinite(numeric) && numeric !== 0 ? numeric : min
  const update = (next) => onChange(Math.min(max, Math.max(min, next)))

  return (
    <div className="stepper">
      <button type="button" onClick={() => update(current - 1)} disabled={current <= min} aria-label="کاهش">
        <CircleMinus size={18} strokeWidth={1.8} />
      </button>
      <div className="stepper__value">
        <strong>{fa(current)}</strong>
        {unit && <span>{unit}</span>}
      </div>
      <button type="button" onClick={() => update(current + 1)} disabled={current >= max} aria-label="افزایش">
        <CirclePlus size={18} strokeWidth={1.8} />
      </button>
    </div>
  )
}

export function ChipToggle({ active, onClick, children, title, tone = 'violet', disabled }) {
  return (
    <button
      type="button"
      className={`chip-toggle chip-toggle--${tone} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'violet', icon: Icon, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </span>
  )
}

export function IconButton({ icon: Icon, label, onClick, tone = 'ghost', disabled, className = '' }) {
  return (
    <button
      type="button"
      className={`icon-button icon-button--${tone} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon size={17} strokeWidth={1.9} />
    </button>
  )
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'violet' }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__top">
        <span className="stat-card__icon">
          <Icon size={19} strokeWidth={1.9} />
        </span>
        <span className="stat-card__spark" />
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {hint && <div className="stat-card__hint">{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon size={24} strokeWidth={1.7} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأیید', cancelLabel = 'انصراف', tone = 'danger', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined
    const handler = (event) => {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <span className="modal__eyebrow">تأیید عملیات</span>
            <h3>{title}</h3>
          </div>
          <IconButton icon={X} label="بستن" onClick={onCancel} />
        </div>
        <p className="modal__message">{message}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn--${tone}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
