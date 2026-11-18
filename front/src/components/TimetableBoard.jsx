import { Fragment, useMemo, useState } from 'react'
import {
  CalendarRange, CircleCheck, Download, Hand, RotateCcw, TriangleAlert, Undo2,
} from 'lucide-react'
import '../styles/timetable.css'
import { Badge, SectionCard } from './ui.jsx'
import SessionEditor from './SessionEditor.jsx'
import { downloadJson, fa } from '../lib/format.js'
import {
  computeStats, dayLabel, faTime, isEdited, isSamePlace, layoutBoard, optionMapFor,
  termColorIndex, termLabel, validateTimetable,
} from '../lib/timetable.js'

export const STATUS_META = {
  OPTIMAL: { label: 'بهینه (اثبات‌شده)', tone: 'green' },
  FEASIBLE: { label: 'شدنی (بدون اثبات بهینگی)', tone: 'cyan' },
  INFEASIBLE: { label: 'ناشدنی', tone: 'rose' },
  INVALID_INPUT: { label: 'ورودی نامعتبر', tone: 'amber' },
  UNKNOWN: { label: 'بدون جواب در زمان مجاز', tone: 'slate' },
}

export const isSolved = (response) => response?.status === 'OPTIMAL' || response?.status === 'FEASIBLE'

