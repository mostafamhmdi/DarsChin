import { useMemo } from 'react'
import { CalendarDays, Gauge, Hash, Info, Plus, Trash2, Users } from 'lucide-react'
import { Badge, ChipToggle, EmptyState, Field, IconButton, SectionCard, Select, TextInput } from './ui.jsx'
import { DAY_LABELS, DAY_SHORT, PRIORITY_OPTIONS } from '../data/staticData.js'
import { fa } from '../lib/format.js'

export default function TeachersPanel({ teachers, courses, onUpdate, onAdd, onRemove }) {
  const idCounts = useMemo(() => {
    const counts = new Map()
    teachers.forEach((teacher) => {
      const id = String(teacher.id || '').trim()
      counts.set(id, (counts.get(id) || 0) + 1)
    })
    return counts
  }, [teachers])

  const teacherOptions = PRIORITY_OPTIONS.map((value) => ({
    value,
    label: `${fa(value)} ${value === 5 ? '· بالاترین' : value === 1 ? '· کمترین' : ''}`.trim(),
  }))

  return (
    <div className="page-stack">
      <SectionCard
        title="مدیریت اساتید"
        subtitle="نام، شناسه، اولویت و روزهای مجاز هر استاد را تعیین کنید"
        icon={Users}
        badge={<Badge tone="violet">{fa(teachers.length)} استاد</Badge>}
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
            <Plus size={16} />
            افزودن استاد
          </button>
        }
      >
        <div className="info-banner">
          <Info size={16} />
          <span>
            شناسهٔ استاد در دروس استفاده میشود؛ در صورت تغییر شناسه، ارجاع دروس مرتبط به صورت خودکار بهروزرسانی
            میشود. روزهای ۰ تا ۴ معادل {DAY_LABELS.join('، ')} هستند.
          </span>
        </div>

        {teachers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="هیچ استادی تعریف نشده است"
            description="برای شروع، یک استاد جدید اضافه کنید."
            action={
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                <Plus size={16} /> افزودن استاد
              </button>
            }
          />
        ) : (
          <div className="entity-grid">
            {teachers.map((teacher, index) => {
              const id = String(teacher.id || '').trim()
              const idError = !id ? 'شناسه الزامی است.' : idCounts.get(id) > 1 ? 'این شناسه تکراری است.' : ''
              const nameError = !String(teacher.name || '').trim() ? 'نام استاد خالی است.' : ''
              const days = Array.isArray(teacher.available_days) ? teacher.available_days : []
              const daysError = days.length === 0 ? 'حداقل یک روز مجاز انتخاب کنید.' : ''
              const relatedCourses = courses.filter((course) => course.teacher_id === teacher.id).length
              const priority = Number(teacher.priority) || 1

              return (
                <article className="entity-card teacher-card" key={index}>
                  <div className="entity-card__top">
                    <span className={`avatar avatar--tone-${index % 4}`}>
                      {String(teacher.name || '؟').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="entity-card__title">
                      <small>استاد {fa(index + 1)}</small>
                      <strong>{teacher.name || 'بدون نام'}</strong>
                    </div>
                    <span className="id-chip" dir="ltr">{teacher.id || '—'}</span>
                    <IconButton icon={Trash2} label="حذف استاد" tone="danger" onClick={() => onRemove(index)} />
                  </div>

                  <div className="form-grid form-grid--two">
                    <Field label="نام استاد" error={nameError}>
                      <TextInput
                        value={teacher.name}
                        onChange={(value) => onUpdate(index, { name: value })}
                        placeholder="مثال: Mahdian"
                      />
                    </Field>
                    <Field label="شناسه" error={idError} hint="باید یکتا باشد">
                      <TextInput
                        value={teacher.id}
                        onChange={(value) => onUpdate(index, { id: value })}
                        placeholder="T1"
                        className="ltr-input"
                        dir="ltr"
                      />
                    </Field>
                  </div>

                  <div className="form-grid form-grid--two">
                    <Field label="اولویت" error={priority < 1 || priority > 5 ? 'بین ۱ تا ۵' : ''}>
                      <Select
                        value={teacher.priority}
                        onChange={(value) => onUpdate(index, { priority: Number(value) })}
                        options={teacherOptions}
                      />
                    </Field>
                    <Field label="دروس مرتبط">
                      <div className="readonly-value">
                        <BookIcon />
                        {fa(relatedCourses)} درس
                      </div>
                    </Field>
                  </div>

                  <Field label="روزهای مجاز" hint="روی روزها کلیک کنید" error={daysError}>
                    <div className="day-chips">
                      {DAY_LABELS.map((label, day) => {
                        const active = days.includes(day)
                        return (
                          <ChipToggle
                            key={day}
                            active={active}
                            title={label}
                            onClick={() => {
                              const next = active ? days.filter((item) => item !== day) : [...days, day]
                              onUpdate(index, { available_days: next.sort((a, b) => a - b) })
                            }}
                            tone={active ? 'cyan' : 'slate'}
                          >
                            <span className="day-chip__short">{DAY_SHORT[day]}</span>
                            <span className="day-chip__full">{label}</span>
                          </ChipToggle>
                        )
                      })}
                    </div>
                  </Field>

                  <div className="priority-meter">
                    <div className="priority-meter__head">
                      <Gauge size={14} />
                      <span>سطح اولویت</span>
                      <b>{fa(priority)} / {fa(5)}</b>
                    </div>
                    <div className="priority-meter__track">
                      <span style={{ width: `${(priority / 5) * 100}%` }} />
                    </div>
                  </div>
                </article>
              )
            })}

            <button type="button" className="add-card" onClick={onAdd}>
              <span className="add-card__icon"><Plus size={24} /></span>
              <strong>افزودن استاد جدید</strong>
              <small>یک کارت جدید با مقادیر پیشفرض ایجاد میشود</small>
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="راهنمای فیلدها" subtitle="نگاشت مقادیر به ساختار نهایی JSON" icon={Hash}>
        <div className="schema-grid">
          <SchemaItem icon={Hash} title="id" desc="شناسهٔ یکتا، مثلاً T1" />
          <SchemaItem icon={Users} title="name" desc="نام نمایشی استاد" />
          <SchemaItem icon={CalendarDays} title="available_days" desc="آرایهٔ اعداد ۰ تا ۴" />
          <SchemaItem icon={Gauge} title="priority" desc="عدد ۱ تا ۵؛ ۵ بالاترین" />
        </div>
      </SectionCard>
    </div>
  )
}

function BookIcon() {
  return <span className="readonly-value__dot" />
}

function SchemaItem({ icon: Icon, title, desc }) {
  return (
    <div className="schema-item">
      <span className="schema-item__icon"><Icon size={17} /></span>
      <div>
        <code dir="ltr">{title}</code>
        <p>{desc}</p>
      </div>
    </div>
  )
}
