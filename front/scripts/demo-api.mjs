// Explicitly simulated API. Used by both Vite and the standalone demo server.
// The engine names/results below are fixtures, NOT a claim that those engines are installed.
export const DEMO_ENGINES = {
  cpsat: { available: true, capabilities: { demo: true, constraints: true, optimization: true } },
  greedy: { available: true, capabilities: { demo: true, constraints: true, optimization: false } },
  local_search: { available: true, capabilities: { demo: true, constraints: true, optimization: true } },
  milp: { available: false, error: 'نمونه نمایشی: وابستگی این موتور نصب نشده است.' },
}
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false })
const str = { type: 'string' }
const integer = { type: 'integer' }
export const DEMO_SCHEMA = object({
  teachers: { type: 'array', items: object({ id: str, name: str, available_days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, priority: integer }) },
  courses: { type: 'array', items: object({ id: str, name: str, teacher_id: str, sessions_per_week: integer, session_hours: integer, term: str, level: str, major: str }) },
  slots: { type: 'array', items: object({ id: str, day: integer, start: str, end: str, penalty: { type: 'number' } }) },
  conflicts: { type: 'array', items: object({ course_a: str, course_b: str }) },
  config: object({ time_limit_sec: { type: 'number' }, num_workers: integer }),
}, ['teachers', 'courses', 'slots'])
export const DEMO_OPENAPI = {
  openapi: '3.1.0', info: { title: 'Simulated Scheduling API — demo only', version: '2.0.0' },
  paths: {
    '/health': { get: { responses: { 200: { description: 'Demo health' } } } },
    '/v1/engines': { get: { responses: { 200: { description: 'Demo backend map' } } } },
    '/v1/schema': { get: { responses: { 200: { description: 'Input JSON Schema' } } } },
    '/v1/schedule/solve': { post: {
      parameters: [{ name: 'engine', in: 'query', required: true, schema: { type: 'string', enum: Object.keys(DEMO_ENGINES) } }],
      requestBody: { required: true, content: { 'application/json': { schema: DEMO_SCHEMA } } },
      responses: { 200: { description: 'Simulated SolveResponse' }, 422: { description: 'Validation Error' } },
    } },
  },
}
const minutes = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
const dayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
const overlap = (a, b) => a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end)

