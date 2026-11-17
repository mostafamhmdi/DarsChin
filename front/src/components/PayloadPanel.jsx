import { useMemo, useState } from 'react'
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FlaskConical,
  Info,
  LoaderCircle,
  Radio,
  RotateCcw,
  Send,
  Server,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Wifi,
} from 'lucide-react'
import { Badge, IconButton, SectionCard, TextInput } from './ui.jsx'
import { DEFAULT_ENDPOINT, isPreviewHost } from '../lib/api.js'
import { copyText, downloadJson, fa, formatBytes, highlightJson, jsonSize } from '../lib/format.js'

export default function PayloadPanel({
  payload,
  validation,
  mode,
  setMode,
  liveEndpoint,
  setLiveEndpoint,
  effectiveEndpoint,
  submitState,
  onSubmit,
  onReset,
  onToast,
  onUseLocal,
}) {
  const [view, setView] = useState('json')
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload])
  const bytes = useMemo(() => jsonSize(json), [json])
  const previewHost = isPreviewHost()

  const curl = `curl -X POST '${effectiveEndpoint}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json' \\\n  -d @payload.json`

  const handleCopy = async () => {
    const text = view === 'json' ? json : curl
    const ok = await copyText(text)
    onToast(ok ? 'کپی شد' : 'کپی انجام نشد', ok ? 'محتوای انتخابشده در حافظه قرار گرفت.' : 'مرورگر اجازهٔ دسترسی به حافظه را نداد.', ok ? 'success' : 'error')
  }

  const handleDownload = () => {
    downloadJson('schedule-payload.json', json)
    onToast('فایل ذخیره شد', 'schedule-payload.json در پوشهٔ دانلودها قرار گرفت.', 'success')
  }

  const result = submitState.result

  return (
    <div className="page-stack">
      <SectionCard
        title="محمولهٔ نهایی و ارسال"
        subtitle="همان چیزی که با متد POST به بکاند فرستاده میشود"
        icon={Send}
        badge={<Badge tone={validation.isValid ? 'green' : 'rose'}>{validation.isValid ? 'معتبر' : `${fa(validation.errors.length)} خطا`}</Badge>}
        actions={
          <div className="button-row">
            <IconButton icon={Copy} label="کپی محتوا" onClick={handleCopy} tone="soft" />
            <IconButton icon={Download} label="دانلود JSON" onClick={handleDownload} tone="soft" />
            <IconButton icon={RotateCcw} label="بازگردانی دادهها" onClick={onReset} tone="soft" />
          </div>
        }
      >
        <div className="payload-toolbar">
          <div className="segmented" role="tablist" aria-label="نوع پیشنمایش">
            <button type="button" className={view === 'json' ? 'is-active' : ''} onClick={() => setView('json')}>
              <Braces size={15} /> JSON
            </button>
            <button type="button" className={view === 'curl' ? 'is-active' : ''} onClick={() => setView('curl')}>
              <Terminal size={15} /> cURL
            </button>
          </div>
          <div className="payload-meta">
            <span><FileJson size={14} /> {formatBytes(bytes)}</span>
            <span><Radio size={14} /> {fa(json.split('\n').length)} خط</span>
            <span><Code2 size={14} /> ۵ کلید اصلی</span>
          </div>
        </div>

        <div className="code-shell">
          <div className="code-shell__bar">
            <span className="code-shell__dots"><i /><i /><i /></span>
            <span>{view === 'json' ? 'schedule-payload.json' : 'request.sh'}</span>
            <Badge tone="slate">POST</Badge>
          </div>
          <pre className="json-preview" dir="ltr">
            {view === 'json' ? (
              <code dangerouslySetInnerHTML={{ __html: highlightJson(json) }} />
            ) : (
              <code>{curl}</code>
            )}
          </pre>
        </div>
      </SectionCard>

      <div className="payload-grid">
        <SectionCard title="تنظیمات درخواست" subtitle="آدرس بکاند و حالت ارسال" icon={Server}>
          <div className="mode-switch">
            <button
              type="button"
              className={mode === 'live' ? 'is-active' : ''}
              onClick={() => setMode('live')}
            >
              <Wifi size={17} />
              <span>
                <strong>بکاند زنده</strong>
                <small>ارسال واقعی به API</small>
              </span>
            </button>
            <button
              type="button"
              className={mode === 'mock' ? 'is-active' : ''}
              onClick={() => setMode('mock')}
            >
              <FlaskConical size={17} />
              <span>
                <strong>حالت نمایشی</strong>
                <small>پاسخ شبیهسازیشده</small>
              </span>
            </button>
          </div>

          <div className="endpoint-field">
            <label htmlFor="endpoint-input">آدرس Endpoint</label>
            <div className="endpoint-input">
              <span className="endpoint-input__method">POST</span>
              <TextInput
                id="endpoint-input"
                value={mode === 'mock' ? effectiveEndpoint : liveEndpoint}
                onChange={setLiveEndpoint}
                disabled={mode === 'mock'}
                className="ltr-input"
                dir="ltr"
                placeholder={DEFAULT_ENDPOINT}
              />
            </div>
            <div className="endpoint-actions">
              <button type="button" className="text-button" onClick={onUseLocal}>
                استفاده از {DEFAULT_ENDPOINT}
              </button>
              {mode === 'live' && (
                <a className="text-button" href={effectiveEndpoint} target="_blank" rel="noreferrer">
                  باز کردن <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          {previewHost && (
            <div className="hint-box">
              <Info size={15} />
              <span>
                در پیشنمایش زندهٔ آرنا، مرورگر نمیتواند به <code dir="ltr">localhost</code> داخل سندباکس دسترسی
                داشته باشد؛ به همین دلیل حالت نمایشی به صورت پیشفرض فعال است. برای اتصال به بکاند خود، گزینهٔ
                «بکاند زنده» را انتخاب و آدرس قابلدسترس را وارد کنید.
              </span>
            </div>
          )}

          <div className="request-spec">
            <div><span>Method</span><bdi dir="ltr">POST</bdi></div>
            <div><span>Content-Type</span><bdi dir="ltr">application/json</bdi></div>
            <div><span>Timeout</span><bdi dir="ltr">30s</bdi></div>
            <div><span>Body keys</span><bdi dir="ltr">teachers · courses · slots · conflicts · config</bdi></div>
          </div>
        </SectionCard>

        <SectionCard title="اعتبارسنجی" subtitle="بررسی پیش از ارسال" icon={validation.isValid ? ShieldCheck : TriangleAlert}>
          {validation.isValid ? (
            <div className="validation-ok validation-ok--compact">
              <CheckCircle2 size={22} />
              <div>
                <strong>محموله معتبر است</strong>
                <p>شناسهها، ارجاعات، روزها، اولویتها و جفت تداخلها همگی سالم هستند.</p>
              </div>
            </div>
          ) : (
            <div className="validation-list">
              <div className="validation-list__head">
                <CircleAlert size={16} />
                {fa(validation.errors.length)} خطا باید اصلاح شود
              </div>
              <ul>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="warning-list">
              <div className="warning-list__head"><Info size={15} /> نکات غیرمسدودکننده</div>
              <ul>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="ارسال درخواست" subtitle="یک درخواست POST با محمولهٔ بالا" icon={Send}>
        <div className="submit-bar">
          <div className="submit-bar__info">
            <span className={`submit-bar__pulse submit-bar__pulse--${submitState.status}`} />
            <div>
              <strong>
                {submitState.status === 'loading'
                  ? 'در حال ارسال به بکاند…'
                  : submitState.status === 'success'
                    ? 'درخواست با موفقیت ارسال شد'
                    : submitState.status === 'error'
                      ? 'ارسال ناموفق بود'
                      : 'آمادهٔ ارسال'}
              </strong>
              <small dir="ltr">{effectiveEndpoint}</small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={onSubmit}
            disabled={!validation.isValid || submitState.status === 'loading'}
          >
            {submitState.status === 'loading' ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Send size={18} className="rtl-flip" />
            )}
            {submitState.status === 'loading' ? 'در حال ارسال…' : 'ارسال درخواست'}
          </button>
        </div>

        {!validation.isValid && (
          <div className="inline-error inline-error--block">
            <CircleAlert size={15} /> تا رفع خطاهای اعتبارسنجی، دکمهٔ ارسال غیرفعال است.
          </div>
        )}

        {submitState.status === 'success' && result && (
          <div className="response-card">
            <div className="response-card__head">
              <div>
                <Badge tone="green" icon={CheckCircle2}>{fa(result.status)} OK</Badge>
                <strong>پاسخ بکاند</strong>
              </div>
              <span>{result.body?.source === 'client-fallback' ? 'شبیهسازی محلی' : 'پاسخ واقعی'}</span>
            </div>
            <div className="response-summary">
              <span><b>{fa(result.body?.summary?.teachers ?? 0)}</b> استاد</span>
              <span><b>{fa(result.body?.summary?.courses ?? 0)}</b> درس</span>
              <span><b>{fa(result.body?.summary?.slots ?? 0)}</b> اسلات</span>
              <span><b>{fa(result.body?.summary?.conflicts ?? 0)}</b> تداخل</span>
            </div>
            {result.body?.requestId && (
              <div className="response-request-id">
                <ClipboardCheck size={14} /> requestId: <code dir="ltr">{result.body.requestId}</code>
              </div>
            )}
            <pre className="json-preview json-preview--response" dir="ltr">
              <code dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(result.body, null, 2)) }} />
            </pre>
          </div>
        )}

        {submitState.status === 'error' && (
          <div className="error-card">
            <CircleAlert size={20} />
            <div>
              <strong>خطا در ارتباط با بکاند</strong>
              <p>{submitState.message}</p>
            </div>
          </div>
        )}

        {submitState.status === 'idle' && (
          <div className="idle-hint">
            <Info size={15} />
            <span>
              برای تست بدون بکاند از حالت نمایشی استفاده کنید. برای اتصال واقعی، سرور خود را روی پورت ۸۰۰۰ اجرا
              کنید یا آدرس API را تغییر دهید.
            </span>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
