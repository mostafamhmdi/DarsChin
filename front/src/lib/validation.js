import { DAY_COUNT, LEVEL_OPTIONS, TERM_OPTIONS } from '../data/staticData.js'
import { fa } from './format.js'

const pairKey = (a, b) => [a, b].sort().join('::')

export function validatePayload(payload) {
  const errors = []
  const warnings = []

  const teacherIds = new Set()
  payload.teachers.forEach((teacher, index) => {
    const n = fa(index + 1)
    const id = String(teacher.id || '').trim()
    if (!id) errors.push(`استاد شمارهٔ ${n}: شناسه خالی است.`)
    else if (teacherIds.has(id)) errors.push(`شناسهٔ استاد «${id}» تکراری است.`)
    else teacherIds.add(id)

    if (!String(teacher.name || '').trim()) errors.push(`استاد شمارهٔ ${n}: نام وارد نشده است.`)

    const days = Array.isArray(teacher.available_days) ? teacher.available_days : []
    if (days.length === 0) errors.push(`استاد «${teacher.name || id}» هیچ روز مجازی ندارد.`)
    if (days.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) >= DAY_COUNT)) {
      errors.push(`استاد «${teacher.name || id}» دارای روز نامعتبر است (باید ۰ تا ${fa(DAY_COUNT - 1)} باشد).`)
    }
    if (new Set(days).size !== days.length) warnings.push(`روزهای مجاز استاد «${teacher.name || id}» تکراری دارند.`)

    const priority = Number(teacher.priority)
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      errors.push(`اولویت استاد «${teacher.name || id}» باید عددی بین ۱ تا ۵ باشد.`)
    }
  })

  const courseIds = new Set()
  payload.courses.forEach((course, index) => {
    const n = fa(index + 1)
    const id = String(course.id || '').trim()
    if (!id) errors.push(`درس شمارهٔ ${n}: شناسه خالی است.`)
    else if (courseIds.has(id)) errors.push(`شناسهٔ درس «${id}» تکراری است.`)
    else courseIds.add(id)

    if (!String(course.name || '').trim()) errors.push(`درس شمارهٔ ${n}: نام وارد نشده است.`)
    if (!teacherIds.has(String(course.teacher_id || '').trim())) {
      errors.push(`درس «${course.name || id}» به استادی اشاره میکند که وجود ندارد.`)
    }

    const sessions = Number(course.sessions_per_week)
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > 7) {
      errors.push(`تعداد جلسات درس «${course.name || id}» باید بین ۱ تا ۷ باشد.`)
    }

    const hours = Number(course.session_hours)
    if (!Number.isInteger(hours) || hours < 1 || hours > 6) {
      errors.push(`طول هر جلسه در درس «${course.name || id}» باید بین ۱ تا ۶ ساعت باشد.`)
    }

    if (!TERM_OPTIONS.includes(course.term)) errors.push(`ترم درس «${course.name || id}» نامعتبر است.`)
    if (!LEVEL_OPTIONS.includes(course.level)) errors.push(`مقطع درس «${course.name || id}» نامعتبر است.`)
    if (!String(course.major || '').trim()) errors.push(`رشتهٔ درس «${course.name || id}» خالی است.`)
  })

  const conflictKeys = new Set()
  payload.conflicts.forEach((conflict, index) => {
    const n = fa(index + 1)
    const a = String(conflict.course_a || '').trim()
    const b = String(conflict.course_b || '').trim()
    if (!a || !b) {
      errors.push(`تداخل شمارهٔ ${n}: هر دو درس باید انتخاب شوند.`)
      return
    }
    if (a === b) errors.push(`تداخل شمارهٔ ${n}: یک درس نمیتواند با خودش تداخل داشته باشد.`)
    if (!courseIds.has(a)) errors.push(`تداخل شمارهٔ ${n}: درس «${a}» وجود ندارد.`)
    if (!courseIds.has(b)) errors.push(`تداخل شمارهٔ ${n}: درس «${b}» وجود ندارد.`)
    const key = pairKey(a, b)
    if (conflictKeys.has(key)) errors.push(`تداخل بین «${a}» و «${b}» تکراری است.`)
    conflictKeys.add(key)
  })

  if (payload.conflicts.length === 0) warnings.push('هیچ تداخلی تعریف نشده است؛ در صورت نیاز از تب تداخلها اضافه کنید.')
  if (payload.courses.length === 0) warnings.push('هیچ درسی تعریف نشده است.')
  if (payload.teachers.length === 0) warnings.push('هیچ استادی تعریف نشده است.')

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  }
}
