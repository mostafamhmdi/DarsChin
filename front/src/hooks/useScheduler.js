import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiBaseForMode, describeError, discoverBackend, initialBaseUrl, initialMode, resolveEngineSelector } from '../lib/api.js'
import { executePipeline } from '../lib/scheduling.js'
import { sampleRun } from '../data/sampleResult.js'

const initialConnection = { status: 'idle', engines: [], diagnostics: {} }
const initialRun = { status: 'idle', phase: 'idle', runs: [], upload: null }

export default function useScheduler({ payload, onToast }) {
  const [mode, setMode] = useState(initialMode)
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl)
  const [selectorMode, setSelectorMode] = useState('auto')
  const [selectorKey, setSelectorKey] = useState('engine')
  const [uploadEnabled, setUploadEnabled] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [connection, setConnection] = useState(initialConnection)
  const [runState, setRunState] = useState(initialRun)
  const connectionController = useRef(null)
  const runController = useRef(null)
  const connectionSequence = useRef(0)
  const runSequence = useRef(0)
  const locked = useRef(false)
  const effectiveBaseUrl = apiBaseForMode(mode, baseUrl)
  const settings = useMemo(() => ({ mode, baseUrl: effectiveBaseUrl, selectorMode, selectorKey, uploadEnabled, uploadPath }), [mode, effectiveBaseUrl, selectorMode, selectorKey, uploadEnabled, uploadPath])
  const settingsJson = JSON.stringify(settings)
  const payloadJson = JSON.stringify(payload)
  const busy = runState.status === 'loading'

  const refresh = useCallback(async () => {
    if (locked.current) return
    connectionController.current?.abort()
    const controller = new AbortController()
    connectionController.current = controller
    const sequence = ++connectionSequence.current
    setConnection({ ...initialConnection, status: 'loading' })
    try {
      const catalog = await discoverBackend({ baseUrl: effectiveBaseUrl, signal: controller.signal })
      if (sequence === connectionSequence.current) setConnection({ ...catalog, status: catalog.diagnostics.engines.ok ? 'ready' : 'error' })
    } catch (error) {
      if (error.name !== 'AbortError' && sequence === connectionSequence.current) setConnection({ ...initialConnection, status: 'error', message: describeError(error) })
    }
  }, [effectiveBaseUrl])

  useEffect(() => {
    // Invalidate immediately, not after the debounce, so a previous server is never shown as connected.
    connectionController.current?.abort()
    ++connectionSequence.current
    setConnection({ ...initialConnection })
    const timer = setTimeout(refresh, 350)
    return () => { clearTimeout(timer); connectionController.current?.abort(); ++connectionSequence.current }
  }, [refresh])

  useEffect(() => () => {
    connectionController.current?.abort()
    runController.current?.abort()
    ++runSequence.current
  }, [])

  let selector = null
  let selectorError = null
  try {
    selector = resolveEngineSelector({ openapi: connection.diagnostics?.openapi?.body, schema: connection.diagnostics?.schema?.body, selectorMode, selectorKey })
  } catch (error) { selectorError = describeError(error) }

  const process = useCallback(async () => {
    if (locked.current) return
    locked.current = true
    const id = ++runSequence.current
    const controller = new AbortController()
    runController.current = controller
    connectionController.current?.abort()
    ++connectionSequence.current
    const snapshot = JSON.parse(payloadJson)
    let catalogReceived = false
    setConnection({ ...initialConnection, status: 'loading' })
    setRunState({ ...initialRun, status: 'loading', phase: 'discovery', payload: snapshot, payloadJson, settingsJson, settings, mode, startedAt: Date.now() })
    const patch = (value) => { if (id === runSequence.current) setRunState((previous) => ({ ...previous, ...value })) }
    try {
      const outcome = await executePipeline({
        payload: snapshot, settings, signal: controller.signal,
        onPhase: (phase) => patch({ phase }),
        onCatalog: (catalog) => {
          catalogReceived = true
          if (id === runSequence.current) {
            setConnection({ ...catalog, status: catalog.diagnostics.engines.ok ? 'ready' : 'error' })
            patch({ catalog })
          }
        },
        onRuns: (runs) => patch({ runs }),
        onRun: (index, run) => {
          if (id === runSequence.current) setRunState((previous) => ({ ...previous, runs: previous.runs.map((item, i) => i === index ? run : item) }))
        },
        onUpload: (upload) => patch({ upload }),
      })
      patch({ ...outcome, phase: 'done', finishedAt: Date.now() })
      if (outcome.status === 'cancelled') onToast('دریافت پاسخ لغو شد', 'نتایج دریافت‌شده حفظ شدند؛ لغو درخواست به معنی توقف پردازش سرور نیست.', 'info')
      else onToast('پردازش پایان یافت', `${outcome.received} پاسخ از ${outcome.runs.length} الگوریتم دریافت شد.`, outcome.status === 'success' ? 'success' : outcome.status === 'partial' ? 'info' : 'error')
    } catch (error) {
      const cancelled = error.name === 'AbortError'
      if (!catalogReceived && id === runSequence.current) {
        setConnection({ ...initialConnection, status: cancelled ? 'idle' : 'error', ...(!cancelled ? { message: describeError(error) } : {}) })
      }
      patch({ status: cancelled ? 'cancelled' : 'error', phase: 'done', message: describeError(error), finishedAt: Date.now() })
      if (!cancelled) onToast('پردازش متوقف شد', describeError(error), 'error')
    } finally {
      if (id === runSequence.current) { locked.current = false; runController.current = null }
    }
  }, [payloadJson, settingsJson, settings, mode, onToast])

  const loadSample = useCallback(() => {
    if (locked.current) return
    ++runSequence.current
    const snapshot = JSON.parse(payloadJson)
    const run = sampleRun()
    setRunState({
      ...initialRun, status: 'success', phase: 'done', mode: 'sample', runs: [run], received: 1,
      payload: snapshot, payloadJson, settingsJson, settings, startedAt: Date.now(), finishedAt: Date.now(),
    })
  }, [payloadJson, settingsJson, settings])

  // A static preview has no backend; show the stored sample response once instead of an empty screen.
  const autoSampled = useRef(false)
  useEffect(() => {
    if (autoSampled.current || !import.meta.env.PROD) return
    if (connection.status !== 'error' || runState.status !== 'idle' || locked.current) return
    autoSampled.current = true
    loadSample()
  }, [connection.status, runState.status, loadSample])

  const cancel = useCallback(() => runController.current?.abort(), [])
  const clearResults = useCallback(() => { if (!locked.current) setRunState(initialRun) }, [])
  const stale = Boolean(runState.payloadJson && (runState.payloadJson !== payloadJson || runState.settingsJson !== settingsJson))

  return {
    mode, setMode, baseUrl, setBaseUrl, effectiveBaseUrl,
    selectorMode, setSelectorMode, selectorKey, setSelectorKey,
    uploadEnabled, setUploadEnabled, uploadPath, setUploadPath,
    connection, selector, selectorError, runState, busy, stale,
    refresh, process, cancel, clearResults, loadSample,
  }
}
