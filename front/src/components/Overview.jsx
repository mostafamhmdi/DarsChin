import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpLeft, BookOpen, CalendarRange, Cpu, Gauge, LayoutGrid, Link2Off, Loader2, Play, Rows3,
  Sparkles, Square, TriangleAlert, Users,
} from 'lucide-react'
import '../styles/timetable.css'
import { Badge, EmptyState, SectionCard } from './ui.jsx'
import TimetableBoard, { STATUS_META, isSolved } from './TimetableBoard.jsx'
import { ENGINES } from '../hooks/useScheduleRuns.js'
import { computeStats, isEdited, validateTimetable } from '../lib/timetable.js'
import { fa } from '../lib/format.js'

function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])
  return <>{fa(Math.max(0, Math.floor((now - since) / 1000)))}</>
}

function EngineCard({ meta, run, ctx, active, onSelect }) {
  const solved = run.status === 'done' && isSolved(run.response)
  const stats = useMemo(() => (solved && ctx ? computeStats(run.sessions, ctx) : null), [solved, run.sessions, ctx])
  const violations = useMemo(() => (solved && ctx ? validateTimetable(run.sessions, ctx).violations.length : 0), [solved, run.sessions, ctx])

  let badge = <Badge tone="slate">آماده</Badge>
  if (run.status === 'loading') badge = <Badge tone="violet" icon={Loader2} className="badge--spin">در حال محاسبه</Badge>
  else if (run.status === 'error') badge = <Badge tone="rose">خطا</Badge>
  else if (run.status === 'done') {
    const status = STATUS_META[run.response.status] || STATUS_META.UNKNOWN
    badge = <Badge tone={status.tone}>{status.label}</Badge>
  }

  return (
    <button type="button" className={`tt-engine ${active ? 'is-active' : ''}`} onClick={() => onSelect(meta.id)} aria-pressed={active} data-testid={`engine-${meta.id}`}>
      <div className="tt-engine__head">
        <div className="tt-engine__name">
          {meta.label}
          <small>{meta.title}</small>
        </div>
        {badge}
      </div>

      {run.status === 'idle' && <p className="tt-engine__hint">{meta.hint}</p>}

      {run.status === 'loading' && (
        <p className="tt-engine__note">
          <Loader2 size={14} className="spin" />
          <span><Elapsed since={run.startedAt} /> ثانیه از شروع…</span>
        </p>
      )}

      {run.status === 'error' && <p className="tt-engine__note"><TriangleAlert size={14} /> <span>{run.message}</span></p>}

      {run.status === 'done' && !solved && (
        <p className="tt-engine__note"><TriangleAlert size={14} /> <span>برنامه‌ای تولید نشد؛ جزئیات در پایین.</span></p>
      )}

      {solved && stats && (
        <div className="tt-kpis">
          <div className="tt-kpi"><small>مقدار هدف</small><strong>{fa(Math.round(run.response.objective))}</strong></div>
          <div className="tt-kpi"><small>زمان حل</small><strong>{fa(Number(run.response.solve_time_sec).toFixed(1))} ثانیه</strong></div>
          <div className="tt-kpi"><small>روزهای دانشکده</small><strong>{fa(stats.daysUsed.length)}</strong></div>
          <div className="tt-kpi"><small>ساعت پرت</small><strong>{fa(stats.gapHours)}</strong></div>
          <div className={`tt-kpi ${violations ? 'tt-kpi--bad' : 'tt-kpi--good'}`}>
            <small>نقض قانون</small><strong>{violations ? fa(violations) : 'ندارد'}</strong>
          </div>
          <div className="tt-kpi"><small>وضعیت برنامه</small><strong>{isEdited(run.sessions, run.original) ? 'ویرایش‌شده' : 'خروجی اصلی'}</strong></div>
        </div>
      )}
    </button>
  )
}