// A small fixture generator makes the DEMO react to edited input. This is not a backend solver.
export function demoSolve(payload, engine) {
  const { teachers = [], courses = [], slots = [], conflicts = [] } = payload
  const variant = Object.keys(DEMO_ENGINES).indexOf(engine)
  const assignments = []
  const tasks = courses.flatMap((course) => Array.from({ length: Math.max(0, Math.min(7, Number(course.sessions_per_week) || 0)) }, (_, session_index) => ({ course, session_index })))
    .sort((a, b) => b.course.session_hours - a.course.session_hours || a.session_index - b.session_index)
  for (const { course, session_index } of tasks) {
    const teacher = teachers.find((item) => item.id === course.teacher_id)
    const candidates = []
    for (const slot of slots) {
      if (!teacher?.available_days.includes(slot.day)) continue
      const length = Number(course.session_hours)
      const chain = [slot]
      for (let i = 1; i < length; i++) {
        const next = slots.find((item) => item.day === slot.day && item.start === chain.at(-1)?.end)
        if (!next) break
        chain.push(next)
      }
      if (chain.length !== length) continue
      const candidate = { course_id: course.id, session_index, teacher_id: course.teacher_id, day: slot.day, day_name: dayNames[slot.day], start: slot.start, end: chain.at(-1).end, slot_ids: chain.map((item) => item.id) }
      const blocked = assignments.some((other) => {
        if (other.course_id === course.id && other.day === candidate.day) return true
        if (!overlap(candidate, other)) return false
        const otherCourse = courses.find((item) => item.id === other.course_id)
        const sameCohort = otherCourse && otherCourse.term === course.term && otherCourse.level === course.level && otherCourse.major === course.major
        const conflict = conflicts.some((pair) => (pair.course_a === course.id && pair.course_b === other.course_id) || (pair.course_b === course.id && pair.course_a === other.course_id))
        return other.teacher_id === course.teacher_id || sameCohort || conflict
      })
      if (!blocked) candidates.push({ candidate, score: chain.reduce((sum, item) => sum + (item.penalty || 0), 0) + (variant === 1 ? slot.day * 2 : variant === 2 ? (4 - slot.day) : slot.day * 0.3) })
    }
    candidates.sort((a, b) => a.score - b.score || a.candidate.day - b.candidate.day || a.candidate.start.localeCompare(b.candidate.start))
    if (candidates.length) assignments.push(candidates[0].candidate)
  }
  const complete = assignments.length === tasks.length
  assignments.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
  const teacherMetrics = Object.fromEntries(teachers.map((teacher) => {
    const sessions = assignments.filter((item) => item.teacher_id === teacher.id)
    const days = [...new Set(sessions.map((item) => item.day))].sort()
    const totalHours = sessions.reduce((sum, item) => sum + (minutes(item.end) - minutes(item.start)) / 60, 0)
    const gaps = days.reduce((total, day) => {
      const daily = sessions.filter((item) => item.day === day)
      return total + (Math.max(...daily.map((item) => minutes(item.end))) - Math.min(...daily.map((item) => minutes(item.start)))) / 60 - daily.reduce((n, item) => n + (minutes(item.end) - minutes(item.start)) / 60, 0)
    }, 0)
    return [teacher.id, { days_used: days, total_hours: totalHours, gap_hours: gaps }]
  }))
  const teacherDays = teachers.reduce((sum, teacher) => sum + teacherMetrics[teacher.id].days_used.length * teacher.priority, 0)
  const penalties = assignments.reduce((sum, item) => sum + item.slot_ids.reduce((n, id) => n + (slots.find((slot) => slot.id === id)?.penalty || 0), 0), 0)
  return {
    status: complete ? 'FEASIBLE' : 'UNKNOWN', engine,
    objective: complete ? teacherDays + penalties : null, best_bound: null, solve_time_sec: [0.31, 0.12, 0.58][variant] ?? 0.2,
    assignments: complete ? assignments : [], objective_breakdown: complete ? { teacher_days: teacherDays, slot_penalty: penalties } : {},
    metrics: complete ? { teachers: teacherMetrics, days_used_overall: [...new Set(assignments.map((item) => item.day))].sort(), total_gap_hours: Object.values(teacherMetrics).reduce((sum, item) => sum + item.gap_hours, 0), total_teacher_days: Object.values(teacherMetrics).reduce((sum, item) => sum + item.days_used.length, 0) } : {},
    issues: complete ? [] : ['مولد ساده نمایشی نتوانست تمام جلسات را بچیند؛ این به معنی ناممکن بودن مسئله نیست.'],
    infeasibility_core: [], demo: true, source: 'simulated-api',
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => { size += chunk.length; if (size > 2 * 1024 * 1024) reject(new Error('too-large')); else chunks.push(chunk) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function createDemoMiddleware({ prefix = '/__mock' } = {}) {
  return async (req, res, next = () => send(res, 404, { detail: 'Not found' })) => {
    const url = new URL(req.url, 'http://demo.local')
    if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return next()
    const path = url.pathname.slice(prefix.length) || '/'
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    if (req.method === 'GET') {
      const routes = { '/health': { status: 'ok', demo: true }, '/v1/engines': DEMO_ENGINES, '/v1/schema': DEMO_SCHEMA, '/openapi.json': DEMO_OPENAPI }
      if (Object.hasOwn(routes, path)) return send(res, 200, routes[path])
    }
    if (req.method === 'POST' && path === '/v1/schedule/solve') {
      let payload
      try { payload = JSON.parse(await readBody(req)) } catch (error) { return send(res, error.message === 'too-large' ? 413 : 400, { detail: 'Invalid or oversized JSON' }) }
      const detail = []
      const extra = (value, allowed, loc) => Object.keys(value || {}).filter((key) => !allowed.includes(key)).forEach((key) => detail.push({ loc: [...loc, key], msg: 'Extra inputs are not permitted', type: 'extra_forbidden' }))
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return send(res, 422, { detail: 'Expected an object' })
      extra(payload, Object.keys(DEMO_SCHEMA.properties), ['body'])
      for (const key of ['teachers', 'courses', 'slots']) if (!Array.isArray(payload[key])) detail.push({ loc: ['body', key], msg: 'Field required; expected array' })
      for (const key of ['teachers', 'courses', 'slots', 'conflicts']) {
        if (Array.isArray(payload[key])) payload[key].forEach((item, index) => extra(item, Object.keys(DEMO_SCHEMA.properties[key].items.properties), ['body', key, index]))
      }
      extra(payload.config, ['time_limit_sec', 'num_workers'], ['body', 'config'])
      const engine = url.searchParams.get('engine')
      if (!DEMO_ENGINES[engine]?.available) detail.push({ loc: ['query', 'engine'], msg: 'Choose an available demo engine' })
      if (detail.length) return send(res, 422, { detail })
      try {
        const body = demoSolve(payload, engine)
        const delay = 850 + Object.keys(DEMO_ENGINES).indexOf(engine) * 550
        setTimeout(() => { if (!res.destroyed) send(res, 200, body) }, delay)
      } catch (error) { return send(res, 422, { detail: `Invalid demo input: ${error.message}` }) }
      return
    }
    return send(res, 404, { detail: 'Demo route not found; no future input endpoint has been assumed.' })
  }
}
