// ───────────────────────────────────────────────────────────────────────────
// اتصال به core
//
//  مرورگر ──POST──►  /api/v1/schedule/solve   (همین origin فرانت)
//                         │  پروکسیِ Vite (vite.config.js) مسیر /api را برمی‌دارد
//                         ▼
//                   core: POST http://127.0.0.1:8000/v1/schedule/solve
//
// چرا پروکسی؟ core هدرهای CORS ندارد؛ با پروکسی مرورگر فقط با origin خودش حرف می‌زند و
// نیازی به تغییر در core نیست. برای آدرس مطلق (مثلاً سرور واقعی) متغیر VITE_API_URL را بدهید.
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_ENDPOINT =
  import.meta.env.VITE_API_URL?.trim() || '/api/v1/schedule/solve'

export const MOCK_ENDPOINT = '/__mock/schedule'
export const REQUEST_TIMEOUT_MS = 30_000

// وضعیت‌هایی که core در SolveResponse.status برمی‌گرداند
const SOLVE_STATUSES = new Set(['OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'INVALID_INPUT', 'UNKNOWN'])

export function isPreviewHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host.endsWith('.e2b.app') || host.endsWith('.arena.ai')
}

export function initialMode() {
  return isPreviewHost() ? 'mock' : 'live'
}

export function initialEndpoint() {
  return isPreviewHost() ? MOCK_ENDPOINT : DEFAULT_ENDPOINT
}

export function endpointForMode(mode, customEndpoint) {
  if (mode === 'mock') return MOCK_ENDPOINT
  return (customEndpoint || '').trim() || DEFAULT_ENDPOINT
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function parseResponse(res) {
  const text = await res.text()
  if (!text) return { ok: res.ok }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** core خروجی حل را با status + assignments برمی‌گرداند (SolveResponse). */
export function isSolveResponse(body) {
  return Boolean(body) && typeof body === 'object' && SOLVE_STATUSES.has(body.status) && Array.isArray(body.assignments)
}

// FastAPI برای خطای اعتبارسنجی (۴۲۲) آرایه‌ای از {loc, msg} می‌دهد؛ آن را خوانا می‌کنیم.
function formatDetail(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => `${(item.loc || []).filter((part) => part !== 'body').join('.')}: ${item.msg}`)
      .join(' | ')
      .slice(0, 240)
  }
  return typeof detail === 'string' ? detail : ''
}

// پنل «محموله و ارسال» پاسخ را با summary/source نشان می‌دهد؛ پاسخ core را با همین شکل هم‌خوان می‌کنیم
// (فیلدهای اصلی core دست‌نخورده می‌مانند).
function normalizeCoreBody(body, payload) {
  if (!isSolveResponse(body)) return body
  return {
    ok: body.status === 'OPTIMAL' || body.status === 'FEASIBLE',
    source: 'core',
    message: `وضعیت حل: ${body.status} · ${body.assignments.length} جلسه برنامه‌ریزی شد.`,
    summary: {
      teachers: payload?.teachers?.length ?? 0,
      courses: payload?.courses?.length ?? 0,
      slots: payload?.slots?.length ?? 0,
      conflicts: payload?.conflicts?.length ?? 0,
      config: payload?.config ?? null,
    },
    ...body,
  }
}

// حلگر تا time_limit_sec کار می‌کند؛ مهلت مرورگر باید از آن بیشتر باشد وگرنه پاسخ قطع می‌شود.
export function timeoutFor(payload) {
  const limit = Number(payload?.config?.time_limit_sec) || 30
  return Math.max(REQUEST_TIMEOUT_MS, (limit + 25) * 1000)
}

export async function sendSchedule(payload, endpoint, { signal, timeoutMs } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeoutFor(payload))
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client': 'scheduler-panel',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const raw = await parseResponse(res)

    if (!res.ok) {
      const detail =
        typeof raw === 'string'
          ? raw.slice(0, 180)
          : raw?.message || formatDetail(raw?.detail) || `کد وضعیت ${res.status}`
      const error = new Error(`پاسخ بکاند ناموفق بود: ${detail}`)
      error.status = res.status
      throw error
    }

    return { ok: true, status: res.status, endpoint, body: normalizeCoreBody(raw, payload) }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

/**
 * یک الگوریتم را روی همان محموله اجرا می‌کند: فقط config.engine عوض می‌شود
 * (cpsat | milp | csp). خروجی = SolveResponse خامِ core.
 */
export async function solveWithEngine({ payload, engine, endpoint, signal }) {
  const request = { ...payload, config: { ...payload.config, engine } }
  const { body } = await sendSchedule(request, endpoint, { signal })
  if (!isSolveResponse(body)) {
    throw new Error(
      'پاسخ دریافتی خروجی برنامه‌ریزی ندارد. آدرس باید به endpoint حلِ core (…/v1/schedule/solve) اشاره کند؛ ' +
        'حالت «نمایشی» فقط ورودی را بازتاب می‌دهد.',
    )
  }
  return body
}

export async function submitSchedule({ payload, endpoint, mode }) {
  try {
    return await sendSchedule(payload, endpoint)
  } catch (error) {
    // اگر نسخهٔ استاتیک بدون middleware ویت در حال اجرا بود، دمو همچنان کار کند
    if (mode === 'mock') {
      await wait(600)
      return {
        ok: true,
        status: 200,
        endpoint,
        fallback: true,
        body: {
          ok: true,
          message: 'شبیه‌سازی محلی: درخواست ساخته و آمادهٔ ارسال است.',
          source: 'client-fallback',
          requestId: `demo_${Math.random().toString(36).slice(2, 10)}`,
          receivedAt: new Date().toISOString(),
          summary: {
            teachers: payload.teachers.length,
            courses: payload.courses.length,
            slots: payload.slots.length,
            conflicts: payload.conflicts.length,
            config: payload.config,
          },
        },
      }
    }
    throw error
  }
}

export function describeError(error) {
  if (error?.name === 'AbortError') {
    return 'مهلت درخواست به پایان رسید یا درخواست لغو شد. اگر حلگر طولانی است time_limit_sec را بررسی کنید.'
  }
  if (error?.status === 502 || error?.status === 503 || error?.status === 504) {
    return 'پروکسی نتوانست به core برسد. core را روی پورت ۸۰۰۰ اجرا کنید (یا CORE_URL را در .env تنظیم کنید).'
  }
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error?.message || '')) {
    return 'امکان برقراری ارتباط با core وجود ندارد. روشن بودن سرور (uvicorn core.api:app --port 8000) و آدرس API را بررسی کنید.'
  }
  return error?.message || 'خطای ناشناخته در ارسال درخواست.'
}
