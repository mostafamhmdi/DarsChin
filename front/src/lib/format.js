const faFormatter = new Intl.NumberFormat('fa-IR')

export function fa(value) {
  return faFormatter.format(value)
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${fa(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${fa((bytes / 1024).toFixed(1))} کیلوبایت`
  return `${fa((bytes / (1024 * 1024)).toFixed(2))} مگابایت`
}

export function jsonSize(text) {
  return new TextEncoder().encode(text).length
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// برجستهسازی سبک JSON بدون نیاز به کتابخانه خارجی
export function highlightJson(json) {
  const tokenRe = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(-?\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g
  let output = ''
  let lastIndex = 0
  let match

  while ((match = tokenRe.exec(json)) !== null) {
    output += escapeHtml(json.slice(lastIndex, match.index))
    const token = match[0]
    let className = 'json-punct'
    if (match[1]) className = 'json-key'
    else if (match[2]) className = 'json-string'
    else if (match[3]) className = 'json-number'
    else if (match[4]) className = 'json-literal'
    output += `<span class="${className}">${escapeHtml(token)}</span>`
    lastIndex = match.index + token.length
  }
  output += escapeHtml(json.slice(lastIndex))
  return output
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy method
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function downloadJson(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
