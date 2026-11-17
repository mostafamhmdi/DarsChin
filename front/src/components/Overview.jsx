import {
  ArrowUpLeft,
  BookOpen,
  CalendarClock,
  CircleCheck,
  Cpu,
  Database,
  Gauge,
  Link2Off,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { Badge, SectionCard, StatCard } from './ui.jsx'
import SlotHeatmap from './SlotHeatmap.jsx'
import { DAY_LABELS, courseLabel } from '../data/staticData.js'
import { fa } from '../lib/format.js'

export default function Overview({ teachers, courses, conflicts, slots, config, validation, onNavigate, lastResult }) {
  const stats = [
    { icon: Users, label: 'استاد فعال', value: fa(teachers.length), hint: 'قابل ویرایش', tone: 'violet' },
    { icon: BookOpen, label: 'درس تعریفشده', value: fa(courses.length), hint: 'قابل ویرایش', tone: 'cyan' },
    { icon: Link2Off, label: 'تداخل ثبتشده', value: fa(conflicts.length), hint: 'قابل ویرایش', tone: 'pink' },
    { icon: Database, label: 'اسلات زمانی', value: fa(slots.length), hint: 'ثابت در کد', tone: 'green' },
  ]

  const totalWeeklyHours = courses.reduce(
    (sum, course) => sum + Number(course.sessions_per_week || 0) * Number(course.session_hours || 0),
    0,
  )

  return (
    <div className="page-stack">
      <div className="hero-card">
        <div className="hero-card__glow hero-card__glow--one" />
        <div className="hero-card__glow hero-card__glow--two" />
        <div className="hero-card__content">
          <Badge tone="glass" icon={Sparkles}>
            نسخهٔ اولیه · MVP
          </Badge>
          <h2>درخواست زمانبندی را بساز، بررسی کن، ارسال کن.</h2>
          <p>
            اساتید، دروس و تداخلها را ویرایش کنید. اسلاتهای زمانی و پیکربندی حلگر به صورت ثابت در کد قرار دارند و
            همراه با دادههای شما در یک <bdi>POST</bdi> واحد به بکاند ارسال میشوند.
          </p>
          <div className="hero-card__actions">
            <button type="button" className="btn btn--primary" onClick={() => onNavigate('teachers')}>
              شروع ویرایش دادهها
              <ArrowUpLeft size={16} />
            </button>
            <button type="button" className="btn btn--glass" onClick={() => onNavigate('payload')}>
              مشاهدهٔ محموله
            </button>
          </div>
        </div>
        <div className="hero-card__orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring--1" />
          <div className="orbit-ring orbit-ring--2" />
          <div className="orbit-core">
            <Gauge size={34} strokeWidth={1.5} />
          </div>
          <span className="orbit-dot orbit-dot--1" />
          <span className="orbit-dot orbit-dot--2" />
          <span className="orbit-dot orbit-dot--3" />
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="overview-grid">
        <SectionCard
          title="نمای اسلاتهای زمانی"
          subtitle="۴۰ بازه در ۵ روز · رنگها نشاندهندهٔ میزان جریمه هستند"
          icon={CalendarClock}
          className="overview-grid__wide"
          actions={<Badge tone="slate">فقط خواندنی</Badge>}
        >
          <SlotHeatmap slots={slots} compact />
        </SectionCard>

        <SectionCard title="پیکربندی حلگر" subtitle="مقادیر ثابت ارسالشده در config" icon={Cpu}>
          <div className="config-mini">
            <div className="config-mini__item">
              <span className="config-mini__icon"><Timer size={18} /></span>
              <div>
                <small>محدودیت زمانی</small>
                <strong>{fa(config.time_limit_sec)} ثانیه</strong>
              </div>
            </div>
            <div className="config-mini__item">
              <span className="config-mini__icon"><Cpu size={18} /></span>
              <div>
                <small>پردازشگرها</small>
                <strong>{fa(config.num_workers)} worker</strong>
              </div>
            </div>
            <div className="config-mini__item">
              <span className="config-mini__icon"><BookOpen size={18} /></span>
              <div>
                <small>ساعت آموزشی هفتگی</small>
                <strong>{fa(totalWeeklyHours)} ساعت</strong>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="اولویت و دسترسی اساتید" subtitle="مرتبشده بر اساس اولویت" icon={Users}>
          <div className="teacher-ranking">
            {teachers.length === 0 && <p className="muted">استادی تعریف نشده است.</p>}
            {[...teachers]
              .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
              .slice(0, 6)
              .map((teacher, index) => (
                <div className="teacher-ranking__row" key={`${teacher.id}-${index}`}>
                  <span className={`avatar avatar--mini avatar--tone-${index % 4}`}>
                    {String(teacher.name || '؟').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="teacher-ranking__info">
                    <strong>{teacher.name || 'بدون نام'}</strong>
                    <small>
                      {(teacher.available_days || []).map((day) => DAY_LABELS[day] || day).join('، ') || 'بدون روز مجاز'}
                    </small>
                  </div>
                  <div className="teacher-ranking__bar">
                    <span style={{ width: `${(Number(teacher.priority || 0) / 5) * 100}%` }} />
                  </div>
                  <b>{fa(Number(teacher.priority || 0))}</b>
                </div>
              ))}
          </div>
        </SectionCard>

        <SectionCard title="تداخلهای ثبتشده" subtitle="جفت دروسی که نباید همزمان شوند" icon={Link2Off}>
          <div className="conflict-mini">
            {conflicts.length === 0 && <p className="muted">هیچ تداخلی تعریف نشده است.</p>}
            {conflicts.slice(0, 6).map((conflict, index) => {
              const a = courses.find((course) => course.id === conflict.course_a)
              const b = courses.find((course) => course.id === conflict.course_b)
              return (
                <div className="conflict-mini__row" key={`${conflict.course_a}-${conflict.course_b}-${index}`}>
                  <span className="conflict-mini__index">{fa(index + 1)}</span>
                  <span className="conflict-mini__course">{courseLabel(a)}</span>
                  <span className="conflict-mini__link">⟷</span>
                  <span className="conflict-mini__course">{courseLabel(b)}</span>
                </div>
              )
            })}
            {conflicts.length > 6 && (
              <button type="button" className="text-button" onClick={() => onNavigate('conflicts')}>
                مشاهدهٔ {fa(conflicts.length - 6)} مورد دیگر
              </button>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="اعتبارسنجی نهایی"
        subtitle="پیش از ارسال، سلامت محموله بررسی میشود"
        icon={validation.isValid ? ShieldCheck : TriangleAlert}
        badge={
          <Badge tone={validation.isValid ? 'green' : 'rose'} icon={validation.isValid ? CircleCheck : TriangleAlert}>
            {validation.isValid ? 'معتبر' : `${fa(validation.errors.length)} خطا`}
          </Badge>
        }
      >
        {validation.isValid ? (
          <div className="validation-ok">
            <CircleCheck size={22} />
            <div>
              <strong>همهچیز آماده است.</strong>
              <p>محموله از نظر شناسهها، ارجاعات و مقادیر عددی معتبر است و میتواند ارسال شود.</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={() => onNavigate('payload')}>
              رفتن به ارسال
            </button>
          </div>
        ) : (
          <div className="validation-errors">
            <ul>
              {validation.errors.slice(0, 4).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
            {lastResult && <p className="muted">آخرین ارسال: {lastResult.status === 'success' ? 'موفق' : 'ناموفق'}</p>}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
