import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar, { NAV_ITEMS } from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Overview from './components/Overview.jsx'
import TeachersPanel from './components/TeachersPanel.jsx'
import CoursesPanel from './components/CoursesPanel.jsx'
import ConflictsPanel from './components/ConflictsPanel.jsx'
import StaticDataPanel from './components/StaticDataPanel.jsx'
import PayloadPanel from './components/PayloadPanel.jsx'
import ToastStack from './components/ToastStack.jsx'
import { ConfirmDialog } from './components/ui.jsx'
import { STATIC_DATA, cloneData, nextId } from './data/staticData.js'
import { validatePayload } from './lib/validation.js'
import { DEFAULT_ENDPOINT, describeError, endpointForMode, initialMode, submitSchedule } from './lib/api.js'
import { fa } from './lib/format.js'
import { useScheduleRuns } from './hooks/useScheduleRuns.js'

const pairKey = (a, b) => [a, b].sort().join('::')

export default function App() {
  const initial = useMemo(() => cloneData(), [])
  const [teachers, setTeachers] = useState(initial.teachers)
  const [courses, setCourses] = useState(initial.courses)
  const [conflicts, setConflicts] = useState(initial.conflicts)

  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mode, setMode] = useState(initialMode)
  const [liveEndpoint, setLiveEndpoint] = useState(DEFAULT_ENDPOINT)
  const [submitState, setSubmitState] = useState({ status: 'idle' })

  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const toastTimers = useRef(new Map())
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    const timers = toastTimers.current
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [])

  const pushToast = useCallback((title, message, type = 'info') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimers.current.delete(id)
    }, 4600)
    toastTimers.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id)
    if (timer) clearTimeout(timer)
    toastTimers.current.delete(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const openConfirm = useCallback((config) => setConfirm(config), [])

  const payload = useMemo(
    () => ({
      teachers,
      courses,
      slots: STATIC_DATA.slots,
      conflicts,
      config: STATIC_DATA.config,
    }),
    [teachers, courses, conflicts],
  )

  const validation = useMemo(() => validatePayload(payload), [payload])
  const effectiveEndpoint = useMemo(() => endpointForMode(mode, liveEndpoint), [mode, liveEndpoint])
  const activeMeta = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0]

  // اجرای سه الگوریتم روی همین payload (نتایج و ویرایش‌ها با عوض‌کردن تب از بین نمی‌روند)
  const schedule = useScheduleRuns({ payload, validation, endpoint: effectiveEndpoint, pushToast })

  const stats = {
    teachers: teachers.length,
    courses: courses.length,
    conflicts: conflicts.length,
    slots: STATIC_DATA.slots.length,
    config: STATIC_DATA.config,
  }

  const navigate = useCallback((id) => {
    setActiveTab(id)
    setSidebarOpen(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const updateTeacher = useCallback(
    (index, patch) => {
      const oldId = teachers[index]?.id
      const newId = patch.id
      setTeachers((prev) => prev.map((teacher, i) => (i === index ? { ...teacher, ...patch } : teacher)))
      if (newId !== undefined && newId !== oldId) {
        setCourses((prev) =>
          prev.map((course) => (course.teacher_id === oldId ? { ...course, teacher_id: newId } : course)),
        )
      }
    },
    [teachers],
  )

  const addTeacher = useCallback(() => {
    const id = nextId(teachers, 'T')
    const number = Number(id.slice(1))
    setTeachers((prev) => [
      ...prev,
      { id, name: `استاد ${fa(number)}`, available_days: [0, 1, 3], priority: 3 },
    ])
    pushToast('استاد اضافه شد', `کارت جدید با شناسهٔ ${id} ایجاد شد.`, 'success')
  }, [teachers, pushToast])

  const removeTeacher = useCallback(
    (index) => {
      const teacher = teachers[index]
      if (!teacher) return
      const affected = courses.filter((course) => course.teacher_id === teacher.id)
      const affectedIds = new Set(affected.map((course) => course.id))

      const doRemove = () => {
        setTeachers((prev) => prev.filter((_, i) => i !== index))
        setCourses((prev) => prev.filter((course) => course.teacher_id !== teacher.id))
        setConflicts((prev) =>
          prev.filter((conflict) => !affectedIds.has(conflict.course_a) && !affectedIds.has(conflict.course_b)),
        )
        pushToast('استاد حذف شد', `استاد «${teacher.name || teacher.id}» و دادههای مرتبط پاک شدند.`, 'info')
      }

      if (affected.length) {
        openConfirm({
          title: 'حذف استاد و دروس مرتبط',
          message: `استاد «${teacher.name || teacher.id}» دارای ${fa(affected.length)} درس است. با حذف این استاد، دروس و تداخلهای مربوط به آنها نیز حذف خواهند شد.`,
          confirmLabel: 'حذف استاد و دروس',
          tone: 'danger',
          onConfirm: doRemove,
        })
      } else {
        doRemove()
      }
    },
    [teachers, courses, pushToast, openConfirm],
  )

  const updateCourse = useCallback(
    (index, patch) => {
      const oldId = courses[index]?.id
      const newId = patch.id
      setCourses((prev) => prev.map((course, i) => (i === index ? { ...course, ...patch } : course)))
      if (newId !== undefined && newId !== oldId) {
        setConflicts((prev) =>
          prev.map((conflict) => ({
            course_a: conflict.course_a === oldId ? newId : conflict.course_a,
            course_b: conflict.course_b === oldId ? newId : conflict.course_b,
          })),
        )
      }
    },
    [courses],
  )

  const addCourse = useCallback(() => {
    const id = nextId(courses, 'C')
    const number = Number(id.slice(1))
    setCourses((prev) => [
      ...prev,
      {
        id,
        name: `درس ${fa(number)}`,
        teacher_id: teachers[0]?.id || '',
        sessions_per_week: 1,
        session_hours: 2,
        term: 'Term1',
        level: 'master',
        major: 'CE',
      },
    ])
    pushToast('درس اضافه شد', `کارت جدید با شناسهٔ ${id} ایجاد شد.`, 'success')
  }, [courses, teachers, pushToast])

  const removeCourse = useCallback(
    (index) => {
      const course = courses[index]
      if (!course) return
      const related = conflicts.filter(
        (conflict) => conflict.course_a === course.id || conflict.course_b === course.id,
      ).length

      const doRemove = () => {
        setCourses((prev) => prev.filter((_, i) => i !== index))
        setConflicts((prev) =>
          prev.filter((conflict) => conflict.course_a !== course.id && conflict.course_b !== course.id),
        )
        pushToast('درس حذف شد', `درس «${course.name || course.id}» و ${fa(related)} تداخل مرتبط پاک شد.`, 'info')
      }

      if (related > 0) {
        openConfirm({
          title: 'حذف درس و تداخلها',
          message: `درس «${course.name || course.id}» در ${fa(related)} تداخل شرکت دارد. با حذف آن، این تداخلها نیز حذف میشوند.`,
          confirmLabel: 'حذف درس',
          tone: 'danger',
          onConfirm: doRemove,
        })
      } else {
        doRemove()
      }
    },
    [courses, conflicts, pushToast, openConfirm],
  )

  const addConflict = useCallback(
    (pair) => {
      const a = pair.course_a
      const b = pair.course_b
      if (!a || !b) return { ok: false, message: 'هر دو درس باید انتخاب شوند.' }
      if (a === b) return { ok: false, message: 'یک درس نمیتواند با خودش تداخل داشته باشد.' }
      if (!courses.some((course) => course.id === a) || !courses.some((course) => course.id === b)) {
        return { ok: false, message: 'یکی از درسهای انتخابشده وجود ندارد.' }
      }
      const key = pairKey(a, b)
      if (conflicts.some((conflict) => pairKey(conflict.course_a, conflict.course_b) === key)) {
        return { ok: false, message: 'این جفت تداخل قبلاً ثبت شده است.' }
      }
      setConflicts((prev) => [...prev, { course_a: a, course_b: b }])
      pushToast('تداخل ثبت شد', `${a} ⟷ ${b} به لیست اضافه شد.`, 'success')
      return { ok: true }
    },
    [courses, conflicts, pushToast],
  )

  const removeConflict = useCallback(
    (index) => {
      setConflicts((prev) => prev.filter((_, i) => i !== index))
      pushToast('تداخل حذف شد', 'رابطهٔ انتخابشده از محموله حذف گردید.', 'info')
    },
    [pushToast],
  )

  const resetAll = useCallback(() => {
    openConfirm({
      title: 'بازگردانی دادهٔ اولیه',
      message: 'تمام تغییرات اساتید، دروس و تداخلها به مقادیر اولیهای که در مستندات تعریف شده بود برمیگردد. تنظیمات Endpoint تغییر نمیکند.',
      confirmLabel: 'بازگردانی',
      tone: 'primary',
      onConfirm: () => {
        const fresh = cloneData()
        setTeachers(fresh.teachers)
        setCourses(fresh.courses)
        setConflicts(fresh.conflicts)
        setSubmitState({ status: 'idle' })
        pushToast('دادهها بازگردانی شد', 'محموله به حالت اولیه برگشت.', 'success')
      },
    })
  }, [openConfirm, pushToast])

  const handleSubmit = useCallback(async () => {
    if (!validation.isValid) {
      pushToast('ارسال متوقف شد', 'ابتدا خطاهای اعتبارسنجی را اصلاح کنید.', 'error')
      navigate('payload')
      return
    }

    const endpoint = endpointForMode(mode, liveEndpoint)
    setSubmitState({ status: 'loading', endpoint })
    try {
      const result = await submitSchedule({ payload, endpoint, mode })
      setSubmitState({ status: 'success', endpoint, result, at: new Date().toISOString() })
      pushToast('ارسال موفق', `پاسخ ${result.status} از ${result.body?.source || 'بکاند'} دریافت شد.`, 'success')
    } catch (error) {
      const message = describeError(error)
      setSubmitState({ status: 'error', endpoint, message })
      pushToast('خطا در ارسال', message, 'error')
    }
  }, [validation.isValid, payload, mode, liveEndpoint, pushToast, navigate])

  const useLocal = useCallback(() => {
    setLiveEndpoint(DEFAULT_ENDPOINT)
    setMode('live')
    pushToast('آدرس تنظیم شد', `درخواستهای بعدی به ${DEFAULT_ENDPOINT} ارسال میشوند.`, 'info')
  }, [pushToast])

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onNavigate={navigate}
        stats={stats}
        validation={validation}
        onReset={resetAll}
        mode={mode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Topbar
          activeMeta={activeMeta}
          mode={mode}
          endpoint={effectiveEndpoint}
          validation={validation}
          submitStatus={submitState.status}
          onOpenSettings={() => navigate('payload')}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="app-content">
          {activeTab === 'overview' && (
            <Overview
              teachers={teachers}
              courses={courses}
              conflicts={conflicts}
              slots={STATIC_DATA.slots}
              config={STATIC_DATA.config}
              validation={validation}
              onNavigate={navigate}
              lastResult={submitState}
              schedule={schedule}
            />
          )}
          {activeTab === 'teachers' && (
            <TeachersPanel
              teachers={teachers}
              courses={courses}
              onUpdate={updateTeacher}
              onAdd={addTeacher}
              onRemove={removeTeacher}
            />
          )}
          {activeTab === 'courses' && (
            <CoursesPanel
              courses={courses}
              teachers={teachers}
              onUpdate={updateCourse}
              onAdd={addCourse}
              onRemove={removeCourse}
            />
          )}
          {activeTab === 'conflicts' && (
            <ConflictsPanel courses={courses} conflicts={conflicts} onAdd={addConflict} onRemove={removeConflict} />
          )}
          {activeTab === 'static' && <StaticDataPanel slots={STATIC_DATA.slots} config={STATIC_DATA.config} />}
          {activeTab === 'payload' && (
            <PayloadPanel
              payload={payload}
              validation={validation}
              mode={mode}
              setMode={setMode}
              liveEndpoint={liveEndpoint}
              setLiveEndpoint={setLiveEndpoint}
              effectiveEndpoint={effectiveEndpoint}
              submitState={submitState}
              onSubmit={handleSubmit}
              onReset={resetAll}
              onToast={pushToast}
              onUseLocal={useLocal}
            />
          )}
        </main>

        <footer className="app-footer">
          <span>سامانهٔ زمانبندی هوشمند · ساختهشده با React + Vite</span>
          <span>دادههای ثابت: {fa(STATIC_DATA.slots.length)} اسلات · {fa(STATIC_DATA.config.num_workers)} worker</span>
        </footer>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={Boolean(confirm)}
        {...(confirm || {})}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm?.()
          setConfirm(null)
        }}
      />
    </div>
  )
}
