// اجرای هم‌زمان سه الگوریتم روی دادهٔ فعلی + نگهداری برنامه‌های قابل‌ویرایش.
//
// چرا hook و در App؟ تا با جابه‌جایی بین تب‌ها نتایج و ویرایش‌ها از بین نروند.
// App فقط این hook را صدا می‌زند و خروجی‌اش را به Overview می‌دهد (هیچ منطق دیگری در App عوض نشده).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeError, solveWithEngine } from '../lib/api.js'
import { buildContext, moveSession, sessionsFromAssignments } from '../lib/timetable.js'

export const ENGINES = [
  { id: 'cpsat', label: 'CP-SAT', title: 'برنامه‌ریزی محدودیتی', hint: 'اثبات بهینگی · معمولاً سریع‌ترین' },
  { id: 'milp', label: 'MILP', title: 'برنامه‌ریزی خطی عدد صحیح', hint: 'اثبات بهینگی · فرمول‌بندی خطی' },
  { id: 'csp', label: 'CSP', title: 'ارضای محدودیت + جستجوی همسایگی', hint: 'جستجوی مستقل · بدون اثبات بهینگی' },
]

const idle = (engine) => ({ engine, status: 'idle' })
const initialRuns = () => Object.fromEntries(ENGINES.map((e) => [e.id, idle(e.id)]))

export function useScheduleRuns({ payload, validation, endpoint, pushToast }) {
  const [runs, setRuns] = useState(initialRuns)
  const [snapshot, setSnapshot] = useState(null) // { payload, ctx, at } دادهٔ همان اجرا
  const seq = useRef(0)
  const controllers = useRef([])

  useEffect(() => () => controllers.current.forEach((c) => c.abort()), [])

  const running = ENGINES.some((e) => runs[e.id].status === 'loading')
  const hasResults = ENGINES.some((e) => runs[e.id].status === 'done' || runs[e.id].status === 'error')

  // اگر کاربر بعد از اجرا اساتید/دروس/تداخل‌ها را عوض کرد، نتایج «کهنه» حساب می‌شود
  const stale = useMemo(
    () => Boolean(snapshot) && JSON.stringify(snapshot.payload) !== JSON.stringify(payload),
    [snapshot, payload],
  )

  const runAll = useCallback(async () => {
    if (!validation.isValid) {
      pushToast('اجرا متوقف شد', 'ابتدا خطاهای اعتبارسنجی را اصلاح کنید.', 'error')
      return
    }
    const mine = ++seq.current
    controllers.current.forEach((c) => c.abort())
    controllers.current = []

    const snap = JSON.parse(JSON.stringify(payload))
    setSnapshot({ payload: snap, ctx: buildContext(snap), at: Date.now() })
    const startedAt = Date.now()
    setRuns(Object.fromEntries(ENGINES.map((e) => [e.id, { engine: e.id, status: 'loading', startedAt }])))

    // سه درخواست هم‌زمان؛ هر کارت به‌محض رسیدن پاسخ خودش نمایش داده می‌شود
    const outcomes = await Promise.all(
      ENGINES.map(async ({ id }) => {
        const controller = new AbortController()
        controllers.current.push(controller)
        try {
          const response = await solveWithEngine({ payload: snap, engine: id, endpoint, signal: controller.signal })
          if (seq.current !== mine) return 'stale'
          const sessions = sessionsFromAssignments(response.assignments)
          setRuns((prev) => ({
            ...prev,
            [id]: { engine: id, status: 'done', response, sessions, original: sessions, history: [], startedAt, finishedAt: Date.now() },
          }))
          return response.status
        } catch (error) {
          if (seq.current !== mine) return 'stale'
          setRuns((prev) => ({
            ...prev,
            [id]: { engine: id, status: 'error', message: describeError(error), startedAt, finishedAt: Date.now() },
          }))
          return 'ERROR'
        }
      }),
    )

    if (seq.current !== mine) return
    const solved = outcomes.filter((s) => s === 'OPTIMAL' || s === 'FEASIBLE').length
    if (solved === ENGINES.length) pushToast('برنامه‌ها آماده شد', 'خروجی هر سه الگوریتم دریافت شد.', 'success')
    else if (solved > 0) pushToast('اجرا تمام شد', `${solved} از ${ENGINES.length} الگوریتم برنامه تولید کردند.`, 'info')
    else pushToast('برنامه‌ای ساخته نشد', 'جزئیات هر الگوریتم در کارتش آمده است.', 'error')
  }, [validation.isValid, payload, endpoint, pushToast])

  const cancel = useCallback(() => {
    seq.current += 1
    controllers.current.forEach((c) => c.abort())
    controllers.current = []
    setRuns((prev) =>
      Object.fromEntries(ENGINES.map((e) => [e.id, prev[e.id].status === 'loading' ? idle(e.id) : prev[e.id]])),
    )
    pushToast('اجرا لغو شد', 'نتایجی که قبلاً رسیده بودند حفظ شدند.', 'info')
  }, [pushToast])

  // ---- ویرایش برنامه (هر الگوریتم برنامهٔ مستقل خودش را دارد) ----
  const move = useCallback((engine, key, placement) => {
    setRuns((prev) => {
      const run = prev[engine]
      if (!run?.sessions) return prev
      return { ...prev, [engine]: { ...run, sessions: moveSession(run.sessions, key, placement), history: [...run.history, run.sessions] } }
    })
  }, [])

  const undo = useCallback((engine) => {
    setRuns((prev) => {
      const run = prev[engine]
      if (!run?.history?.length) return prev
      return { ...prev, [engine]: { ...run, sessions: run.history[run.history.length - 1], history: run.history.slice(0, -1) } }
    })
  }, [])

  const reset = useCallback((engine) => {
    setRuns((prev) => {
      const run = prev[engine]
      if (!run?.original) return prev
      return { ...prev, [engine]: { ...run, sessions: run.original, history: [] } }
    })
  }, [])

  return { runs, snapshot, running, hasResults, stale, runAll, cancel, move, undo, reset, toast: pushToast }
}
