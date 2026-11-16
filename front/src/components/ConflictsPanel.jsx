import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  GitBranch,
  Hash,
  Info,
  Link2Off,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react'
import { Badge, EmptyState, Field, IconButton, SectionCard, Select } from './ui.jsx'
import { courseLabel } from '../data/staticData.js'
import { fa } from '../lib/format.js'

const pairKey = (a, b) => [a, b].sort().join('::')

export default function ConflictsPanel({ courses, conflicts, onAdd, onRemove }) {
  const options = useMemo(
    () => courses.map((course) => ({ value: course.id, label: courseLabel(course) })),
    [courses],
  )

  const [pair, setPair] = useState(() => ({
    course_a: courses[0]?.id || '',
    course_b: courses[1]?.id || '',
  }))
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    const ids = new Set(courses.map((course) => course.id))
    if (!ids.has(pair.course_a) || !ids.has(pair.course_b)) {
      setPair({ course_a: courses[0]?.id || '', course_b: courses[1]?.id || '' })
    }
  }, [courses, pair.course_a, pair.course_b])

  const conflictSet = useMemo(
    () => new Set(conflicts.map((conflict) => pairKey(conflict.course_a, conflict.course_b))),
    [conflicts],
  )

  const handleAdd = () => {
    const result = onAdd(pair)
    if (result === false || result?.ok === false) {
      setLocalError(result?.message || 'این تداخل معتبر نیست.')
      return
    }
    setLocalError('')
    const remaining = courses.filter((course) => course.id !== pair.course_a && course.id !== pair.course_b)
    setPair({
      course_a: pair.course_b || courses[0]?.id || '',
      course_b: remaining[0]?.id || courses.find((course) => course.id !== pair.course_b)?.id || '',
    })
  }

  return (
    <div className="page-stack">
      <SectionCard
        title="تداخلهای میان دروس"
        subtitle="مشخص کنید کدام جفت دروس نباید در یک بازهٔ زمانی قرار بگیرند"
        icon={Link2Off}
        badge={<Badge tone="pink">{fa(conflicts.length)} جفت</Badge>}
      >
        <div className="info-banner">
          <Info size={16} />
          <span>
            تداخلها به صورت جفت <bdi dir="ltr">course_a / course_b</bdi> ذخیره میشوند. جفت تکراری (حتی با جابهجایی
            طرفین) و تداخل یک درس با خودش پذیرفته نمیشود.
          </span>
        </div>

        <div className="conflict-layout">
          <div className="conflict-form">
            <div className="conflict-form__head">
              <span className="conflict-form__icon"><Plus size={18} /></span>
              <div>
                <strong>افزودن تداخل جدید</strong>
                <small>دو درس متفاوت انتخاب کنید</small>
              </div>
            </div>

            <Field label="درس اول" error={!pair.course_a ? 'درس اول انتخاب نشده است.' : ''}>
              <Select
                value={pair.course_a}
                onChange={(value) => setPair((prev) => ({ ...prev, course_a: value }))}
                options={options}
                placeholder="انتخاب درس"
              />
            </Field>

            <div className="conflict-form__swap">
              <span />
              <ArrowLeftRight size={17} />
              <span />
            </div>

            <Field label="درس دوم" error={!pair.course_b ? 'درس دوم انتخاب نشده است.' : ''}>
              <Select
                value={pair.course_b}
                onChange={(value) => setPair((prev) => ({ ...prev, course_b: value }))}
                options={options}
                placeholder="انتخاب درس"
              />
            </Field>

            {localError && (
              <div className="inline-error">
                <CircleAlert size={15} /> {localError}
              </div>
            )}

            <button type="button" className="btn btn--primary btn--block" onClick={handleAdd} disabled={courses.length < 2}>
              <Plus size={16} />
              ثبت تداخل
            </button>
          </div>

          <div className="conflict-list">
            <div className="conflict-list__head">
              <div>
                <strong>لیست تداخلها</strong>
                <small>{fa(conflicts.length)} رابطهٔ ثبتشده</small>
              </div>
              <Badge tone="slate" icon={GitBranch}>graph</Badge>
            </div>

            {conflicts.length === 0 ? (
              <EmptyState
                icon={Link2Off}
                title="تداخلی ثبت نشده است"
                description="با فرم مقابل اولین جفت دروس را اضافه کنید."
              />
            ) : (
              <div className="conflict-rows">
                {conflicts.map((conflict, index) => {
                  const a = courses.find((course) => course.id === conflict.course_a)
                  const b = courses.find((course) => course.id === conflict.course_b)
                  const invalid = !a || !b || conflict.course_a === conflict.course_b
                  return (
                    <div className={`conflict-row ${invalid ? 'is-invalid' : ''}`} key={`${conflict.course_a}-${conflict.course_b}-${index}`}>
                      <span className="conflict-row__index">{fa(index + 1)}</span>
                      <div className="conflict-row__pair">
                        <span className="conflict-row__course">{courseLabel(a)}</span>
                        <span className="conflict-row__link"><ArrowLeftRight size={14} /></span>
                        <span className="conflict-row__course">{courseLabel(b)}</span>
                      </div>
                      {invalid && <CircleAlert size={15} className="conflict-row__warn" />}
                      <IconButton icon={Trash2} label="حذف تداخل" tone="danger" onClick={() => onRemove(index)} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="ماتریس تداخل" subtitle="نمایش سریع روابط بین دروس" icon={Table2}>
        {courses.length === 0 ? (
          <EmptyState icon={Table2} title="درسی وجود ندارد" description="برای نمایش ماتریس ابتدا درس اضافه کنید." />
        ) : (
          <div className="matrix-scroll">
            <div className="conflict-matrix" style={{ '--matrix-size': courses.length }}>
              <div className="conflict-matrix__corner">#</div>
              {courses.map((course) => (
                <div className="conflict-matrix__col" key={`col-${course.id}`} title={courseLabel(course)}>
                  {course.id}
                </div>
              ))}
              {courses.map((rowCourse) => (
                <div className="conflict-matrix__row" key={`row-${rowCourse.id}`} style={{ display: 'contents' }}>
                  <div className="conflict-matrix__rowhead" title={courseLabel(rowCourse)}>{rowCourse.id}</div>
                  {courses.map((colCourse) => {
                    const isSelf = rowCourse.id === colCourse.id
                    const isConflict = conflictSet.has(pairKey(rowCourse.id, colCourse.id))
                    return (
                      <div
                        key={`${rowCourse.id}-${colCourse.id}`}
                        className={`conflict-matrix__cell ${isSelf ? 'is-self' : ''} ${isConflict ? 'is-conflict' : ''}`}
                        title={isSelf ? 'همان درس' : isConflict ? 'تداخل دارد' : 'بدون تداخل'}
                      >
                        {isSelf ? '—' : isConflict ? '×' : ''}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="matrix-legend">
          <span><i className="matrix-legend__swatch is-conflict" /> تداخل</span>
          <span><i className="matrix-legend__swatch is-self" /> قطر جدول</span>
          <span><i className="matrix-legend__swatch" /> بدون تداخل</span>
        </div>
      </SectionCard>

      <SectionCard title="ساختار خروجی" subtitle="هر ردیف در آرایهٔ conflicts" icon={Hash}>
        <div className="schema-grid">
          <SchemaItem icon={CircleCheck} title="course_a" desc="شناسهٔ درس اول" />
          <SchemaItem icon={CircleCheck} title="course_b" desc="شناسهٔ درس دوم" />
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
