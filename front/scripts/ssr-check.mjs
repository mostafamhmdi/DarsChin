// بررسی سریع رندر اولیه بدون نیاز به مرورگر
// اجرا: node scripts/ssr-check.mjs
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const mod = await vite.ssrLoadModule('/src/App.jsx')
  const html = renderToString(React.createElement(mod.default))
  console.log('✅ SSR OK — length:', html.length)
  console.log('✅ contains brand:', html.includes('زمانبند هوشمند'))
  console.log('✅ contains POST:', html.includes('POST'))
} catch (error) {
  console.error('❌ SSR FAILED:', error)
  process.exitCode = 1
} finally {
  await vite.close()
}
