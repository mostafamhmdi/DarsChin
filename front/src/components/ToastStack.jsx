import { CheckCircle2, CircleAlert, Info, X, Zap } from 'lucide-react'

const ICONS = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
  spark: Zap,
}

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info
        return (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span className="toast__icon">
              <Icon size={18} strokeWidth={2} />
            </span>
            <div className="toast__content">
              <strong>{toast.title || (toast.type === 'error' ? 'خطا' : toast.type === 'success' ? 'انجام شد' : 'اطلاع')}</strong>
              <p>{toast.message}</p>
            </div>
            <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="بستن اعلان">
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
