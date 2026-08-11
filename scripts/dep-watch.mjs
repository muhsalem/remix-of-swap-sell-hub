#!/usr/bin/env node
/**
 * مراقبة الاعتمادات الحساسة + التحديث التلقائي قبل حدوث الثغرات.
 *
 *   node scripts/dep-watch.mjs           # تنبيهات فقط (خروج 1 عند وجود خطر)
 *   node scripts/dep-watch.mjs --fix     # يرفع overrides للحد الآمن ثم bun install
 *   node scripts/dep-watch.mjs --json    # مخرجات JSON للأتمتة/CI
 *
 * مصادر الفحص:
 *  1. سجل npm (آخر إصدار) لكل حزمة في قائمة المراقبة.
 *  2. الإصدار المثبّت فعلياً من bun.lock / package-lock.json.
 *  3. تحذيرات npm الأمنية (bulk advisories endpoint).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const JSON_OUT = args.includes('--json')

const cfg = JSON.parse(readFileSync(join(root, 'scripts/dep-watch.config.json'), 'utf8'))
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const cmp = (a, b) => {
  const pa = String(a).replace(/^[^\d]*/, '').split('.').map(Number)
  const pb = String(b).replace(/^[^\d]*/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

/** الإصدارات المثبّتة فعلياً من ملف القفل النصّي */
function installedVersions() {
  const map = new Map()
  const bunLock = join(root, 'bun.lock')
  const npmLock = join(root, 'package-lock.json')
  if (existsSync(bunLock)) {
    const txt = readFileSync(bunLock, 'utf8')
    for (const m of txt.matchAll(/"((?:@[^"/]+\/)?[^"@/][^"]*?)@(\d+\.\d+\.\d+[^"]*)"/g)) {
      const [, name, version] = m
      if (!map.has(name) || cmp(version, map.get(name)) > 0) map.set(name, version)
    }
  } else if (existsSync(npmLock)) {
    const lock = JSON.parse(readFileSync(npmLock, 'utf8'))
    for (const [p, info] of Object.entries(lock.packages || {})) {
      if (!p.startsWith('node_modules/')) continue
      const name = p.slice(p.lastIndexOf('node_modules/') + 'node_modules/'.length)
      if (info.version && (!map.has(name) || cmp(info.version, map.get(name)) > 0)) map.set(name, info.version)
    }
  }
  return map
}

async function latestVersion(name) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}/latest`)
    if (!res.ok) return null
    return (await res.json()).version ?? null
  } catch {
    return null
  }
}

async function advisories(nameToVersions) {
  try {
    const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nameToVersions),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

const installed = installedVersions()
const bulk = {}
for (const w of cfg.watch) {
  const v = installed.get(w.name)
  if (v) bulk[w.name] = [v]
}
const advByPkg = await advisories(bulk)

const findings = []
for (const w of cfg.watch) {
  const current = installed.get(w.name) ?? null
  const latest = await latestVersion(w.name)
  const adv = advByPkg[w.name] || []
  const belowMin = current ? cmp(current, w.minVersion) < 0 : false
  const severity = adv.length
    ? (adv.some((a) => a.severity === 'critical') ? 'critical' : adv.some((a) => a.severity === 'high') ? 'high' : 'moderate')
    : belowMin
      ? 'high'
      : latest && current && cmp(latest, current) > 0
        ? 'info'
        : 'ok'
  findings.push({
    name: w.name,
    reason: w.reason,
    current,
    minVersion: w.minVersion,
    latest,
    belowMin,
    advisories: adv.map((a) => ({ title: a.title, severity: a.severity, url: a.url, patched: a.vulnerable_versions })),
    severity,
    target: adv.length || belowMin ? (latest && cmp(latest, w.minVersion) > 0 ? latest : w.minVersion) : null,
  })
}

const risky = findings.filter((f) => f.severity === 'critical' || f.severity === 'high')

if (FIX && risky.length) {
  pkg.overrides ||= {}
  pkg.resolutions ||= {}
  for (const f of risky) {
    if (!f.target) continue
    pkg.overrides[f.name] = `^${f.target}`
    pkg.resolutions[f.name] = `^${f.target}`
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  execSync('bun install', { cwd: root, stdio: 'inherit' })
}

if (JSON_OUT) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), fixed: FIX && risky.length > 0, findings }, null, 2))
} else {
  const icon = { critical: '🛑', high: '⚠️ ', moderate: '🔸', info: 'ℹ️ ', ok: '✅' }
  console.log('\n🔎 مراقبة الاعتمادات الحساسة\n' + '─'.repeat(60))
  for (const f of findings) {
    console.log(
      `${icon[f.severity]} ${f.name.padEnd(28)} مثبّت: ${(f.current ?? 'غير مثبّت').padEnd(12)} أدنى آمن: ${f.minVersion.padEnd(10)} أحدث: ${f.latest ?? '?'}`,
    )
    if (f.belowMin) console.log(`     ↳ أقل من الحد الآمن — ${f.reason}`)
    for (const a of f.advisories) console.log(`     ↳ [${a.severity}] ${a.title} ${a.url ?? ''}`)
  }
  console.log('─'.repeat(60))
  if (risky.length) {
    console.log(`❌ ${risky.length} اعتماد يحتاج تحديثاً فورياً.`)
    if (!FIX) console.log('   شغّل: bun run deps:fix')
  } else {
    console.log('✅ لا توجد مخاطر في الاعتمادات المراقَبة.')
  }
}

process.exit(risky.length && !FIX ? 1 : 0)
