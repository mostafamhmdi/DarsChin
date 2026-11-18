import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { Field, IconButton, Select } from './ui.jsx'
import { dayLabel, faTime, moveSession, placementsForCourse, validateTimetable } from '../lib/timetable.js'

// ویرایش دقیقِ یک جلسه: فقط روز/ساعت‌هایی که جلسه در آن‌ها «جا می‌شود» پیشنهاد می‌شود
// و تخلف‌های احتمالیِ جایگاه جدید پیش از اعمال نشان داده می‌شود.
export default function SessionEditor({ session, sessions, ctx, onApply, onClose }) {
  const course = ctx.courses.get(session.course_id)
  const teacher = ctx.teachers.get(session.teacher_id)
  const all = useMemo(() => placementsForCourse(ctx, course), [ctx, course])
  const days = useMemo(() => [...new Set(all.map((p) => p.day))], [all])

  const [day, setDay] = useState(session.day)
  const [start, setStart] = useState(session.start)

  useEffect(() => {
    const handler = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const starts = all.filter((p) => p.day === day)
  const chosen = starts.find((p) => p.start === start) || starts[0]
  const unchanged = chosen && chosen.day === session.day && chosen.start === session.start

  const problems = useMemo(
    () => (chosen ? validateTimetable(moveSession(sessions, session.key, chosen), ctx).byKey.get(session.key) || [] : []),
    [chosen, sessions, session.key, ctx],
  )

  const changeDay = (value) => {
    const next = Number(value)
    setDay(next)
    const list = all.filter((p) => p.day === next)
    if (!list.some((p) => p.start === start)) setStart(list[0]?.start)
  }

  const dayOptions = days.map((d) => ({
    value: d,
    label: (teacher?.available_days || []).includes(d) ? dayLabel(d) : `${dayLabel(d)} — خارج از روزهای استاد`,
  }))
  const startOptions = starts.map((p) => ({ value: p.start, label: `${faTime(p.start)} تا ${faTime(p.end)}` }))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="ویرایش جلسه" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="modal__eyebrow">ویرایش جلسه</span>
            <h3>
              {course?.name || session.course_id} · جلسهٔ {faTime(session.session_index + 1)}
            </h3>
          </div>
          <IconButton icon={X} label="بستن" onClick={onClose} />
        </div>

        <p className="modal__message">
          استاد: <b>{teacher?.name || session.teacher_id}</b> · مدت: {faTime(course?.session_hours)} ساعت
        </p>

        <div className="tt-editor">
          <div className="tt-editor__row">
            <Field label="روز">
              <Select value={day} onChange={changeDay} options={dayOptions} aria-label="روز" />
            </Field>
            <Field label="ساعت شروع">
              <Select value={chosen?.start ?? ''} onChange={setStart} options={startOptions} aria-label="ساعت شروع" />
            </Field>
          </div>

          {problems.length > 0 ? (
            <div className="tt-editor__warn">
              <b style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <TriangleAlert size={14} /> این جایگاه قوانین را نقض می‌کند (قابل اعمال است، ولی با هشدار):
              </b>
              <ul>
                {problems.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="tt-editor__ok">
              <CircleCheck size={15} /> این جایگاه با هیچ قانونی تداخل ندارد.
            </p>
          )}
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            انصراف
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!chosen || unchanged}
            onClick={() => {
              onApply(chosen)
              onClose()
            }}
          >
            اعمال تغییر
          </button>
        </div>
      </div>
    </div>
  )
}
