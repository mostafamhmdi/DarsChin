import {
  BookOpen,
  CalendarRange,
  ChevronLeft,
  CircleCheck,
  Database,
  LayoutDashboard,
  Link2Off,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Badge } from './ui.jsx'
import { fa } from '../lib/format.js'

export const NAV_ITEMS = [
  { id: 'overview', label: 'نمای کلی', hint: 'چکیده و آمار', icon: LayoutDashboard, group: 'شروع' },
  { id: 'teachers', label: 'اساتید', hint: 'روزها و اولویت', icon: Users, group: 'دادههای قابل ویرایش', countKey: 'teachers' },
  { id: 'courses', label: 'دروس', hint: 'جلسات و مقطع', icon: BookOpen, group: 'دادههای قابل ویرایش', countKey: 'courses' },
  { id: 'conflicts', label: 'تداخلها', hint: 'جفت دروس', icon: Link2Off, group: 'دادههای قابل ویرایش', countKey: 'conflicts' },
  { id: 'static', label: 'دادههای ثابت', hint: 'اسلات و پیکربندی', icon: Database, group: 'مرجع' },
  { id: 'payload', label: 'محموله و ارسال', hint: 'JSON و POST', icon: Send, group: 'خروجی' },
]

export default function Sidebar({ activeTab, onNavigate, stats, validation, onReset, mode, isOpen, onClose }) {
  const progress = validation.isValid ? 100 : Math.max(12, 100 - validation.errors.length * 14)

  let lastGroup = null
  const items = NAV_ITEMS.map((item) => {
    const showGroup = item.group !== lastGroup
    lastGroup = item.group
    return { ...item, showGroup }
  })

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar__brand">
          <div className="brand-mark">
            <CalendarRange size={23} strokeWidth={1.9} />
            <span className="brand-mark__spark">
              <Sparkles size={11} strokeWidth={2.2} />
            </span>
          </div>
          <div className="sidebar__brand-text">
            <strong>درس‌چین</strong>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="ناوبری اصلی">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <div key={item.id}>
                {item.showGroup && <div className="sidebar__group">{item.group}</div>}
                <button
                  type="button"
                  className={`nav-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id)
                    onClose?.()
                  }}
                >
                  <span className="nav-item__icon">
                    <Icon size={18} strokeWidth={1.9} />
                  </span>
                  <span className="nav-item__text">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                  {item.countKey && <span className="nav-item__count">{fa(stats[item.countKey] ?? 0)}</span>}
                  {isActive && <ChevronLeft className="nav-item__arrow" size={15} />}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__status">
            <div className="sidebar__status-head">
              <span className={`status-dot ${validation.isValid ? 'is-ok' : 'is-warn'}`} />
              <div>
                <strong>وضعیت محموله</strong>
                <small>{validation.isValid ? 'آمادهٔ ارسال' : `${fa(validation.errors.length)} مورد نیاز به اصلاح`}</small>
              </div>
              {validation.isValid && <CircleCheck size={18} />}
            </div>
            <div className="sidebar__progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="sidebar__mini-stats">
              <span>{fa(stats.slots)} اسلات</span>
              <span>{fa(stats.config.time_limit_sec)}s محدودیت</span>
              <span>{fa(stats.config.num_workers)} پردازشگر</span>
            </div>
            <div className="sidebar__mode">
              <Badge tone={mode === 'mock' ? 'cyan' : 'green'}>
                {mode === 'mock' ? 'حالت نمایشی' : 'بکاند زنده'}
              </Badge>
            </div>
            <button type="button" className="sidebar__reset" onClick={onReset}>
              <RotateCcw size={15} />
              بازگردانی دادهٔ اولیه
            </button>
          </div>
          <div className="sidebar__version">
            <ShieldCheck size={13} />
            نسخهٔ اولیه · بدون دیتابیس
          </div>
        </div>
      </aside>
    </>
  )
}
