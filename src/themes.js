// Flat colour themes, cycled across decks. s1-s3 colour the artwork.
const THEMES = [
  { bg: '#5bb8ff', fg: '#ffffff', dot: '#ff5757', s1: '#fff27f', s2: '#ffffff', s3: '#cdeaff' },
  { bg: '#90d2d6', fg: '#034d7c', dot: '#ee4a14', s1: '#034d7c', s2: '#ffffff', s3: '#ff7480' },
  { bg: '#ff5757', fg: '#feebad', dot: '#7a3b3b', s1: '#feebad', s2: '#fdd87c', s3: '#feebad' },
  { bg: '#ffd95a', fg: '#034d7c', dot: '#ff5757', s1: '#ffffff', s2: '#034d7c', s3: '#5bb8ff' },
]

// Tiny seeded random generator, so a given card always gets the same artwork.
function rng(seed) {
  let h = 1779033703
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const n = (v) => Math.round(v)

// Each maker draws one flat shape around (x, y) in a 200x200 box.
const SHAPES = [
  (r, x, y, fill) => {
    const w = 40 + r() * 70
    const h = 30 + r() * 80
    return `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" transform="rotate(${n(r() * 90 - 45)} ${n(x)} ${n(y)})" fill="${fill}"/>`
  },
  (r, x, y, fill) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(22 + r() * 34)}" fill="${fill}"/>`,
  (r, x, y, fill) => {
    const pts = [0, 1, 2].map((i) => {
      const angle = r() * 2 + i * 2.1
      const d = 40 + r() * 50
      return `${n(x + Math.cos(angle) * d)},${n(y + Math.sin(angle) * d)}`
    })
    return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`
  },
  (r, x, y, fill) => {
    const rad = 28 + r() * 34
    return `<path d="M${n(x - rad)},${n(y)} a${n(rad)},${n(rad)} 0 0 1 ${n(rad * 2)},0 z" transform="rotate(${n(r() * 360)} ${n(x)} ${n(y)})" fill="${fill}"/>`
  },
  (r, x, y, fill) => {
    const rad = 26 + r() * 26
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rad)}" fill="none" stroke="${fill}" stroke-width="${n(8 + r() * 10)}"/>`
  },
  (r, x, y, fill) => {
    const count = 2 + Math.floor(r() * 3)
    const h = 40 + r() * 30
    const bars = Array.from({ length: count }, (_, i) => `<rect x="${n(x - 40 + i * 28)}" y="${n(y - h / 2)}" width="14" height="${n(h)}" fill="${fill}"/>`)
    return `<g transform="rotate(${n(r() * 80 - 40)} ${n(x)} ${n(y)})">${bars.join('')}</g>`
  },
  (r, x, y, fill) => {
    const w = 70 + r() * 60
    const h = 40 + r() * 40
    const skew = 15 + r() * 30
    return `<polygon points="${n(x - w / 2 + skew)},${n(y - h / 2)} ${n(x + w / 2)},${n(y - h / 2 - skew / 2)} ${n(x + w / 2)},${n(y + h / 2)} ${n(x - w / 2)},${n(y + h / 2)}" fill="${fill}"/>`
  },
]

export function themeVars(index) {
  const t = THEMES[index % THEMES.length]
  return `--bg:${t.bg};--fg:${t.fg};--dot:${t.dot};--s1:${t.s1};--s2:${t.s2};--s3:${t.s3}`
}

// Random flat-shape artwork in a box `ratio` times wider than tall. Shapes sit
// low in the box so they rise from the bottom edge of wherever it is placed.
export function art(seed, ratio = 1) {
  const r = rng(seed)
  const width = 200 * ratio
  const fills = ['var(--s1)', 'var(--s2)', 'var(--s3)']
  const count = Math.round((3 + r() * 2) * Math.max(1, ratio * 0.6))
  let shapes = ''
  for (let i = 0; i < count; i++) {
    const make = SHAPES[Math.floor(r() * SHAPES.length)]
    shapes += make(r, r() * width, 120 + r() * 90, fills[i % fills.length])
  }
  return `<svg class="art" viewBox="0 0 ${width} 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${shapes}</svg>`
}
