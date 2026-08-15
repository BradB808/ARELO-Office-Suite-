// Runs every test suite that can execute under Node.
//
// The suites are plain TypeScript with no test-runner dependency: Vite compiles
// each to an SSR bundle and Node executes it. A suite signals failure by a
// non-zero exit code.
//
// Suites needing a DOM (the import sanitizer) or a real Electron process (the
// security layer) are listed at the end as a reminder rather than run here.

import { execFileSync } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = [
  'src/apps/sheets/engine/formula.test.ts',
  'src/apps/docs/convert/convert.test.ts',
  'src/shared/shared.test.ts',
  'src/apps/forms/forms.test.ts',
]

let failed = 0
const results = []

for (const suite of SUITES) {
  if (!existsSync(join(root, suite))) {
    results.push({ suite, status: 'missing' })
    failed++
    continue
  }
  const name = basename(suite, '.ts')
  const outDir = `.tmp-${name}`
  try {
    execFileSync('npx', ['vite', 'build', '--ssr', suite, '--outDir', outDir], {
      cwd: root,
      stdio: 'pipe',
    })
    const out = execFileSync('node', [join(outDir, `${name}.js`)], { cwd: root, stdio: 'pipe' })
      .toString()
      .trim()
    const tail = out.split('\n').filter(Boolean).slice(-2).join(' | ')
    results.push({ suite, status: 'pass', tail })
  } catch (err) {
    const out = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '')
    results.push({ suite, status: 'FAIL', tail: out.trim().split('\n').slice(-12).join('\n') })
    failed++
  } finally {
    rmSync(join(root, outDir), { recursive: true, force: true })
  }
}

console.log('')
for (const r of results) {
  const mark = r.status === 'pass' ? '✓' : '✗'
  console.log(`${mark} ${r.suite}`)
  if (r.tail) console.log(`   ${r.tail.replace(/\n/g, '\n   ')}`)
}

console.log('')
console.log(
  failed === 0
    ? `All ${results.length} Node suites passed.`
    : `${failed} of ${results.length} suites failed.`,
)
console.log('')
console.log('Not run here (need a browser / Electron):')
console.log('  npm run dev  → http://localhost:5173/security-test.html   (import sanitizer)')
console.log('  npm run verify:security                                   (security layer)')

process.exit(failed === 0 ? 0 : 1)
