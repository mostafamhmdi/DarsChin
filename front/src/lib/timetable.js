// منطق خالصِ برنامهٔ هفتگی (بدون React): شبکهٔ زمانی، جایگذاری‌های مجاز، اعتبارسنجی، آمار و جابه‌جایی.
//
// ⚠️ بخش «اعتبارسنجی» آینهٔ `evaluation.verify` در core است تا هر ویرایش دستی فوراً بررسی شود.
//    مرجع نهایی قوانین، خود core است؛ اگر قانونی در core تغییر کرد این‌جا هم هماهنگ شود.
import { DAY_LABELS, TERM_LABELS } from '../data/staticData.js'
import { fa } from './format.js'

// ---------------------------------------------------------------- ابزارهای پایه
export const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const faTime = (value) => String(value).replace(/\d/g, (digit) => fa(Number(digit)))
export const dayLabel = (day) => DAY_LABELS[day] ?? `روز ${fa(day)}`
export const termLabel = (term) => TERM_LABELS[term] || term
export const sessionKey = (courseId, index) => `${courseId}#${index}`
export const pairKey = (a, b) => [a, b].sort().join('::')
export const courseMinutes = (course) => Math.round(Number(course?.session_hours || 0) * 60)

// ---------------------------------------------------------------- شبکهٔ زمانی
/**
 * از لیست اسلات‌ها (همان slots ارسالی به core) یک مدل شبکه می‌سازد.
 * rows  : ساعت‌های شروعِ یکتا (هر ردیف = یک اسلات)؛ breakBefore یعنی بین این ردیف و قبلی فاصله هست (مثلاً ناهار)
 * slotsByDay : اسلات‌های هر روز به ترتیب (order = جایگاه در همان روز، مثل core)
 */
export function buildGrid(slots) {
  const sorted = [...slots].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start))
  const slotsByDay = new Map()
  const slotById = new Map()
  const slotAt = new Map()
  for (const raw of sorted) {
    if (!slotsByDay.has(raw.day)) slotsByDay.set(raw.day, [])
    const list = slotsByDay.get(raw.day)
    const slot = { ...raw, startMin: toMin(raw.start), endMin: toMin(raw.end), order: list.length }
    list.push(slot)
    slotById.set(slot.id, slot)
    slotAt.set(`${slot.day}|${slot.start}`, slot)
  }

  const rowMap = new Map()
  for (const slot of slotById.values()) {
    if (!rowMap.has(slot.start)) {
      rowMap.set(slot.start, { start: slot.start, end: slot.end, startMin: slot.startMin, endMin: slot.endMin })
    }
  }
  const rows = [...rowMap.values()].sort((a, b) => a.startMin - b.startMin)
  rows.forEach((row, index) => {
    row.index = index
    row.breakBefore = index > 0 && rows[index - 1].endMin !== row.startMin
    row.breakMinutes = row.breakBefore ? row.startMin - rows[index - 1].endMin : 0
  })

  return { days: [...slotsByDay.keys()].sort((a, b) => a - b), rows, slotsByDay, slotById, slotAt }
}

/**
 * همهٔ جایگذاری‌های مجازِ یک جلسه به طول `minutes`: چند اسلاتِ پشت‌سرهمِ «زمان‌چسبیده» در یک روز.
 * (همان قاعدهٔ preprocess._generate_placements در core؛ فاصلهٔ ناهار دو اسلات را به هم نمی‌چسباند.)
 */
export function placementsFor(grid, minutes) {
  const out = []
  for (const day of grid.days) {
    const list = grid.slotsByDay.get(day)
    for (let i = 0; i < list.length; i += 1) {
      const run = []
      let total = 0
      for (let j = i; j < list.length; j += 1) {
        const slot = list[j]
        if (run.length && run[run.length - 1].endMin !== slot.startMin) break
        run.push(slot)
        total += slot.endMin - slot.startMin
        if (total === minutes) {
          out.push({
            day,
            start: run[0].start,
            end: slot.end,
            startMin: run[0].startMin,
            endMin: slot.endMin,
            slot_ids: run.map((item) => item.id),
          })
          break
        }
        if (total > minutes) break
      }
    }
  }
  return out
}

