import { Braces, CalendarDays, Cpu, Database, Info, Layers3, LockKeyhole, Timer } from 'lucide-react'
import { Badge, SectionCard, StatCard } from './ui.jsx'
import SlotHeatmap from './SlotHeatmap.jsx'
import { DAY_LABELS, PENALTY_META, SLOT_TIMES } from '../data/staticData.js'
import { fa, highlightJson } from '../lib/format.js'

export default function StaticDataPanel({ slots, config }) {
  const sampleSlot = slots.find((slot) => slot.id === 'd0_09') || slots[0]
  const sampleJson = JSON.stringify({ slot: sampleSlot, config }, null, 2)

  return (
    <div className="page-stack">
      <SectionCard
        title="دادههای ثابت"
        subtitle="اسلاتهای زمانی و پیکربندی حلگر · فقط خواندنی"
        icon={Database}
        badge={<Badge tone="slate" icon={LockKeyhole}>قرارگرفته در کد</Badge>}
      >
        <div className="info-banner">
          <Info size={16} />
          <span>
            در این نسخه دیتابیس وجود ندارد. آرایهٔ <bdi dir="ltr">slots</bdi> و شیء <bdi dir="ltr">config</bdi>
            مستقیماً از فایل <code dir="ltr">src/data/staticData.js</code> خوانده شده و بدون تغییر همراه دادههای
            قابل ویرایش به بکاند ارسال میشوند.
          </span>
        </div>

        <div className="stat-grid stat-grid--four">
          <StatCard icon={CalendarDays} label="روزهای کاری" value={fa(DAY_LABELS.length)} hint="۰ تا ۴" tone="violet" />
          <StatCard icon={Layers3} label="بازه در هر روز" value={fa(SLOT_TIMES.length)} hint="۰۸ تا ۱۸" tone="cyan" />
          <StatCard icon={Database} label="کل اسلاتها" value={fa(slots.length)} hint="همگی در payload" tone="pink" />
          <StatCard icon={Timer} label="محدودیت حل" value={`${fa(config.time_limit_sec)}s`} hint={`${fa(config.num_workers)} worker`} tone="green" />
        </div>
      </SectionCard>

      <SectionCard title="ماتریس کامل اسلاتها" subtitle="جریمهٔ هر بازه با رنگ مشخص شده است" icon={CalendarDays}>
        <SlotHeatmap slots={slots} />
      </SectionCard>

      <div className="static-grid">
        <SectionCard title="پیکربندی حلگر" subtitle="شیء config" icon={Cpu}>
          <div className="config-cards">
            <div className="config-card">
              <span className="config-card__icon"><Timer size={20} /></span>
              <div>
                <small>time_limit_sec</small>
                <strong>{fa(config.time_limit_sec)} ثانیه</strong>
                <p>حداکثر زمان اجرای الگوریتم زمانبندی</p>
              </div>
            </div>
            <div className="config-card">
              <span className="config-card__icon"><Cpu size={20} /></span>
              <div>
                <small>num_workers</small>
                <strong>{fa(config.num_workers)} پردازشگر</strong>
                <p>تعداد فرایندهای همزمان حلگر</p>
              </div>
            </div>
          </div>
          <div className="penalty-table">
            <div className="penalty-table__head">راهنمای جریمهها</div>
            {Object.entries(PENALTY_META).map(([penalty, meta]) => (
              <div className="penalty-table__row" key={penalty}>
                <i className={`heatmap__swatch heatmap__swatch--p${penalty}`} />
                <span>penalty = {fa(Number(penalty))}</span>
                <b>{meta.label}</b>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="نمونهای از ساختار" subtitle="یک اسلات + پیکربندی" icon={Braces}>
          <pre className="json-preview json-preview--small" dir="ltr">
            <code dangerouslySetInnerHTML={{ __html: highlightJson(sampleJson) }} />
          </pre>
          <div className="static-note">
            <LockKeyhole size={15} />
            اسلاتها از الگوی ۵ روز × ۸ بازه ساخته شدهاند و شناسههایی مانند <code dir="ltr">d0_09</code> دارند.
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
