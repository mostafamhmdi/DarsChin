export const DEFAULT_ENDPOINT =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/schedule'

export const MOCK_ENDPOINT = '/__mock/schedule'
export const REQUEST_TIMEOUT_MS = 30_000

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

export async function sendSchedule(payload, endpoint) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

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

    const body = await parseResponse(res)

    if (!res.ok) {
      const detail =
        typeof body === 'string'
          ? body.slice(0, 180)
          : body?.message || body?.detail || `کد وضعیت ${res.status}`
      const error = new Error(`پاسخ بکاند ناموفق بود: ${detail}`)
      error.status = res.status
      throw error
    }

    return { ok: true, status: res.status, endpoint, body }
  } finally {
    clearTimeout(timer)
  }
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
          message: 'شبیهسازی محلی: درخواست ساخته و آمادهٔ ارسال است.',
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
    return `مهلت درخواست (${REQUEST_TIMEOUT_MS / 1000} ثانیه) به پایان رسید. بکاند پاسخی ارسال نکرد.`
  }
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error?.message || '')) {
    return 'امکان برقراری ارتباط با بکاند وجود ندارد. آدرس API، روشن بودن سرور و تنظیمات CORS را بررسی کنید.'
  }
  return error?.message || 'خطای ناشناخته در ارسال درخواست.'
}
