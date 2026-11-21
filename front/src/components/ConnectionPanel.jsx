import { ChevronDown, CircleAlert, ExternalLink, FileJson, FlaskConical, Info, LoaderCircle, RefreshCw, Server, ShieldCheck, Wifi } from 'lucide-react'
import { Badge, Field, SectionCard, Select, TextInput } from './ui.jsx'
import { API_PATHS, isPreviewHost, joinUrl, PROXY_API_BASE } from '../lib/api.js'
import { fa, highlightJson } from '../lib/format.js'

export default function ConnectionPanel({ scheduler }) {
  const { mode, setMode, baseUrl, setBaseUrl, effectiveBaseUrl, connection, selectorMode, setSelectorMode, selectorKey, setSelectorKey, selector, selectorError, uploadEnabled, setUploadEnabled, uploadPath, setUploadPath, busy, refresh } = scheduler
  const available = connection.engines.filter((engine) => engine.available)
  let docs = '#'
  try { docs = joinUrl(effectiveBaseUrl, '/docs') } catch { /* Invalid URL stays non-navigable. */ }
  return <SectionCard title="اتصال به API" subtitle="کشف الگوریتم‌ها و قرارداد درخواست از بک‌اند" icon={Server} className="connection-panel"
    actions={<button type="button" className="btn btn--ghost btn--sm" onClick={refresh} disabled={busy || connection.status === 'loading'}><RefreshCw size={14} className={connection.status === 'loading' ? 'spin' : ''} />بررسی اتصال</button>}>
    <fieldset className="settings-fieldset" disabled={busy}>
      <div className="mode-switch">
        <button type="button" className={mode === 'live' ? 'is-active' : ''} aria-pressed={mode === 'live'} onClick={() => setMode('live')}><Wifi size={17} /><span><strong>بک‌اند واقعی</strong><small>اجرای الگوریتم‌های نصب‌شده</small></span></button>
        <button type="button" className={mode === 'mock' ? 'is-active' : ''} aria-pressed={mode === 'mock'} onClick={() => setMode('mock')}><FlaskConical size={17} /><span><strong>محیط نمایشی</strong><small>فقط پاسخ شبیه‌سازی‌شده</small></span></button>
      </div>
      <Field label="نشانی پایه API" hint="مسیر /v1/schedule/solve خودکار اضافه می‌شود؛ آدرس کامل solve را اینجا وارد نکنید.">
        <TextInput aria-label="نشانی پایه API" value={mode === 'mock' ? effectiveBaseUrl : baseUrl} onChange={setBaseUrl} disabled={mode === 'mock'} className="ltr-input" dir="ltr" placeholder="/api یا https://api.example.com" />
      </Field>
      <div className="endpoint-actions"><button type="button" className="text-button" onClick={() => { setBaseUrl(PROXY_API_BASE); setMode('live') }}>استفاده از پراکسی /api</button>{mode === 'live' && docs !== '#' && <a className="text-button" href={docs} target="_blank" rel="noreferrer">مستندات Swagger <ExternalLink size={12} /></a>}</div>
      <div className="hint-box connection-hint"><Info size={15} /><span>{mode === 'mock' ? 'این محیط از API نمایشی داخلی استفاده می‌کند. نام و نتیجه الگوریتم‌ها نمونه‌اند و هیچ ارتباطی با بک‌اند واقعی برقرار نمی‌شود.' : <>مرورگر به مسیر هم‌مبدأ <code>/api</code> درخواست می‌دهد؛ Vite آن را به سرور پورت ۸۰۰۱ منتقل می‌کند. مقصد پراکسی با <code>VITE_API_PROXY_TARGET</code> تنظیم می‌شود.{isPreviewHost() ? ' بک‌اند روی رایانه شما باید URL قابل‌دسترسی HTTPS داشته باشد؛ localhost رایانه شما از این سرور قابل‌دسترسی نیست.' : ' برای دامنه جداگانه، CORS بک‌اند باید اجازه دسترسی بدهد.'}</>}</span></div>
      <div className="api-route-list" aria-label="وضعیت اندپوینت‌ها">{['health', 'engines', 'schema', 'openapi'].map((name) => {
        const result = connection.diagnostics?.[name]
        return <div className="api-route" key={name}><code dir="ltr"><b>GET</b> {API_PATHS[name]}</code><span title={result?.message}>{connection.status === 'loading' ? <LoaderCircle size={13} className="spin" /> : result ? <Badge tone={result.ok ? 'green' : 'rose'}>{result.status ? `HTTP ${result.status}` : result.ok ? 'دریافت شد' : 'ناموفق'}</Badge> : <Badge tone="slate">بررسی نشده</Badge>}</span></div>
      })}</div>
      {connection.status === 'error' && <div className="overview-notice overview-notice--error"><CircleAlert size={16} /><span>{connection.message || connection.diagnostics?.engines?.message || 'دریافت فهرست الگوریتم‌ها انجام نشد.'}</span></div>}
      <details className="engine-catalog" open={connection.engines.length > 0 ? undefined : false}><summary><CpuIcon /><strong>الگوریتم‌های بک‌اند</strong><Badge tone="slate">{fa(available.length)} در دسترس / {fa(connection.engines.length)} موتور</Badge><ChevronDown size={14} /></summary><div>{connection.engines.length ? connection.engines.map((engine) => <details className={`catalog-engine ${!engine.available ? 'is-unavailable' : ''}`} key={engine.name}><summary><span className={`status-dot ${engine.available ? 'is-ok' : 'is-warn'}`} /><bdi>{engine.name}</bdi><Badge tone={engine.available ? 'green' : 'slate'}>{engine.available ? 'اجرا می‌شود' : 'رد می‌شود'}</Badge><ChevronDown size={13} /></summary>{engine.error && <p>{engine.error}</p>}<pre dir="ltr">{JSON.stringify(engine.capabilities, null, 2)}</pre></details>) : <p className="muted">فهرستی دریافت نشده است.</p>}</div></details>
      <details className="advanced-settings" open={selectorError || (connection.status === 'ready' && !selector) ? true : undefined}>
        <summary><ShieldCheck size={15} /><strong>قرارداد انتخاب الگوریتم</strong><Badge tone={selector ? 'green' : 'amber'}>{selector ? 'مشخص' : 'نیازمند بررسی'}</Badge><ChevronDown size={14} /></summary>
        <div className="advanced-settings__content">
          <Field label="محل پارامتر الگوریتم"><Select aria-label="محل پارامتر الگوریتم" value={selectorMode} onChange={setSelectorMode} options={[{ value: 'auto', label: 'تشخیص خودکار از OpenAPI / Schema' }, { value: 'query', label: 'Query parameter (مثلاً ?engine=...)' }, { value: 'config', label: 'داخل config (فقط طبق قرارداد بک‌اند)' }, { value: 'body', label: 'فیلد بدنه (فقط طبق قرارداد بک‌اند)' }]} /></Field>
          {selectorMode !== 'auto' && <Field label="نام پارامتر"><TextInput aria-label="نام پارامتر الگوریتم" value={selectorKey} onChange={setSelectorKey} className="ltr-input" dir="ltr" /></Field>}
          {selector ? <p className="selector-detected"><CheckIcon />{selector.source}: <code dir="ltr">{selector.location === 'query' ? `?${selector.key}={engine}` : selector.location === 'config' ? `config.${selector.key}` : selector.key}</code></p> : <p className="selector-missing">{selectorError || 'هنوز قرارداد انتخاب موتور مشخص نیست. پاسخ GET /v1/engines فقط نام و قابلیت‌ها را می‌دهد؛ برای جای پارامتر، OpenAPI لازم است. بدون قرارداد معتبر درخواست حدسی ارسال نمی‌شود.'}</p>}
          <p className="muted">با توجه به extra="forbid"، هیچ فیلدی برای انتخاب موتور به بدنه اضافه نمی‌شود مگر آنکه در Schema اعلام شده یا شما قرارداد را دستی مشخص کنید. مقادیر ثابت حلگر در فرم تغییر نمی‌کنند.</p>
        </div>
      </details>
      <details className="advanced-settings future-input">
        <summary><FileJson size={15} /><strong>مرحله دریافت JSON</strong><Badge tone={uploadEnabled ? 'violet' : 'slate'}>{uploadEnabled ? 'فعال' : 'آینده · غیرفعال'}</Badge><ChevronDown size={14} /></summary>
        <div className="advanced-settings__content"><p className="muted">فعلاً JSON مستقیماً برای هر موتور ارسال می‌شود. بعد از آماده شدن اندپوینت دریافت ورودی، این مرحله را فعال کنید تا یک POST قبل از تمام حلگرها انجام شود.</p><label className="checkbox-setting"><input type="checkbox" checked={uploadEnabled} onChange={(event) => setUploadEnabled(event.target.checked)} /><span>ارسال یک‌باره JSON پیش از اجرای الگوریتم‌ها</span></label><Field label="اندپوینت دریافت JSON"><TextInput aria-label="اندپوینت دریافت JSON" value={uploadPath} onChange={setUploadPath} disabled={!uploadEnabled} dir="ltr" className="ltr-input" placeholder="مسیر یا URL نهایی، پس از اعلام بک‌اند" /></Field><p className="muted">اگر این مرحله خطا بدهد، حلگرها اجرا نمی‌شوند. پاسخ ثبت نگه داشته می‌شود؛ تا مشخص‌شدن قرارداد شناسه، هر حلگر همان JSON را دریافت می‌کند و هیچ problem_id حدسی ارسال نمی‌شود.</p></div>
      </details>
      {connection.diagnostics?.schema?.ok && <details className="advanced-settings"><summary><FileJson size={15} /><strong>JSON Schema دریافتی</strong><ChevronDown size={14} /></summary><pre className="json-preview result-json" dir="ltr"><code dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(connection.diagnostics.schema.body, null, 2)) }} /></pre></details>}
      {busy && <p className="muted">تنظیمات اتصال تا پایان این اجرا قفل هستند.</p>}
    </fieldset>
  </SectionCard>
}
function CpuIcon() { return <Server size={15} /> }
function CheckIcon() { return <ShieldCheck size={14} /> }
