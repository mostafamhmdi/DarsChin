import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Menu,
  Server,
  Settings2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Badge, IconButton } from './ui.jsx'
import { fa } from '../lib/format.js'

export default function Topbar({ activeMeta, mode, endpoint, validation, submitStatus, onOpenSettings, onToggleSidebar }) {
  const status =
    submitStatus === 'loading'
      ? { tone: 'violet', icon: LoaderCircle, label: 'در حال ارسال…', spin: true }
      : submitStatus === 'success'
        ? { tone: 'green', icon: CircleCheck, label: 'ارسال موفق' }
        : submitStatus === 'error'
          ? { tone: 'rose', icon: CircleAlert, label: 'خطا در ارسال' }
          : validation.isValid
            ? { tone: 'green', icon: CircleCheck, label: 'آمادهٔ ارسال' }
            : { tone: 'amber', icon: CircleAlert, label: `${fa(validation.errors.length)} خطای اعتبارسنجی` }

  const StatusIcon = status.icon

  return (
    <header className="topbar">
      <div className="topbar__right">
        <IconButton icon={Menu} label="باز کردن منو" onClick={onToggleSidebar} className="topbar__menu" />
        <div className="topbar__titles">
          <div className="topbar__breadcrumb">
            <span>پنل زمانبندی</span>
            <span className="topbar__slash">/</span>
            <span>{activeMeta.label}</span>
          </div>
          <h1>{activeMeta.label}</h1>
          <p>{activeMeta.hint}</p>
        </div>
      </div>

      <div className="topbar__left">
        <div className="topbar__endpoint" title={endpoint}>
          {mode === 'mock' ? <WifiOff size={14} /> : <Wifi size={14} />}
          <span className="topbar__method">POST</span>
          <code dir="ltr">{endpoint}</code>
        </div>

        <Badge tone={status.tone} icon={StatusIcon} className={status.spin ? 'badge--spin' : ''}>
          {status.label}
        </Badge>

        <Badge tone="slate" icon={Server}>
          {mode === 'mock' ? 'Mock' : 'Live API'}
        </Badge>

        <IconButton icon={Settings2} label="تنظیمات و ارسال" onClick={onOpenSettings} tone="soft" />
      </div>
    </header>
  )
}
