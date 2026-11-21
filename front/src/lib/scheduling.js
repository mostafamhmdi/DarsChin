import { ApiError, describeError, discoverBackend, inputEndpoint, requestJson, resolveEngineSelector, solveEngine } from './api.js'

export const MAX_CONCURRENT_SOLVES = 2
const noop = () => {}
const ensureActive = (signal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError') }

// One immutable input for every engine; an optional future registration POST runs first.
// Each solve is isolated: a 422/500/timeout from one engine cannot discard other results.
export async function executePipeline({ payload, settings, signal, onCatalog = noop, onPhase = noop, onRuns = noop, onRun = noop, onUpload = noop }) {
  onPhase('discovery')
  const catalog = await discoverBackend({ baseUrl: settings.baseUrl, signal })
  ensureActive(signal)
  onCatalog(catalog)
  if (!catalog.diagnostics.engines.ok) throw new ApiError(catalog.diagnostics.engines.message)
  const engines = catalog.engines.filter((engine) => engine.available)
  if (!engines.length) throw new ApiError('هیچ الگوریتم در دسترسی از GET /v1/engines دریافت نشد. الگوریتم‌های نصب‌نشده اجرا نمی‌شوند.')
  const selector = resolveEngineSelector({
    openapi: catalog.diagnostics.openapi.body, schema: catalog.diagnostics.schema.body,
    selectorMode: settings.selectorMode, selectorKey: settings.selectorKey,
  })
  if (!selector) throw new ApiError('محل انتخاب الگوریتم در OpenAPI و JSON Schema پیدا نشد. در «JSON و اتصال»، قرارداد engine را تنظیم کنید؛ هیچ درخواست حلِ حدسی ارسال نشد.')

  let upload = null
  if (settings.uploadEnabled) {
    onPhase('upload')
    const endpoint = inputEndpoint(settings.baseUrl, settings.uploadPath)
    onUpload({ state: 'running', endpoint })
    try {
      upload = await requestJson(endpoint, { method: 'POST', body: payload, signal, timeoutMs: 20_000 })
      onUpload({ state: 'success', ...upload })
    } catch (error) {
      onUpload({ state: error.name === 'AbortError' ? 'cancelled' : 'error', endpoint, message: describeError(error), body: error.body })
      throw error // Do not start any solve when registration has failed.
    }
  }
  ensureActive(signal)
  const runs = engines.map((engine) => ({ name: engine.name, state: 'queued' }))
  onRuns(runs.map((run) => ({ ...run })))
  onPhase('solving')
  let nextIndex = 0
  const update = (index, patch) => {
    runs[index] = { ...runs[index], ...patch }
    onRun(index, { ...runs[index] })
  }
  async function worker() {
    while (nextIndex < runs.length) {
      const index = nextIndex++
      if (signal?.aborted) { update(index, { state: 'cancelled' }); continue }
      const startedAt = Date.now()
      update(index, { state: 'running', startedAt })
      try {
        const response = await solveEngine({ payload, baseUrl: settings.baseUrl, engine: runs[index].name, selector, signal })
        update(index, { state: 'success', ...response, elapsedMs: Date.now() - startedAt })
      } catch (error) {
        update(index, {
          state: error.name === 'AbortError' ? 'cancelled' : 'error', message: describeError(error),
          body: error.body, status: error.status, endpoint: error.endpoint, elapsedMs: Date.now() - startedAt,
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_SOLVES, runs.length) }, worker))
  const received = runs.filter((run) => run.state === 'success').length
  const status = signal?.aborted ? 'cancelled' : received === runs.length ? 'success' : received ? 'partial' : 'error'
  return { status, runs, catalog, selector, upload, received }
}

export const SOLVER_STATUSES = {
  OPTIMAL: { label: 'جواب بهینه', tone: 'green', feasible: true },
  FEASIBLE: { label: 'جواب شدنی', tone: 'cyan', feasible: true },
  INFEASIBLE: { label: 'بدون جواب شدنی', tone: 'rose', feasible: false },
  UNKNOWN: { label: 'نتیجه نامشخص', tone: 'amber', feasible: false },
  MODEL_INVALID: { label: 'مدل نامعتبر', tone: 'rose', feasible: false },
  ERROR: { label: 'خطای حلگر', tone: 'rose', feasible: false },
  NOT_SOLVED: { label: 'حل نشده', tone: 'amber', feasible: false },
  UNBOUNDED: { label: 'مسئله نامحدود', tone: 'amber', feasible: false },
}
export function solverStatus(status) {
  return SOLVER_STATUSES[String(status || '').toUpperCase()] || { label: 'وضعیت ناشناخته', tone: 'slate', feasible: false }
}

export function toMinutes(time) {
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function inspectAssignments(body) {
  const warnings = []
  if (!Array.isArray(body?.assignments)) {
    return { assignments: [], warnings: solverStatus(body?.status).feasible ? ['پاسخ شدنی است اما آرایه assignments معتبر دریافت نشد.'] : [] }
  }
  const assignments = body.assignments.filter((item, index) => {
    const valid = item && typeof item.course_id === 'string' && typeof item.teacher_id === 'string' &&
      Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 &&
      Number.isInteger(item.session_index) && item.session_index >= 0 && toMinutes(item.end) > toMinutes(item.start)
    if (!valid) warnings.push(`جلسه شماره ${index + 1} با قرارداد day / HH:MM / id رشته‌ای / session_index مطابقت ندارد؛ در JSON خام قابل مشاهده است.`)
    return valid
  }).sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start) || a.course_id.localeCompare(b.course_id) || a.session_index - b.session_index)
  return { assignments, warnings }
}