export default function TimetableBoard({ meta, run, ctx, onMove, onUndo, onReset }) {
  const { sessions, original, history, response } = run
  const { grid } = ctx

  const layout = useMemo(() => layoutBoard(sessions, grid), [sessions, grid])
  const stats = useMemo(() => computeStats(sessions, ctx), [sessions, ctx])
  const validation = useMemo(() => validateTimetable(sessions, ctx), [sessions, ctx])
  const edited = useMemo(() => isEdited(sessions, original), [sessions, original])

  const [dragKey, setDragKey] = useState(null)
  const [overCell, setOverCell] = useState(null)
  const [editingKey, setEditingKey] = useState(null)

  const dragOptions = useMemo(() => {
    const dragged = sessions.find((s) => s.key === dragKey)
    return dragged ? optionMapFor(dragged, ctx) : null
  }, [dragKey, sessions, ctx])

  const status = STATUS_META[response.status] || STATUS_META.UNKNOWN
  const editing = sessions.find((s) => s.key === editingKey)

  const gridColumns = ['78px']
  grid.days.forEach((day) => gridColumns.push(`repeat(${layout.lanesByDay.get(day)}, minmax(104px, 1fr))`))

  const endDrag = () => {
    setDragKey(null)
    setOverCell(null)
  }

  const onDragStart = (event, session) => {
    event.dataTransfer.setData('text/plain', session.key)
    event.dataTransfer.effectAllowed = 'move'
    // بعد از شروع کشیدن، بلوک‌ها از مسیر رها‌کردن کنار می‌روند (pointer-events: none)
    setTimeout(() => setDragKey(session.key), 0)
  }

  const download = () =>
    downloadJson(
      `timetable-${meta.id}.json`,
      JSON.stringify(
        {
          engine: meta.id,
          status: response.status,
          objective: response.objective,
          edited,
          assignments: sessions.map(({ key, ...rest }) => rest),
        },
        null,
        2,
      ),
    )

  const shownViolations = validation.violations.slice(0, 8)

  return (
    <SectionCard
      className="tt-board"
      title={`برنامهٔ ${meta.label}`}
      subtitle={meta.title}
      icon={CalendarRange}
      badge={
        <>
          <Badge tone={status.tone}>{status.label}</Badge>
          {edited && <Badge tone="pink">ویرایش‌شده</Badge>}
        </>
      }
      actions={
        <div className="tt-board__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onUndo(meta.id)} disabled={!history.length}>
            <Undo2 size={14} /> واگرد
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onReset(meta.id)} disabled={!edited}>
            <RotateCcw size={14} /> برگرداندن به خروجی الگوریتم
          </button>
          <button type="button" className="btn btn--glass btn--sm" onClick={download}>
            <Download size={14} /> دانلود JSON
          </button>
        </div>
      }
    >
      <div className="tt-board__stats">
        <span className="tt-chip">روزهای دانشکده <b>{fa(stats.daysUsed.length)}</b></span>
        <span className="tt-chip">روز-استاد <b>{fa(stats.teacherDays)}</b></span>
        <span className="tt-chip">ساعت پرت <b>{fa(stats.gapHours)}</b></span>
        <span className="tt-chip">کلاس هم‌زمان <b>{fa(stats.parallelHours)}</b> ساعت</span>
        {ctx.terms.map((term) => (
          <span className={`tt-chip tt-t${termColorIndex(ctx, term)}`} key={term}>
            {termLabel(term)}: <b>{fa(stats.terms[term].count)}</b> روز
          </span>
        ))}
      </div>

      <p className="tt-help">
        <Hand size={15} />
        <span>برای جابه‌جایی، کلاس را بکشید و روی ساعتِ سبزشده رها کنید؛ برای انتخاب دقیق روز و ساعت روی کلاس کلیک کنید.</span>
      </p>

      <div className="tt-scroll">
        <div
          className={`tt-grid ${dragKey ? 'is-dragging' : ''}`}
          style={{ gridTemplateColumns: gridColumns.join(' '), gridTemplateRows: layout.rowTemplate.join(' ') }}
        >
          <div className="tt-corner" style={{ gridColumn: 1, gridRow: 1 }}>ساعت</div>
          {grid.days.map((day) => (
            <div
              className="tt-dayhead"
              key={`h${day}`}
              style={{ gridColumn: `${layout.colStart.get(day)} / span ${layout.lanesByDay.get(day)}`, gridRow: 1 }}
            >
              {dayLabel(day)}
            </div>
          ))}

          {grid.rows.map((row) => (
            <Fragment key={row.start}>
              {row.breakBefore && (
                <div className="tt-break" style={{ gridColumn: '1 / -1', gridRow: layout.breakLine.get(row.start) }}>
                  {row.breakMinutes >= 60 ? 'زمان ناهار' : 'استراحت'}
                </div>
              )}
              <div className="tt-time" style={{ gridColumn: 1, gridRow: layout.rowLine.get(row.start) }}>
                <strong>{faTime(row.start)}</strong>
                <small>{faTime(row.end)}</small>
              </div>
              {grid.days.map((day) => {
                const cellKey = `${day}|${row.start}`
                const exists = grid.slotAt.has(cellKey)
                const target = dragOptions?.get(cellKey)
                return (
                  <div
                    key={cellKey}
                    data-testid={`cell-${cellKey}`}
                    className={`tt-cell ${exists ? '' : 'tt-cell--none'} ${target ? 'is-target' : ''} ${overCell === cellKey ? 'is-over' : ''}`}
                    style={{
                      gridColumn: `${layout.colStart.get(day)} / span ${layout.lanesByDay.get(day)}`,
                      gridRow: layout.rowLine.get(row.start),
                    }}
                    onDragOver={(event) => {
                      if (!target) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setOverCell(cellKey)
                    }}
                    onDragLeave={() => setOverCell((current) => (current === cellKey ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault()
                      const dragged = sessions.find((s) => s.key === dragKey)
                      if (target && dragged && !isSamePlace(dragged, target)) onMove(meta.id, dragKey, target)
                      endDrag()
                    }}
                  />
                )
              })}
            </Fragment>
          ))}

          {sessions.map((session) => {
            const course = ctx.courses.get(session.course_id)
            const teacher = ctx.teachers.get(session.teacher_id)
            const problems = validation.byKey.get(session.key) || []
            const color = termColorIndex(ctx, course?.term)
            return (
              <button
                type="button"
                key={session.key}
                data-testid={`block-${session.key}`}
                draggable
                className={`tt-block ${color >= 0 ? `tt-t${color}` : 'tt-tn'} ${problems.length ? 'tt-block--bad' : ''} ${dragKey === session.key ? 'is-dragged' : ''}`}
                style={{
                  gridColumn: layout.colStart.get(session.day) + layout.laneOf.get(session.key),
                  gridRow: `${layout.rowLine.get(session.start)} / span ${layout.spanOf(session)}`,
                }}
                title={[
                  `${course?.name || session.course_id} — ${teacher?.name || session.teacher_id}`,
                  `${dayLabel(session.day)} ${faTime(session.start)} تا ${faTime(session.end)}`,
                  ...problems,
                ].join('\n')}
                onClick={() => setEditingKey(session.key)}
                onDragStart={(event) => onDragStart(event, session)}
                onDragEnd={endDrag}
              >
                {problems.length > 0 && <TriangleAlert size={14} className="tt-block__warn" />}
                <span className="tt-block__title">{course?.name || session.course_id}</span>
                <span className="tt-block__meta">{teacher?.name || session.teacher_id}</span>
                <span className="tt-block__time">{faTime(session.start)} – {faTime(session.end)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="tt-legend">
        {ctx.terms.map((term) => (
          <span key={term}>
            <i className={`tt-t${termColorIndex(ctx, term)}`} /> {termLabel(term)}
          </span>
        ))}
        <span><i style={{ borderColor: 'var(--red)', background: 'rgba(248,113,113,.25)' }} /> نقض قانون</span>
      </div>

      {validation.violations.length === 0 ? (
        <p className="tt-ok" data-testid="violations-ok">
          <CircleCheck size={16} /> این برنامه هیچ تداخلی با قوانین (استاد، تداخل‌ها، هم‌ترمی‌ها، روزهای مجاز) ندارد.
        </p>
      ) : (
        <div className="tt-violations" data-testid="violations">
          <h4>
            <TriangleAlert size={14} /> {fa(validation.violations.length)} مورد نقض قانون
          </h4>
          <ul>
            {shownViolations.map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
            {validation.violations.length > shownViolations.length && (
              <li>و {fa(validation.violations.length - shownViolations.length)} مورد دیگر…</li>
            )}
          </ul>
        </div>
      )}

      {editing && (
        <SessionEditor
          session={editing}
          sessions={sessions}
          ctx={ctx}
          onApply={(placement) => onMove(meta.id, editing.key, placement)}
          onClose={() => setEditingKey(null)}
        />
      )}
    </SectionCard>
  )
}
