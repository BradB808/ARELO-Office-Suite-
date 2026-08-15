// Generates build/icon.icns (from build/icons/suite.svg) plus 512px PNG
// previews for each hand-written app icon. Run with `npm run icons`.
//
// Usage: node scripts/make-icons.mjs
import { execSync } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const iconsDir = join(root, 'build', 'icons')
const iconsetDir = join(root, 'build', 'icon.iconset')
const icnsPath = join(root, 'build', 'icon.icns')

mkdirSync(iconsetDir, { recursive: true })

function log(label, path) {
  const size = existsSync(path) ? statSync(path).size : 0
  console.log(`  wrote ${label.padEnd(28)} ${path.replace(root + '/', '')} (${(size / 1024).toFixed(1)} KB)`)
}

async function renderPng(svgPath, outPath, size) {
  const svg = readFileSync(svgPath)
  // Render at a high density so vector edges stay crisp at every requested
  // pixel size, then resize down to the exact target.
  const density = 72 * (size / 1024) * 10
  await sharp(svg, { density })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath)
  log(`${size}x${size} png`, outPath)
}

async function main() {
  const suiteSvg = join(iconsDir, 'suite.svg')
  if (!existsSync(suiteSvg)) throw new Error(`missing ${suiteSvg}`)

  console.log('Rendering macOS iconset from build/icons/suite.svg...')
  const iconsetSizes = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ]
  for (const [name, size] of iconsetSizes) {
    await renderPng(suiteSvg, join(iconsetDir, name), size)
  }

  console.log('Building build/icon.icns with iconutil...')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' })
  log('icon.icns', icnsPath)

  console.log('Rendering 512px previews for every app icon...')
  for (const name of ['suite', 'docs', 'sheets', 'slides', 'forms']) {
    const svgPath = join(iconsDir, `${name}.svg`)
    if (!existsSync(svgPath)) {
      console.warn(`  skipping ${name}: ${svgPath} not found`)
      continue
    }
    const outPath = join(iconsDir, `${name}-512.png`)
    await renderPng(svgPath, outPath, 512)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