// ---------------------------------------------------------------- زمینهٔ اجرا (snapshot دادهٔ همان اجرا)
export function buildContext(payload) {
  return {
    grid: buildGrid(payload.slots),
    teachers: new Map(payload.teachers.map((teacher) => [teacher.id, teacher])),
    courses: new Map(payload.courses.map((course) => [course.id, course])),
    conflictSet: new Set(payload.conflicts.map((conflict) => pairKey(conflict.course_a, conflict.course_b))),
    terms: [...new Set(payload.courses.map((course) => course.term).filter(Boolean))].sort(),
    _placements: new Map(),
  }
}

export function placementsForCourse(ctx, course) {
  const minutes = courseMinutes(course)
  if (!ctx._placements.has(minutes)) ctx._placements.set(minutes, placementsFor(ctx.grid, minutes))
  return ctx._placements.get(minutes)
}

export function optionMapFor(session, ctx) {
  const course = ctx.courses.get(session.course_id)
  return new Map(placementsForCourse(ctx, course).map((p) => [`${p.day}|${p.start}`, p]))
}

// ---------------------------------------------------------------- نشست‌ها
export function sessionsFromAssignments(assignments) {
  return assignments
    .map((a) => ({
      key: sessionKey(a.course_id, a.session_index),
      course_id: a.course_id,
      session_index: a.session_index,
      teacher_id: a.teacher_id,
      day: a.day,
      start: a.start,
      end: a.end,
      slot_ids: [...a.slot_ids],
    }))
    .sort((x, y) => x.day - y.day || toMin(x.start) - toMin(y.start))
}

export function moveSession(sessions, key, placement) {
  return sessions.map((s) =>
    s.key === key
      ? { ...s, day: placement.day, start: placement.start, end: placement.end, slot_ids: [...placement.slot_ids] }
      : s,
  )
}

export const isSamePlace = (session, placement) => session.day === placement.day && session.start === placement.start

export function isEdited(sessions, original) {
  if (!original) return false
  const base = new Map(original.map((s) => [s.key, `${s.day}|${s.start}`]))
  return sessions.some((s) => base.get(s.key) !== `${s.day}|${s.start}`)
}

// ---------------------------------------------------------------- اعتبارسنجی (آینهٔ core.verify)
const sharesSlot = (a, b) => a.day === b.day && a.slot_ids.some((id) => b.slot_ids.includes(id))

export function validateTimetable(sessions, ctx) {
  const violations = []
  const byKey = new Map()
  const add = (code, message, keys) => {
    violations.push({ code, message, keys })
    keys.forEach((key) => {
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(message)
    })
  }
  const name = (s) => `«${ctx.courses.get(s.course_id)?.name ?? s.course_id}»`
  const tname = (s) => ctx.teachers.get(s.teacher_id)?.name ?? s.teacher_id

  for (const s of sessions) {
    const teacher = ctx.teachers.get(s.teacher_id)
    if (teacher && !(teacher.available_days || []).includes(s.day)) {
      add('TEACHER_DAY', `${tname(s)} در ${dayLabel(s.day)} حضور ندارد (${name(s)})`, [s.key])
    }
  }

  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const a = sessions[i]
      const b = sessions[j]
      const sameCourse = a.course_id === b.course_id
      if (sameCourse && a.day === b.day) {
        add('SAME_DAY', `دو جلسهٔ ${name(a)} در یک روز (${dayLabel(a.day)}) افتاده‌اند`, [a.key, b.key])
      }
      if (!sharesSlot(a, b)) continue
      if (a.teacher_id === b.teacher_id) {
        add('TEACHER_OVERLAP', `${tname(a)} هم‌زمان در ${name(a)} و ${name(b)} حضور دارد`, [a.key, b.key])
      }
      if (sameCourse) continue
      if (ctx.conflictSet.has(pairKey(a.course_id, b.course_id))) {
        add('CONFLICT', `${name(a)} و ${name(b)} طبق لیست تداخل‌ها نباید هم‌زمان باشند`, [a.key, b.key])
      }
      const termA = ctx.courses.get(a.course_id)?.term
      if (termA && termA === ctx.courses.get(b.course_id)?.term) {
        add('TERM_OVERLAP', `${name(a)} و ${name(b)} هم‌ترم‌اند (${termLabel(termA)}) و نباید هم‌زمان باشند`, [a.key, b.key])
      }
    }
  }
  return { violations, byKey }
}

