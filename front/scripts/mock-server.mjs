import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT || 8000)
const HOST = '0.0.0.0'

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Client')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  setCors(res, req.headers.origin)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        ok: true,
        message: 'بکاند نمایشی زمانبندی آماده است.',
        endpoint: `POST http://localhost:${PORT}/schedule`,
      }),
    )
    return
  }

  if (req.method === 'POST' && req.url?.split('?')[0] === '/schedule') {
    const raw = await readBody(req)
    try {
      const data = JSON.parse(raw || '{}')
      const summary = {
        teachers: Array.isArray(data.teachers) ? data.teachers.length : 0,
        courses: Array.isArray(data.courses) ? data.courses.length : 0,
        slots: Array.isArray(data.slots) ? data.slots.length : 0,
        conflicts: Array.isArray(data.conflicts) ? data.conflicts.length : 0,
        config: data.config ?? null,
      }

      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            ok: true,
            message: 'درخواست زمانبندی با موفقیت دریافت شد.',
            source: 'standalone-mock',
            requestId: `req_${randomUUID().slice(0, 8)}`,
            receivedAt: new Date().toISOString(),
            summary,
            echo: data,
          }),
        )
      }, 500)
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, message: 'بدنه درخواست JSON معتبر نیست.' }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: false, message: 'مسیر پیدا نشد.' }))
})

server.listen(PORT, HOST, () => {
  console.log(`✅ Mock API: http://${HOST}:${PORT}/schedule`)
})
