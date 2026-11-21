import { useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, Braces, CalendarDays, ChartNoAxesCombined, CheckCheck, CircleAlert, Clock3, Cpu, FileWarning, FlaskConical, List, LoaderCircle, Search, UserRound } from 'lucide-react'
import { Badge, SectionCard } from './ui.jsx'
import { inspectAssignments, solverStatus } from '../lib/scheduling.js'
import { downloadJson, fa, highlightJson } from '../lib/format.js'
import { WEEKDAY_LABELS } from '../data/staticData.js'

const number = (value) => typeof value === 'number' && Number.isFinite(value) ? fa(value) : '—'
const stringify = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2)
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value)

function RunBadge({ run }) {
  if (run.state === 'running') return <Badge tone="violet" icon={LoaderCircle} className="badge--spin">در حال حل</Badge>
  if (run.state === 'queued') return <Badge tone="slate">در صف</Badge>
  if (run.state === 'cancelled') return <Badge tone="slate">لغو دریافت</Badge>
  if (run.state === 'error') return <Badge tone="rose">{run.status ? `HTTP ${run.status}` : 'خطای درخواست'}</Badge>
  const meta = solverStatus(run.body?.status)
  return <Badge tone={meta.tone}>{meta.label} <bdi>{run.body?.status}</bdi></Badge>
}

function JsonBlock({ value }) {
  return <pre className="json-preview result-json" dir="ltr"><code dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(value, null, 2) ?? 'null') }} /></pre>
}

