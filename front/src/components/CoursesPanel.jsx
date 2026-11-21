import { useId, useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronsDownUp,
  Clock3,
  Info,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Badge, EmptyState, Field, IconButton, SectionCard, Select, Stepper, TextInput } from './ui.jsx'
import { LEVEL_LABELS, LEVEL_OPTIONS, TERM_LABELS, TERM_OPTIONS } from '../data/staticData.js'
import { fa } from '../lib/format.js'
import '../styles/CoursesPanel.css'

const TERM_TONES = { Term1: 'cyan', Term2: 'amber', Term3: 'pink' }

export default function CoursesPanel({ courses, teachers, onUpdate, onAdd, onRemove }) {
  // در شروع همه ردیف‌ها بسته‌اند و هم‌زمان فقط یک ردیف باز می‌شود.
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [query, setQuery] = useState('')
  const panelId = useId()

  const idCounts = useMemo(() => {
    const counts = new Map()
    courses.forEach((course) => {
      const id = String(course.id || '').trim()
      counts.set(id, (counts.get(id) || 0) + 1)
    })
    return counts
  }, [courses])

  const teacherMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  )
  const teacherOptions = teachers.map((teacher) => ({
    value: teacher.id,
    label: `${teacher.id} — ${teacher.name || 'بدون نام'}`,
  }))
  const termOptions = TERM_OPTIONS.map((value) => ({ value, label: TERM_LABELS[value] || value }))
  const levelOptions = LEVEL_OPTIONS.map((value) => ({ value, label: LEVEL_LABELS[value] || value }))
  const search = query.trim().toLowerCase()

  const visibleCourses = courses
    .map((course, index) => ({ course, index }))
    .filter(({ course, index }) => {
      // هنگام ویرایش نام یا شناسه، ردیف از نتیجه جستجو ناپدید نشود.
      if (expandedIndex === index || !search) return true
      return [course.id, course.name, course.major, course.term, teacherMap.get(course.teacher_id)?.name]
        .join(' ').toLowerCase().includes(search)
    })

  const handleAdd = () => {
    setQuery('')
    setExpandedIndex(courses.length)
    onAdd()
  }

  const handleRemove = (index) => {
    // حذف ممکن است در والد نیازمند تأیید باشد؛ اندیس‌ها را زودتر جابه‌جا نکن.
    setExpandedIndex(null)
    onRemove(index)
  }

  return (
    <div className="page-stack courses-panel" dir="rtl">
      <SectionCard
        title="مدیریت دروس"
        subtitle="هر درس در یک ردیف؛ برای ویرایش، ردیف را باز کنید."
        icon={BookOpen}
        badge={<Badge tone="cyan">{fa(courses.length)} درس</Badge>}
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={handleAdd}>
            <Plus size={16} /> افزودن درس
          </button>
        }
      >
        <div className="cp-toolbar">
          <div className="cp-search">
            <Search size={16} />
            <TextInput
              aria-label="جستجوی درس یا استاد"
              value={query}
              onChange={(value) => { setQuery(value); setExpandedIndex(null) }}
              placeholder="جستجوی درس، شناسه یا استاد…"
            />
            {query && <button type="button" aria-label="پاک کردن جستجو" onClick={() => setQuery('')}>×</button>}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setExpandedIndex(null)} disabled={expandedIndex === null}>
            <ChevronsDownUp size={15} /> جمع کردن
          </button>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="هیچ درسی تعریف نشده است"
            description="یک درس اضافه کنید تا وارد محموله شود."
            action={<button type="button" className="btn btn--primary" onClick={handleAdd}><Plus size={16} /> افزودن درس</button>}
          />
        ) : visibleCourses.length === 0 ? (
          <EmptyState icon={Search} title="درسی پیدا نشد" description="نام درس یا استاد دیگری را جستجو کنید." />
        ) : (
          <div className="cp-list">
            <div className="cp-labels" aria-hidden="true">
              <span>درس / شناسه</span><span>استاد</span><span>ترم</span><span>جلسات هفتگی</span><span />
            </div>

            {visibleCourses.map(({ course, index }) => {
              const id = String(course.id || '').trim()
              const idError = !id ? 'شناسه الزامی است.' : idCounts.get(id) > 1 ? 'این شناسه تکراری است.' : ''
              const nameError = !String(course.name || '').trim() ? 'نام درس خالی است.' : ''
              const teacher = teacherMap.get(course.teacher_id)
              const teacherError = !teacher ? 'استاد انتخاب‌شده وجود ندارد.' : ''
              const sessions = Number(course.sessions_per_week)
              const hours = Number(course.session_hours)
              const sessionsError = !Number.isInteger(sessions) || sessions < 1 || sessions > 7 ? 'بین ۱ تا ۷ جلسه انتخاب کنید.' : ''
              const hoursError = !Number.isInteger(hours) || hours < 1 || hours > 6 ? 'بین ۱ تا ۶ ساعت انتخاب کنید.' : ''
              const majorError = !String(course.major || '').trim() ? 'رشته الزامی است.' : ''
              const termError = !TERM_OPTIONS.includes(course.term) ? 'ترم معتبر انتخاب کنید.' : ''
              const levelError = !LEVEL_OPTIONS.includes(course.level) ? 'مقطع معتبر انتخاب کنید.' : ''
              const weekly = (Number.isFinite(sessions) ? sessions : 0) * (Number.isFinite(hours) ? hours : 0)
              const open = expandedIndex === index
              const hasError = Boolean(idError || nameError || teacherError || sessionsError || hoursError || majorError || termError || levelError)
              const detailsId = `${panelId}-course-${index}`

              return (
                <article className={`cp-row ${open ? 'is-open' : ''} ${hasError ? 'has-error' : ''}`} key={index}>
                  <div className="cp-row-head">
                    <button
                      type="button"
                      className="cp-row-toggle"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      aria-label={`${open ? 'بستن' : 'ویرایش'} درس ${course.name || course.id || fa(index + 1)}`}
                      onClick={() => setExpandedIndex(open ? null : index)}
                    >
                      <span className="cp-identity">
                        <span className="cp-number">{fa(index + 1)}</span>
                        <span className="cp-title">
                          <strong>{course.name || 'بدون نام'}</strong>
                          <small><bdi>{course.id || '—'}</bdi><span>·</span>{LEVEL_LABELS[course.level] || course.level || 'بدون مقطع'}</small>
                          {hasError && <em>نیاز به اصلاح</em>}
                        </span>
                      </span>
                      <span className={`cp-teacher ${teacherError ? 'is-invalid' : ''}`}><UserRound size={13} /><span>{teacher?.name || course.teacher_id || 'بدون استاد'}</span></span>
                      <span className="cp-term"><Badge tone={TERM_TONES[course.term] || 'slate'}>{TERM_LABELS[course.term] || course.term || '—'}</Badge></span>
                      <span className="cp-hours">
                        <span>{fa(Number.isFinite(sessions) ? sessions : 0)} جلسه × {fa(Number.isFinite(hours) ? hours : 0)} ساعت</span>
                        <small><Clock3 size={11} />{fa(weekly)} ساعت در هفته</small>
                      </span>
                      <span className="cp-chevron"><ChevronDown size={17} /></span>
                    </button>
                    {/* دکمه حذف بیرون از دکمه باز/بسته شدن است. */}
                    <IconButton icon={Trash2} label={`حذف درس ${course.name || course.id}`} tone="danger" onClick={() => handleRemove(index)} />
                  </div>

                  <div className="cp-details" id={detailsId} hidden={!open}>
                    <div className="cp-edit-grid">
                      <Field label="نام درس" error={nameError}>
                        <TextInput aria-label="نام درس" value={course.name} onChange={(value) => onUpdate(index, { name: value })} placeholder="مثال: ML" />
                      </Field>
                      <Field label="شناسه یکتا" error={idError}>
                        <TextInput aria-label="شناسه درس" value={course.id} onChange={(value) => onUpdate(index, { id: value })} placeholder="C1" className="ltr-input" dir="ltr" />
                      </Field>
                      <Field label="استاد مربوطه" error={teacherError}>
                        <Select aria-label="استاد درس" value={course.teacher_id} onChange={(value) => onUpdate(index, { teacher_id: value })} options={teacherOptions} placeholder={teachers.length ? 'انتخاب استاد' : 'ابتدا استاد اضافه کنید'} />
                      </Field>
                      <Field label="جلسات در هفته" error={sessionsError}>
                        <Stepper value={course.sessions_per_week} onChange={(value) => onUpdate(index, { sessions_per_week: value })} min={1} max={7} unit="جلسه" />
                      </Field>
                      <Field label="طول هر جلسه" error={hoursError}>
                        <Stepper value={course.session_hours} onChange={(value) => onUpdate(index, { session_hours: value })} min={1} max={6} unit="ساعت" />
                      </Field>
                      <Field label="ترم" error={termError}>
                        <Select aria-label="ترم درس" value={course.term} onChange={(value) => onUpdate(index, { term: value })} options={termOptions} />
                      </Field>
                      <Field label="مقطع" error={levelError}>
                        <Select aria-label="مقطع درس" value={course.level} onChange={(value) => onUpdate(index, { level: value })} options={levelOptions} />
                      </Field>
                      <Field label="رشته" error={majorError}>
                        <TextInput aria-label="رشته درس" value={course.major} onChange={(value) => onUpdate(index, { major: value })} placeholder="CE" className="ltr-input" dir="ltr" />
                      </Field>
                    </div>
                    <div className="cp-edit-footer">
                      <span><Info size={13} />تغییرات مستقیماً در JSON اعمال می‌شوند.</span>
                      <button type="button" className="text-button" onClick={() => setExpandedIndex(null)}>پایان ویرایش <ChevronsDownUp size={13} /></button>
                    </div>
                  </div>
                </article>
              )
            })}

            <button type="button" className="cp-add" onClick={handleAdd}><Plus size={16} /> افزودن درس جدید</button>
          </div>
        )}

        <p className="cp-note"><Info size={14} />تغییر شناسه، تداخل‌های مرتبط را به‌روز می‌کند. با حذف درس، تداخل‌های آن نیز توسط والد مدیریت می‌شوند.</p>
      </SectionCard>
      <details className="cp-guide">
        <summary><Info size={15} /> راهنمای کلیدهای JSON دروس</summary>
        <div><code dir="ltr">id · name · teacher_id · sessions_per_week · session_hours · term · level · major</code><p>ساختار داده‌ها و props تغییر نکرده‌اند؛ فقط چیدمان و باز/بسته شدن ردیف‌ها تغییر کرده است.</p></div>
      </details>
    </div>
  )
}