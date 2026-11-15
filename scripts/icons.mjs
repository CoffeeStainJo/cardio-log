// Generates PWA icons from an inline SVG. Run: npm run icons
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const icon = (s) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff8a5c"/>
      <stop offset="1" stop-color="#2fc7b5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0e0f13"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <path d="M72 280h84l40-110 60 210 52-150 28 50h104" fill="none" stroke="url(#g)"
      stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

await writeFile('public/favicon.svg', icon(1).trim())
const jobs = [
  ['public/pwa-192.png', 192, 1],
  ['public/pwa-512.png', 512, 1],
  ['public/pwa-512-maskable.png', 512, 0.72],
  ['public/apple-touch-icon.png', 180, 0.9],
]
for (const [file, size, s] of jobs) {
  await sharp(Buffer.from(icon(s))).resize(size, size).png().toFile(file)
  console.log('wrote', file)
}
