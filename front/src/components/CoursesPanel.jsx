import { useMemo } from 'react'
import {
  BookOpen,
  CalendarRange,
  Clock3,
  GraduationCap,
  Hash,
  Info,
  Layers3,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Badge, EmptyState, Field, IconButton, SectionCard, Select, Stepper, TextInput } from './ui.jsx'
import { LEVEL_LABELS, LEVEL_OPTIONS, TERM_LABELS, TERM_OPTIONS } from '../data/staticData.js'
import { fa } from '../lib/format.js'

export default function CoursesPanel({ courses, teachers, onUpdate, onAdd, onRemove }) {
  const idCounts = useMemo(() => {
    const counts = new Map()
    courses.forEach((course) => {
      const id = String(course.id || '').trim()
      counts.set(id, (counts.get(id) || 0) + 1)
    })
    return counts
  }, [courses])

  const teacherOptions = teachers.map((teacher) => ({
    value: teacher.id,
    label: `${teacher.id} — ${teacher.name || 'بدون نام'}`,
  }))

  const termOptions = TERM_OPTIONS.map((value) => ({ value, label: `${value} · ${TERM_LABELS[value]}` }))
  const levelOptions = LEVEL_OPTIONS.map((value) => ({ value, label: `${value} · ${LEVEL_LABELS[value]}` }))

  return (
    <div className="page-stack">
      <SectionCard
        title="مدیریت دروس"
        subtitle="جلسات هفتگی، طول جلسه، استاد، ترم و مقطع را مشخص کنید"
        icon={BookOpen}
        badge={<Badge tone="cyan">{fa(courses.length)} درس</Badge>}
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
            <Plus size={16} />
            افزودن درس
          </button>
        }
      >
        <div className="info-banner">
          <Info size={16} />
          <span>
            در صورت تغییر شناسهٔ درس، تداخلهای مرتبط با آن به صورت خودکار بهروز میشوند. حذف درس، تداخلهای مربوط
            به آن را نیز پاک میکند.
          </span>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="هیچ درسی تعریف نشده است"
            description="یک درس جدید اضافه کنید تا وارد محموله شود."
            action={
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                <Plus size={16} /> افزودن درس
              </button>
            }
          />
        ) : (
          <div className="entity-grid">
            {courses.map((course, index) => {
              const id = String(course.id || '').trim()
              const idError = !id ? 'شناسه الزامی است.' : idCounts.get(id) > 1 ? 'این شناسه تکراری است.' : ''
              const nameError = !String(course.name || '').trim() ? 'نام درس خالی است.' : ''
              const teacherExists = teachers.some((teacher) => teacher.id === course.teacher_id)
              const teacherError = !teacherExists ? 'استاد انتخابشده وجود ندارد.' : ''
              const sessions = Number(course.sessions_per_week) || 0
              const hours = Number(course.session_hours) || 0
              const weekly = sessions * hours
              const termIndex = TERM_OPTIONS.indexOf(course.term) + 1

              return (
                <article className={`entity-card course-card course-card--term-${termIndex || 1}`} key={index}>
                  <div className="entity-card__top">
                    <span className="course-card__index">{fa(index + 1)}</span>
                    <div className="entity-card__title">
                      <small>درس {fa(index + 1)} · {course.term || '—'}</small>
                      <strong>{course.name || 'بدون نام'}</strong>
                    </div>
                    <span className="id-chip" dir="ltr">{course.id || '—'}</span>
                    <IconButton icon={Trash2} label="حذف درس" tone="danger" onClick={() => onRemove(index)} />
                  </div>

                  <div className="form-grid form-grid--two">
                    <Field label="نام درس" error={nameError}>
                      <TextInput
                        value={course.name}
                        onChange={(value) => onUpdate(index, { name: value })}
                        placeholder="مثال: ML"
                      />
                    </Field>
                    <Field label="شناسه" error={idError} hint="یکتا، مثلاً C1">
                      <TextInput
                        value={course.id}
                        onChange={(value) => onUpdate(index, { id: value })}
                        placeholder="C1"
                        className="ltr-input"
                        dir="ltr"
                      />
                    </Field>
                  </div>

                  <Field label="استاد مربوطه" error={teacherError}>
                    <Select
                      value={course.teacher_id}
                      onChange={(value) => onUpdate(index, { teacher_id: value })}
                      options={teacherOptions}
                      placeholder={teachers.length ? 'انتخاب استاد' : 'ابتدا استاد اضافه کنید'}
                    />
                  </Field>

                  <div className="form-grid form-grid--two">
                    <Field label="جلسات در هفته" hint="بین ۱ تا ۷">
                      <Stepper
                        value={course.sessions_per_week}
                        onChange={(value) => onUpdate(index, { sessions_per_week: value })}
                        min={1}
                        max={7}
                        unit="جلسه"
                      />
                    </Field>
                    <Field label="طول هر جلسه" hint="بین ۱ تا ۶ ساعت">
                      <Stepper
                        value={course.session_hours}
                        onChange={(value) => onUpdate(index, { session_hours: value })}
                        min={1}
                        max={6}
                        unit="ساعت"
                      />
                    </Field>
                  </div>

                  <div className="form-grid form-grid--three">
                    <Field label="ترم">
                      <Select
                        value={course.term}
                        onChange={(value) => onUpdate(index, { term: value })}
                        options={termOptions}
                      />
                    </Field>
                    <Field label="مقطع">
                      <Select
                        value={course.level}
                        onChange={(value) => onUpdate(index, { level: value })}
                        options={levelOptions}
                      />
                    </Field>
                    <Field label="رشته">
                      <TextInput
                        value={course.major}
                        onChange={(value) => onUpdate(index, { major: value })}
                        placeholder="CE"
                        className="ltr-input"
                        dir="ltr"
                      />
                    </Field>
                  </div>

                  <div className="course-card__summary">
                    <span><Clock3 size={14} /> {fa(weekly)} ساعت در هفته</span>
                    <span><Layers3 size={14} /> {fa(sessions)} × {fa(hours)}</span>
                    <Badge tone="slate">{course.level ? LEVEL_LABELS[course.level] || course.level : '—'}</Badge>
                  </div>
                </article>
              )
            })}

            <button type="button" className="add-card" onClick={onAdd}>
              <span className="add-card__icon"><Plus size={24} /></span>
              <strong>افزودن درس جدید</strong>
              <small>یک کارت جدید با مقادیر پیشفرض ایجاد میشود</small>
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="راهنمای فیلدها" subtitle="همان کلیدهایی که در آرایهٔ courses ارسال میشوند" icon={Hash}>
        <div className="schema-grid">
          <SchemaItem icon={Hash} title="id / name" desc="شناسهٔ یکتا و نام درس" />
          <SchemaItem icon={UserRound} title="teacher_id" desc="ارجاع به id استاد" />
          <SchemaItem icon={CalendarRange} title="sessions_per_week" desc="تعداد جلسات هفتگی" />
          <SchemaItem icon={Clock3} title="session_hours" desc="طول هر جلسه بر حسب ساعت" />
          <SchemaItem icon={Layers3} title="term" desc="Term1 / Term2 / Term3" />
          <SchemaItem icon={GraduationCap} title="level / major" desc="مقطع و رشتهٔ تحصیلی" />
        </div>
      </SectionCard>
    </div>
  )
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
