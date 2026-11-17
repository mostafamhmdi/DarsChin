// دادههای ثابت نسخهٔ اولیه (بدون دیتابیس)
// فقط teachers / courses / conflicts توسط کاربر قابل ویرایش هستند.
// slots و config در این فایل ثابت میمانند و هر بار عیناً در payload قرار میگیرند.

export const DAY_LABELS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سهشنبه', 'چهارشنبه']
export const DAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ']
export const DAY_COUNT = 5

export const TERM_OPTIONS = ['Term1', 'Term2', 'Term3']
export const TERM_LABELS = {
  Term1: 'ترم اول',
  Term2: 'ترم دوم',
  Term3: 'ترم سوم',
}

export const LEVEL_OPTIONS = ['bachelor', 'master', 'phd']
export const LEVEL_LABELS = {
  bachelor: 'کارشناسی',
  master: 'کارشناسی ارشد',
  phd: 'دکتری',
}

export const PRIORITY_OPTIONS = [1, 2, 3, 4, 5]

const SLOT_STARTS = ['08', '09', '10', '11', '14', '15', '16', '17']
const PENALTY_BY_START = { '08': 2, '09': 0, '10': 0, '11': 1, '14': 1, '15': 1, '16': 2, '17': 3 }

// همان ۴۰ اسلات تعریفشده در مستندات، تولیدشده از الگوی ثابت بالا
const SLOTS = Array.from({ length: DAY_COUNT }, (_, day) =>
  SLOT_STARTS.map((hour) => ({
    id: `d${day}_${hour}`,
    day,
    start: `${hour}:00`,
    end: `${String(Number(hour) + 1).padStart(2, '0')}:00`,
    penalty: PENALTY_BY_START[hour],
  })),
).flat()

export const SLOT_TIMES = SLOT_STARTS.map((hour) => `${hour}:00`)

export const PENALTY_META = {
  0: { label: 'بدون جریمه', tone: 'green' },
  1: { label: 'جریمهٔ کم', tone: 'amber' },
  2: { label: 'جریمهٔ متوسط', tone: 'orange' },
  3: { label: 'جریمهٔ بالا', tone: 'rose' },
}

export const STATIC_DATA = {
  teachers: [
    { id: 'T1', name: 'Mahdian', available_days: [0, 1, 3], priority: 5 },
    { id: 'T2', name: 'Jafariani', available_days: [0, 1, 3], priority: 5 },
    { id: 'T6', name: 'Poursadegh', available_days: [1, 2, 3], priority: 3 },
    { id: 'T3', name: 'Sadeghi', available_days: [1, 2, 3], priority: 3 },
    { id: 'T5', name: 'Askari', available_days: [1, 2, 3], priority: 3 },
    { id: 'T4', name: 'Moradi', available_days: [0, 1, 3], priority: 3 },
  ],
  courses: [
    { id: 'C1', name: 'ML', teacher_id: 'T1', sessions_per_week: 2, session_hours: 2, term: 'Term1', level: 'master', major: 'CE' },
    { id: 'C2', name: 'Adv DL', teacher_id: 'T1', sessions_per_week: 2, session_hours: 2, term: 'Term3', level: 'master', major: 'CE' },
    { id: 'C3', name: 'random process', teacher_id: 'T2', sessions_per_week: 2, session_hours: 2, term: 'Term1', level: 'master', major: 'CE' },
    { id: 'C4', name: 'Adv NLP', teacher_id: 'T2', sessions_per_week: 2, session_hours: 2, term: 'Term3', level: 'master', major: 'CE' },
    { id: 'C5', name: 'Language', teacher_id: 'T3', sessions_per_week: 1, session_hours: 2, term: 'Term3', level: 'master', major: 'CE' },
    { id: 'C6', name: 'Audio processing', teacher_id: 'T3', sessions_per_week: 2, session_hours: 2, term: 'Term1', level: 'master', major: 'CE' },
    { id: 'C7', name: 'TV', teacher_id: 'T4', sessions_per_week: 1, session_hours: 3, term: 'Term3', level: 'master', major: 'CE' },
    { id: 'C8', name: 'DSP', teacher_id: 'T5', sessions_per_week: 1, session_hours: 3, term: 'Term1', level: 'master', major: 'CE' },
    { id: 'C9', name: 'Audio basics', teacher_id: 'T6', sessions_per_week: 1, session_hours: 3, term: 'Term1', level: 'master', major: 'CE' },
  ],
  slots: SLOTS,
  conflicts: [
    { course_a: 'C1', course_b: 'C4' },
    { course_a: 'C1', course_b: 'C5' },
    { course_a: 'C1', course_b: 'C7' },
    { course_a: 'C2', course_b: 'C3' },
    { course_a: 'C3', course_b: 'C5' },
    { course_a: 'C3', course_b: 'C7' },
  ],
  config: {
    time_limit_sec: 30,
    num_workers: 8,
  },
}

export const cloneData = () => JSON.parse(JSON.stringify(STATIC_DATA))

export function nextId(items, prefix) {
  const max = items.reduce((acc, item) => {
    const match = String(item.id || '').match(new RegExp(`^${prefix}(\\d+)$`))
    return match ? Math.max(acc, Number(match[1])) : acc
  }, 0)
  return `${prefix}${max + 1}`
}

export function courseLabel(course) {
  if (!course) return '—'
  return `${course.name} (${course.id})`
}