export default function ResultsPanel({ runState, availableEngines, connection, busy, phaseLabel, mode, onOpenSettings }) {
  const [selectedName, setSelectedName] = useState('')
  const [view, setView] = useState('week')
  const [teacherFilter, setTeacherFilter] = useState('')
  const runs = runState.runs
  const active = runs.find((run) => run.name === selectedName) || runs.find((run) => run.state === 'success') || runs[0]
  const snapshot = runState.payload || { teachers: [], courses: [] }
  const { assignments, warnings } = useMemo(() => inspectAssignments(active?.body), [active?.body])
  const activeTeacherFilter = snapshot.teachers.some((teacher) => teacher.id === teacherFilter) ? teacherFilter : ''
  const filteredAssignments = assignments.filter((item) => !activeTeacherFilter || item.teacher_id === activeTeacherFilter)
  const finished = runs.filter((run) => !['queued', 'running'].includes(run.state)).length
  const received = runs.filter((run) => run.state === 'success').length
  const responseMode = runState.mode || mode
  const isSample = responseMode === 'sample'
  const isDemoResult = !isSample && (responseMode === 'mock' || runs.some((run) => run.body?.demo === true))
  const meta = solverStatus(active?.body?.status)
  const courseMap = new Map(snapshot.courses.map((course) => [course.id, course]))
  const teacherMap = new Map(snapshot.teachers.map((teacher) => [teacher.id, teacher]))
  const expectedSessions = snapshot.courses.reduce((sum, course) => sum + Number(course.sessions_per_week || 0), 0)
  const downloadAll = () => downloadJson('schedule-results.json', JSON.stringify({
    demo: isDemoResult, sample: isSample, started_at: new Date(runState.startedAt).toISOString(),
    input: snapshot, selector: runState.selector,
    results: runs.map((run) => ({ requested_engine: run.name, request_state: run.state, http_status: run.status, response: run.body ?? null, ...(run.message ? { error: run.message } : {}) })),
  }, null, 2))

  return (
    <SectionCard className="results-panel" title="نتایج الگوریتم‌ها" subtitle={runs.length ? 'هر الگوریتم، یک پاسخ مستقل؛ یک خطا نتیجه‌های دیگر را حذف نمی‌کند.' : 'بعد از پردازش، برنامه و تحلیل هر الگوریتم اینجا نمایش داده می‌شود.'} icon={ChartNoAxesCombined}
      badge={runs.length ? <Badge tone={busy ? 'violet' : 'slate'}>{busy ? `${fa(finished)} از ${fa(runs.length)}` : `${fa(received)} پاسخ`}</Badge> : null}
      actions={runs.length ? <button type="button" className="btn btn--ghost btn--sm" onClick={downloadAll} disabled={busy}><ArrowDownToLine size={14} /> خروجی همه</button> : <span className="results-panel__caption"><Activity size={13} /> آماده برای مقایسه</span>}>
      {runs.length === 0 ? (
        <div className="results-empty">
          <div className={`results-empty__visual ${busy ? 'is-loading' : ''}`} aria-hidden="true">
            <div className="mini-calendar"><div><i /><i /></div><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            <span className="results-empty__symbol">{busy ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}</span>
          </div>
          <h3>{busy ? phaseLabel : 'برنامهٔ بعدی، همین‌جا شکل می‌گیرد'}</h3>
          <p>{busy ? 'درخواست‌ها با یک نسخه ثابت از داده‌ها آماده می‌شوند.' : '«پردازش برنامه» را بزنید؛ نیازی به ارسال جداگانه برای هر الگوریتم نیست.'}</p>
          <div className="ready-engines">
            {availableEngines.map((engine) => <span key={engine.name}><i /><bdi>{engine.name}</bdi></span>)}
            {!availableEngines.length && connection.status === 'loading' && <span><LoaderCircle size={12} className="spin" /> دریافت الگوریتم‌ها</span>}
            {!availableEngines.length && connection.status !== 'loading' && <button type="button" className="text-button" onClick={onOpenSettings}>بررسی اتصال و الگوریتم‌ها</button>}
          </div>
        </div>
      ) : (
        <>
          {isSample && <div className="result-demo-label result-demo-label--sample"><FlaskConical size={13} />نمونهٔ پاسخ واقعی حلگر <bdi>milp</bdi> · برای بررسی نحوهٔ نمایش خروجی، بدون ارسال درخواست.</div>}
          {isDemoResult && <div className="result-demo-label"><FlaskConical size={13} />نتیجه نمایشی · داده‌های زیر پاسخ حلگر واقعی نیستند.</div>}
          <div className="table-scroll comparison-scroll">
            <table className="comparison-table" aria-label="مقایسه الگوریتم‌ها">
              <thead><tr><th>الگوریتم</th><th>وضعیت حل</th><th>تابع هدف</th><th>بهترین کران</th><th>زمان حل</th><th>جلسات</th><th><span className="sr-only">انتخاب نتیجه</span></th></tr></thead>
              <tbody>{runs.map((run, index) => (
                <tr key={run.name} className={active?.name === run.name ? 'is-selected' : ''}>
                  <th scope="row"><button type="button" className="engine-name" onClick={() => setSelectedName(run.name)} aria-label={`نمایش نتیجه ${run.name}`} aria-pressed={active?.name === run.name}><span className={`engine-mark engine-mark--${index % 3}`}><Cpu size={15} /></span><bdi>{run.name}</bdi></button></th>
                  <td><RunBadge run={run} /></td>
                  <td className="numeric-cell">{number(run.body?.objective)}</td><td className="numeric-cell muted-cell">{number(run.body?.best_bound)}</td>
                  <td className="numeric-cell">{typeof run.body?.solve_time_sec === 'number' ? <>{number(run.body.solve_time_sec)} <small>ثانیه</small></> : '—'}</td>
                  <td className="numeric-cell">{run.state === 'success' && Array.isArray(run.body?.assignments) ? fa(run.body.assignments.length) : '—'}</td>
                  <td><button type="button" className={`result-select ${active?.name === run.name ? 'is-active' : ''}`} onClick={() => setSelectedName(run.name)} aria-label={`جزئیات ${run.name}`}>{active?.name === run.name ? <CheckCheck size={15} /> : 'مشاهده'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="result-detail">
            <div className="result-detail__head"><div><span className="result-detail__line" /><h3>خروجی <bdi>{active.name}</bdi></h3><RunBadge run={active} /></div>{active.state === 'success' && <button type="button" className="text-button" onClick={() => downloadJson(`schedule-${active.name}.json`, JSON.stringify(active.body, null, 2))}><ArrowDownToLine size={14} /> JSON خروجی</button>}</div>
            {['queued', 'running'].includes(active.state) ? <div className="result-pending" role="status"><LoaderCircle size={24} className="spin" /><strong>{active.state === 'queued' ? 'در صف اجرای الگوریتم' : 'الگوریتم در حال حل مسئله است…'}</strong><p>حداکثر دو موتور هم‌زمان اجرا می‌شوند. پاسخ هر موتور به محض دریافت نمایش داده می‌شود.</p></div> :
              active.state === 'cancelled' ? <div className="result-pending"><CircleAlert size={23} /><strong>دریافت این پاسخ لغو شد</strong><p>لغو درخواست مرورگر الزاماً پردازش در سرور را متوقف نمی‌کند.</p></div> :
              active.state === 'error' ? <div className="result-request-error"><div className="overview-notice overview-notice--error"><CircleAlert size={17} /><span>{active.message}</span></div>{active.body != null && <details><summary>جزئیات پاسخ خطا {active.status ? `(HTTP ${active.status})` : ''}</summary><JsonBlock value={active.body} /></details>}</div> : (
                <>
                  <div className="result-toolbar">
                    <div className="result-tabs" role="tablist" aria-label="نمایش خروجی الگوریتم">
                      {[{ id: 'week', text: 'برنامه هفتگی', icon: CalendarDays }, { id: 'list', text: 'جلسات', icon: List }, { id: 'analysis', text: 'تحلیل و تشخیص', icon: Activity }, { id: 'json', text: 'JSON خام', icon: Braces }].map(({ id, text, icon: Icon }) => <button key={id} type="button" role="tab" id={`result-tab-${id}`} aria-selected={view === id} aria-controls="result-view" onClick={() => setView(id)} className={view === id ? 'is-active' : ''}><Icon size={14} />{text}</button>)}
                    </div>
                    {meta.feasible && ['week', 'list'].includes(view) && <select className="select result-teacher-filter" aria-label="فیلتر استاد" value={activeTeacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="">همه اساتید</option>{snapshot.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select>}
                  </div>
                  <div id="result-view" role="tabpanel" aria-labelledby={`result-tab-${view}`} tabIndex={0}>
                    {warnings.length > 0 && <div className="assignment-warnings">{warnings.map((warning) => <p key={warning}><CircleAlert size={14} />{warning}</p>)}</div>}
                    {meta.feasible && assignments.length !== expectedSessions && <p className="assignment-count-warning">تعداد جلسات معتبر پاسخ ({fa(assignments.length)}) با ورودی ({fa(expectedSessions)}) یکسان نیست. جزئیات را در JSON خام بررسی کنید.</p>}
                    {view === 'json' ? <JsonBlock value={active.body} /> : view === 'analysis' ? <ResultAnalysis body={active.body} /> : !meta.feasible ? (
                      <div className="solver-outcome"><FileWarning size={30} /><h4>{meta.label}</h4><p>{active.body.status?.toUpperCase() === 'INFEASIBLE' ? 'طبق پاسخ این حلگر، با محدودیت‌های فعلی برنامه شدنی وجود ندارد.' : active.body.status?.toUpperCase() === 'UNKNOWN' ? 'حلگر در مهلت یا شرایط فعلی به نتیجه قطعی نرسیده است؛ این به معنی ناممکن بودن مسئله نیست.' : 'برای این وضعیت، برنامه هفتگی معتبر نمایش داده نمی‌شود. جزئیات را در تحلیل یا JSON خام ببینید.'}</p><button type="button" className="btn btn--ghost btn--sm" onClick={() => setView('analysis')}>مشاهده تحلیل و تشخیص</button></div>
                    ) : view === 'week' ? <WeeklySchedule assignments={filteredAssignments} allAssignments={assignments} courseMap={courseMap} teacherMap={teacherMap} /> : <AssignmentTable assignments={filteredAssignments} courseMap={courseMap} teacherMap={teacherMap} />}
                  </div>
                </>
              )}
          </div>
        </>
      )}
    </SectionCard>
  )
}

function WeeklySchedule({ assignments, allAssignments, courseMap, teacherMap }) {
  const days = [...new Set([0, 1, 2, 3, 4, ...allAssignments.map((item) => item.day)])].sort((a, b) => a - b)
  return <div className="weekly-schedule"><div className="schedule-caption"><span><CalendarDays size={13} />{fa(assignments.length)} جلسه · به ترتیب روز و ساعت</span><span>روز ۰ = شنبه</span></div><div className="week-scroll"><div className="week-board" style={{ '--day-count': days.length }}>
    {days.map((day) => {
      const sessions = assignments.filter((item) => item.day === day)
      return <section className="week-day" key={day} aria-label={WEEKDAY_LABELS[day]}><div className="week-day__head"><strong>{WEEKDAY_LABELS[day]}</strong><span>{fa(sessions.length)} جلسه</span></div><div className="week-day__sessions">{sessions.length === 0 ? <div className="week-day__empty"><span />بدون جلسه</div> : sessions.map((session, index) => {
        const course = courseMap.get(session.course_id)
        return <article className={`schedule-session schedule-session--${Math.max(0, ['Term1', 'Term2', 'Term3'].indexOf(course?.term))}`} key={`${session.course_id}-${session.session_index}-${index}`}><div className="schedule-session__time"><Clock3 size={12} /><bdi>{session.start} – {session.end}</bdi></div><h4>{course?.name || session.course_id}</h4><span className="schedule-session__teacher"><UserRound size={11} />{teacherMap.get(session.teacher_id)?.name || session.teacher_id}</span><div className="schedule-session__foot"><bdi>{session.course_id}</bdi><span title={`session_index: ${session.session_index}`}>جلسه {fa(session.session_index + 1)}</span></div></article>
      })}</div></section>
    })}
  </div></div></div>
}

function AssignmentTable({ assignments, courseMap, teacherMap }) {
  return <div className="table-scroll"><table className="assignment-table" aria-label="فهرست جلسات"><thead><tr><th>درس</th><th>استاد</th><th>روز</th><th>ساعت</th><th>اندیس جلسه (از ۰)</th><th>اسلات‌ها</th></tr></thead><tbody>{assignments.map((item, index) => <tr key={index}><td><strong>{courseMap.get(item.course_id)?.name || item.course_id}</strong><small><bdi>{item.course_id}</bdi></small></td><td>{teacherMap.get(item.teacher_id)?.name || item.teacher_id}</td><td>{WEEKDAY_LABELS[item.day]}</td><td><bdi>{item.start} – {item.end}</bdi></td><td>{fa(item.session_index)}</td><td><code>{Array.isArray(item.slot_ids) ? item.slot_ids.join(', ') : '—'}</code></td></tr>)}</tbody></table>{assignments.length === 0 && <p className="muted result-no-sessions">جلسه‌ای برای فیلتر فعلی وجود ندارد.</p>}</div>
}

function ResultAnalysis({ body }) {
  const breakdown = isRecord(body.objective_breakdown) ? Object.entries(body.objective_breakdown) : []
  const metrics = isRecord(body.metrics) ? body.metrics : {}
  const teacherRows = isRecord(metrics.teachers) ? Object.entries(metrics.teachers).filter(([, value]) => isRecord(value)) : []
  const nestedMetrics = Object.entries(metrics).filter(([key, value]) => isRecord(value) && !(key === 'teachers' && teacherRows.length === Object.keys(value).length))
  return <div className="result-analysis">
    <div className="analysis-stats"><div><span>تابع هدف</span><strong>{number(body.objective)}</strong></div><div><span>بهترین کران</span><strong>{number(body.best_bound)}</strong></div><div><span>زمان حل (ثانیه)</span><strong>{number(body.solve_time_sec)}</strong></div><div><span>وضعیت حل</span><strong><bdi>{body.status}</bdi></strong></div></div>
    <div className="analysis-columns"><section><h4>اجزای تابع هدف <code>objective_breakdown</code></h4>{breakdown.length ? <dl className="metric-list">{breakdown.map(([key, value]) => <div key={key}><dt><bdi>{key}</bdi></dt><dd>{typeof value === 'number' ? number(value) : <code>{stringify(value)}</code>}</dd></div>)}</dl> : <p className="muted">جزئیاتی دریافت نشده است.</p>}</section><section><h4>معیارهای اجرا <code>metrics</code></h4>{Object.keys(metrics).length ? <dl className="metric-list">{Object.entries(metrics).filter(([, value]) => !isRecord(value)).map(([key, value]) => <div key={key}><dt><bdi>{key}</bdi></dt><dd>{Array.isArray(value) && key === 'days_used_overall' ? value.map((day) => WEEKDAY_LABELS[day] ?? day).join('، ') || '—' : typeof value === 'number' ? number(value) : <code>{stringify(value)}</code>}</dd></div>)}</dl> : <p className="muted">معیاری دریافت نشده است.</p>}</section></div>
    {teacherRows.length > 0 && <section className="teacher-metrics">
      <h4>بار کاری اساتید <code>metrics.teachers</code></h4>
      <div className="table-scroll"><table className="assignment-table teacher-metrics__table" aria-label="بار کاری اساتید">
        <thead><tr><th>استاد</th><th>شناسه</th><th>روزهای حضور</th><th>روزها</th><th>ساعت تدریس</th><th>ساعت خالی</th></tr></thead>
        <tbody>{teacherRows.map(([id, value]) => <tr key={id}>
          <td><strong>{typeof value.name === 'string' && value.name ? value.name : '—'}</strong></td>
          <td><bdi>{id}</bdi></td>
          <td>{number(value.days_on_campus)}</td>
          <td>{Array.isArray(value.days) ? value.days.map((day) => WEEKDAY_LABELS[day] ?? day).join('، ') || '—' : '—'}</td>
          <td>{number(value.teaching_hours)}</td>
          <td className={Number(value.gap_hours) > 0 ? 'has-gap' : ''}>{number(value.gap_hours)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
    {nestedMetrics.map(([key, value]) => <details className="metric-details" key={key}><summary>جزئیات <bdi>{key}</bdi></summary><JsonBlock value={value} /></details>)}
    <DiagnosticList title="پیام‌ها و مشکلات" code="issues" items={body.issues} />
    <DiagnosticList title="هسته ناسازگاری محدودیت‌ها" code="infeasibility_core" items={body.infeasibility_core} />
  </div>
}
function DiagnosticList({ title, code, items }) {
  const list = Array.isArray(items) ? items : items == null ? [] : [items]
  return <section className={`diagnostic-list ${list.length ? 'has-issues' : ''}`}><h4>{list.length ? <CircleAlert size={15} /> : <CheckCheck size={15} />}{title}<code>{code}</code><Badge tone={list.length ? 'amber' : 'slate'}>{fa(list.length)}</Badge></h4>{list.length ? <ul>{list.map((item, index) => <li key={index}><pre>{stringify(item)}</pre></li>)}</ul> : <p>موردی گزارش نشده است.</p>}</section>
}