// ---------------------------------------------------------------- آمار (همان تعریف metrics در core)
export function computeStats(sessions, ctx) {
  const { grid } = ctx
  const teacherDayOcc = new Map() // "teacher|day" -> Set(order اسلات در همان روز)
  const slotUse = new Map()
  const termDays = new Map()

  for (const s of sessions) {
    const key = `${s.teacher_id}|${s.day}`
    if (!teacherDayOcc.has(key)) teacherDayOcc.set(key, new Set())
    for (const id of s.slot_ids) {
      const slot = grid.slotById.get(id)
      if (!slot) continue
      teacherDayOcc.get(key).add(slot.order)
      slotUse.set(id, (slotUse.get(id) || 0) + 1)
    }
    const term = ctx.courses.get(s.course_id)?.term
    if (term) {
      if (!termDays.has(term)) termDays.set(term, new Set())
      termDays.get(term).add(s.day)
    }
  }

  let gapMin = 0
  for (const [key, set] of teacherDayOcc) {
    const day = Number(key.slice(key.lastIndexOf('|') + 1))
    const list = grid.slotsByDay.get(day) || []
    const orders = [...set]
    const lo = Math.min(...orders)
    const hi = Math.max(...orders)
    for (let o = lo; o <= hi; o += 1) {
      if (!set.has(o) && list[o]) gapMin += list[o].endMin - list[o].startMin
    }
  }

  let classMin = 0
  let busyMin = 0
  for (const [id, count] of slotUse) {
    const slot = grid.slotById.get(id)
    const minutes = slot.endMin - slot.startMin
    classMin += minutes * count
    busyMin += minutes
  }

  const terms = {}
  for (const term of ctx.terms) {
    const days = [...(termDays.get(term) || [])].sort((a, b) => a - b)
    terms[term] = { days, count: days.length }
  }

  return {
    daysUsed: [...new Set(sessions.map((s) => s.day))].sort((a, b) => a - b),
    teacherDays: teacherDayOcc.size,
    gapHours: gapMin / 60,
    classHours: classMin / 60,
    busyHours: busyMin / 60,
    parallelHours: (classMin - busyMin) / 60,
    terms,
  }
}

// ---------------------------------------------------------------- چیدمان گرافیکی
/**
 * برای نمایش روی CSS Grid: هر روز به تعدادِ «بیشینهٔ کلاس‌های هم‌زمانِ آن روز» ستون (lane) می‌گیرد
 * تا کلاس‌های هم‌زمان کنار هم بنشینند. ستون ۱ = برچسب ساعت، ردیف ۱ = سرستون روزها.
 */
export function layoutBoard(sessions, grid) {
  const lanesByDay = new Map()
  const laneOf = new Map()
  for (const day of grid.days) {
    const list = sessions
      .filter((s) => s.day === day)
      .map((s) => ({ s, a: toMin(s.start), b: toMin(s.end) }))
      .sort((x, y) => x.a - y.a || y.b - x.b)
    const laneEnds = []
    for (const item of list) {
      let lane = laneEnds.findIndex((end) => end <= item.a)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(item.b)
      } else {
        laneEnds[lane] = item.b
      }
      laneOf.set(item.s.key, lane)
    }
    lanesByDay.set(day, Math.max(1, laneEnds.length))
  }

  const colStart = new Map()
  let col = 2
  for (const day of grid.days) {
    colStart.set(day, col)
    col += lanesByDay.get(day)
  }

  const rowLine = new Map()
  const breakLine = new Map()
  const rowTemplate = ['auto']
  let line = 2
  for (const row of grid.rows) {
    if (row.breakBefore) {
      breakLine.set(row.start, line)
      rowTemplate.push('16px')
      line += 1
    }
    rowLine.set(row.start, line)
    rowTemplate.push('minmax(58px, auto)')
    line += 1
  }

  const spanOf = (s) => {
    const a = toMin(s.start)
    const b = toMin(s.end)
    return Math.max(1, grid.rows.filter((r) => r.startMin >= a && r.startMin < b).length)
  }

  return { lanesByDay, laneOf, colStart, rowLine, breakLine, rowTemplate, spanOf, totalCols: col - 1 }
}

export const termColorIndex = (ctx, term) => (term ? ctx.terms.indexOf(term) % 6 : -1)