function ProblemCard({ meta, run }) {
  const response = run.response
  const status = response ? STATUS_META[response.status] || STATUS_META.UNKNOWN : null
  return (
    <SectionCard
      title={`برنامهٔ ${meta.label}`}
      subtitle={meta.title}
      icon={CalendarRange}
      badge={status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="rose">خطا</Badge>}
    >
      <div className="tt-problem" data-testid={`problem-${meta.id}`}>
        {run.status === 'error' && <p>{run.message}</p>}
        {response?.status === 'INFEASIBLE' && (
          <p>با قوانین فعلی هیچ برنامه‌ای ساخته نمی‌شود. تداخل‌ها، روزهای مجاز اساتید یا هم‌ترمی‌ها را کمی شل‌تر کنید.</p>
        )}
        {response?.status === 'UNKNOWN' && <p>الگوریتم در زمان مجاز به هیچ جوابی نرسید.</p>}
        {response?.issues?.length > 0 && (
          <ul>
            {response.issues.map((issue, i) => (
              <li key={i}>{issue.message} <code>{issue.code}</code></li>
            ))}
          </ul>
        )}
        {response?.infeasibility_core?.length > 0 && (
          <>
            <p>گروه قیدهایی که با هم ناسازگارند:</p>
            <ul>{response.infeasibility_core.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
          </>
        )}
      </div>
    </SectionCard>
  )
}

export default function Overview({ teachers, courses, conflicts, validation, onNavigate, schedule }) {
  const [active, setActive] = useState(ENGINES[0].id)
  const [view, setView] = useState('single') // single | all
  const { runs, snapshot, running, hasResults, stale, runAll, cancel, move, undo, reset } = schedule

  const weeklyHours = courses.reduce(
    (sum, course) => sum + Number(course.sessions_per_week || 0) * Number(course.session_hours || 0),
    0,
  )

  const renderEngine = (meta) => {
    const run = runs[meta.id]
    if (run.status === 'done' && isSolved(run.response)) {
      return <TimetableBoard key={meta.id} meta={meta} run={run} ctx={snapshot.ctx} onMove={move} onUndo={undo} onReset={reset} />
    }
    if (run.status === 'error' || run.status === 'done') return <ProblemCard key={meta.id} meta={meta} run={run} />
    if (run.status === 'loading') {
      return (
        <SectionCard key={meta.id} title={`برنامهٔ ${meta.label}`} subtitle={meta.title} icon={CalendarRange}>
          <p className="tt-engine__note"><Loader2 size={14} className="spin" /> <span>در حال محاسبه… نتیجه به‌محض آماده شدن اینجا نمایش داده می‌شود.</span></p>
        </SectionCard>
      )
    }
    return null
  }

  return (
    <div className="page-stack">
      <div className="hero-card">
        <div className="hero-card__glow hero-card__glow--one" />
        <div className="hero-card__glow hero-card__glow--two" />
        <div className="hero-card__content">
          <Badge tone="glass" icon={Sparkles}>سه الگوریتم · یک دادهٔ مشترک</Badge>
          <h2>برنامهٔ درسی را بسازید، مقایسه کنید و ویرایش کنید.</h2>
          <p>
            با اساتید، دروس و تداخل‌هایی که در بخش‌های دیگر وارد کرده‌اید، هر سه الگوریتم (CP-SAT، MILP و CSP)
            هم‌زمان اجرا می‌شوند و برنامهٔ هر کدام قابل‌ویرایش نمایش داده می‌شود.
          </p>
          <div className="tt-run-chips">
            <span className="tt-chip"><Users size={13} /> <b>{fa(teachers.length)}</b> استاد</span>
            <span className="tt-chip"><BookOpen size={13} /> <b>{fa(courses.length)}</b> درس</span>
            <span className="tt-chip"><Link2Off size={13} /> <b>{fa(conflicts.length)}</b> تداخل</span>
            <span className="tt-chip"><Cpu size={13} /> <b>{fa(weeklyHours)}</b> ساعت آموزشی هفتگی</span>
          </div>
          <div className="hero-card__actions">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={runAll}
              disabled={!validation.isValid || running}
              data-testid="run-all"
            >
              {running ? <Loader2 size={17} className="spin" /> : <Play size={17} />}
              {running ? 'در حال محاسبه…' : hasResults ? 'اجرای دوباره' : 'ساخت برنامهٔ درسی'}
            </button>
            {running && (
              <button type="button" className="btn btn--glass btn--lg" onClick={cancel}>
                <Square size={15} /> لغو
              </button>
            )}
            {!running && (
              <button type="button" className="btn btn--glass btn--lg" onClick={() => onNavigate('teachers')}>
                ویرایش دادهها <ArrowUpLeft size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="hero-card__orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring--1" />
          <div className="orbit-ring orbit-ring--2" />
          <div className="orbit-core"><Gauge size={34} strokeWidth={1.5} /></div>
          <span className="orbit-dot orbit-dot--1" />
          <span className="orbit-dot orbit-dot--2" />
          <span className="orbit-dot orbit-dot--3" />
        </div>
      </div>

      {!validation.isValid && (
        <div className="tt-banner tt-banner--error" data-testid="invalid-banner">
          <TriangleAlert size={18} />
          <p>
            دادهها هنوز معتبر نیستند و اجرا غیرفعال است: {validation.errors.slice(0, 2).join(' · ')}
            {validation.errors.length > 2 && ` · و ${fa(validation.errors.length - 2)} خطای دیگر`}
          </p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('payload')}>مشاهدهٔ خطاها</button>
        </div>
      )}

      {stale && hasResults && (
        <div className="tt-banner" data-testid="stale-banner">
          <TriangleAlert size={18} />
          <p>اساتید، دروس یا تداخل‌ها بعد از آخرین اجرا تغییر کرده‌اند؛ برنامه‌های زیر مربوط به دادهٔ قبلی‌اند. دوباره اجرا کنید.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={runAll} disabled={!validation.isValid || running}>اجرای دوباره</button>
        </div>
      )}

      {!hasResults && !running ? (
        <SectionCard title="برنامه‌ها" subtitle="خروجی سه الگوریتم اینجا نمایش داده می‌شود" icon={CalendarRange}>
          <EmptyState
            icon={CalendarRange}
            title="هنوز برنامه‌ای ساخته نشده است"
            description="دکمهٔ «ساخت برنامهٔ درسی» را بزنید. الگوریتم‌ها با دادهٔ فعلی اجرا می‌شوند و نتیجه‌ها به‌محض آماده شدن نمایش داده می‌شوند."
          />
        </SectionCard>
      ) : (
        <>
          <div className="tt-engines">
            {ENGINES.map((meta) => (
              <EngineCard key={meta.id} meta={meta} run={runs[meta.id]} ctx={snapshot?.ctx} active={active === meta.id} onSelect={setActive} />
            ))}
          </div>

          <div className="tt-toolbar">
            <div className="tt-seg" role="group" aria-label="حالت نمایش">
              <button type="button" className={view === 'single' ? 'is-active' : ''} onClick={() => setView('single')}>
                <Rows3 size={14} /> یک برنامه
              </button>
              <button type="button" className={view === 'all' ? 'is-active' : ''} onClick={() => setView('all')} data-testid="view-all">
                <LayoutGrid size={14} /> هر سه برنامه
              </button>
            </div>
          </div>

          <div className={`tt-boards ${view === 'all' ? 'tt-boards--all' : ''}`}>
            {view === 'single'
              ? renderEngine(ENGINES.find((e) => e.id === active))
              : ENGINES.map((meta) => renderEngine(meta))}
          </div>
        </>
      )}
    </div>
  )
}
