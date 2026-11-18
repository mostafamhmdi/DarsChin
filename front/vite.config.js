import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'

export const MOCK_ENDPOINT = '/__mock/schedule'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function cors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Client')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function mockScheduleHandler(req, res, next) {
  if (req.method === 'OPTIONS') {
    cors(res, req.headers.origin)
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return next()

  cors(res, req.headers.origin)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  readBody(req)
    .then((raw) => {
      let data
      try {
        data = JSON.parse(raw || '{}')
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, message: 'بدنه درخواست JSON معتبر نیست.' }))
        return
      }

      const summary = {
        teachers: Array.isArray(data.teachers) ? data.teachers.length : 0,
        courses: Array.isArray(data.courses) ? data.courses.length : 0,
        slots: Array.isArray(data.slots) ? data.slots.length : 0,
        conflicts: Array.isArray(data.conflicts) ? data.conflicts.length : 0,
        config: data.config ?? null,
      }

      // کمی تاخیر تا حالت بارگذاری در رابط کاربری دیده شود
      setTimeout(() => {
        res.statusCode = 200
        res.end(
          JSON.stringify({
            ok: true,
            message: 'درخواست با موفقیت توسط بکاند نمایشی دریافت شد.',
            source: 'vite-mock',
            requestId: `mock_${randomUUID().slice(0, 8)}`,
            receivedAt: new Date().toISOString(),
            summary,
            echo: data,
          }),
        )
      }, 650)
    })
    .catch(() => {
      res.statusCode = 413
      res.end(JSON.stringify({ ok: false, message: 'حجم درخواست بیش از حد مجاز است.' }))
    })
}

function scheduleMockPlugin() {
  return {
    name: 'scheduler-local-mock-api',
    configureServer(server) {
      server.middlewares.use(MOCK_ENDPOINT, mockScheduleHandler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(MOCK_ENDPOINT, mockScheduleHandler)
    },
  }
}

// مرورگر به /api/... می‌زند؛ Vite آن را به core می‌رساند: /api/v1/schedule/solve -> {CORE_URL}/v1/schedule/solve
// (core هدر CORS ندارد؛ با پروکسی بدون هیچ تغییری در core کار می‌کند.)
// آدرس core را با CORE_URL در فایل .env عوض کنید (پیش‌فرض http://127.0.0.1:8000).
function coreProxy(coreUrl) {
  return {
    '/api': {
      target: coreUrl,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = coreProxy((env.CORE_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''))

  return {
    plugins: [react(), scheduleMockPlugin()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      cors: true,
      allowedHosts: true,
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      cors: true,
      allowedHosts: true,
      proxy,
    },
  }
})
