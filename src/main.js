import { decks, groups } from './decks.js'
import { state, save, buildQueue, swipe, undo, stats, reset } from './srs.js'
import { themeVars, art } from './themes.js'
import { japaneseVoices, currentVoice, setVoice, speak, onVoicesChanged } from './speech.js'

const app = document.querySelector('#app')
const SWIPE_DISTANCE = 90
const TAP_SLOP = 8

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

let selected = new Set((state.selected ?? decks.map((d) => d.id)).filter((id) => decks.some((d) => d.id === id)))
const collapsed = new Set(state.collapsed ?? [])
let queue = []
let current = null
let lastUndo = null
let busy = false

/* ---------- home ---------- */

function deckTile(d) {
  const s = stats(d.cards)
  const on = selected.has(d.id)
  return `
    <li class="relative">
      <button data-deck="${d.id}" aria-pressed="${on}" style="${themeVars(d.index)}"
        class="tile themed relative flex min-h-60 w-full flex-col overflow-hidden rounded-[2rem] border-[5px] p-5 text-left transition
          ${on ? 'border-white shadow-xl' : 'border-transparent opacity-45 hover:opacity-70'}">
        ${art(d.id)}
        <span class="relative block size-8 rounded-full" style="background:var(--dot)"></span>
        <span class="relative mt-4 block h-px w-6 bg-current opacity-50"></span>
        <h3 class="relative mt-3 max-w-[70%] text-2xl leading-[1.05] font-extrabold">${esc(d.title)}</h3>
        <p class="relative mt-2 max-w-[60%] text-xs leading-snug font-medium opacity-80">${esc(d.description)}</p>
        <span class="relative mt-auto block pt-6 text-xs font-bold tracking-wide">WORDS</span>
        <span class="relative block text-6xl leading-none font-black">${s.total}</span>
        <span class="relative mt-4 block text-sm font-bold">${on ? '✓ Selected' : 'Select'}</span>
      </button>
      ${
        s.known + s.learning
          ? `<button data-reset="${d.id}" style="${themeVars(d.index)};color:var(--fg)"
              class="absolute right-6 bottom-5 text-sm font-bold ${on ? '' : 'opacity-45'} hover:underline">Reset</button>`
          : ''
      }
    </li>`
}

// Only worth showing when the device offers a choice of Japanese voices.
function voicePicker() {
  const voices = japaneseVoices()
  if (voices.length < 2) return ''
  const chosen = currentVoice()
  return `
    <label class="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm font-bold">
      <span class="text-white/70">Japanese voice</span>
      <select id="voice" class="max-w-full rounded-full bg-white px-4 py-2 font-bold text-navy">
        ${voices
          .map(
            (v) =>
              `<option value="${esc(v.voiceURI)}" ${v === chosen ? 'selected' : ''}>${esc(v.name)}${v.localService ? '' : ' (online)'}</option>`,
          )
          .join('')}
      </select>
    </label>`
}

function renderHome() {
  current = null
  const count = decks.filter((d) => selected.has(d.id)).reduce((n, d) => n + d.cards.length, 0)

  app.innerHTML = `
    <main class="mx-auto flex min-h-full max-w-7xl flex-col px-4 pt-8 pb-32 sm:px-8">
      <header class="mb-2">
        <span class="block size-9 rounded-full bg-[#ff5757]"></span>
        <span class="mt-4 block h-px w-6 bg-white/50"></span>
        <h1 class="mt-3 text-4xl leading-none font-extrabold sm:text-5xl">Romaji<br />Cards</h1>
      </header>

      ${groups
        .map((g) => {
          const allOn = g.decks.every((d) => selected.has(d.id))
          const open = !collapsed.has(g.id)
          return `
            <section class="mt-8">
              <div class="flex items-end justify-between gap-4 border-b border-white/20 pb-3">
                <button data-fold="${g.id}" aria-expanded="${open}" class="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span class="inline-block text-sm transition-transform ${open ? 'rotate-90' : ''}">▶</span>
                  <h2 class="truncate text-xl font-extrabold sm:text-2xl">${esc(g.title)}</h2>
                </button>
                <button data-group="${g.id}" class="text-sm font-bold text-white/70 hover:text-white">
                  ${allOn ? 'Select none' : 'Select all'}
                </button>
              </div>
              ${
                open
                  ? `<ul class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${g.decks.map(deckTile).join('')}</ul>`
                  : ''
              }
            </section>`
        })
        .join('')}

      ${voicePicker()}

      <div class="mt-10 flex justify-center gap-8 text-sm font-bold text-white/60">
        <button id="reset-selected" class="hover:text-white">Reset selected</button>
        <span class="h-5 w-px rotate-[25deg] bg-white/30"></span>
        <button id="reset-all" class="hover:text-white">Reset all</button>
      </div>
    </main>

    <div class="fixed inset-x-0 bottom-0 bg-gradient-to-t from-navy via-navy to-transparent px-4 pt-10 pb-5">
      <button id="start" ${count ? '' : 'disabled'}
        class="mx-auto block w-full max-w-md rounded-full bg-white py-4 text-lg font-extrabold text-navy shadow-xl
          transition active:scale-[0.98] disabled:opacity-40">
        ${count ? `Study ${count} words` : 'Pick a deck'}
      </button>
    </div>`

  const select = (ids, on) => {
    for (const id of ids) on ? selected.add(id) : selected.delete(id)
    state.selected = [...selected]
    save()
    renderHome()
  }
  app.querySelectorAll('[data-deck]').forEach((btn) =>
    btn.addEventListener('click', () => select([btn.dataset.deck], !selected.has(btn.dataset.deck))),
  )
  app.querySelectorAll('[data-group]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const ids = groups.find((g) => g.id === btn.dataset.group).decks.map((d) => d.id)
      select(ids, !ids.every((id) => selected.has(id)))
    }),
  )
  app.querySelectorAll('[data-fold]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.fold
      collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id)
      state.collapsed = [...collapsed]
      save()
      renderHome()
    }),
  )
  app.querySelector('#voice')?.addEventListener('change', (e) => {
    setVoice(e.target.value)
    speak('こんにちは') // let them hear the voice they picked
  })
  app.querySelector('#start').addEventListener('click', startStudy)

  const confirmReset = (question, targets) => {
    if (!confirm(question)) return
    reset(targets.flatMap((d) => d.cards))
    renderHome()
  }
  app.querySelectorAll('[data-reset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const deck = decks.find((d) => d.id === btn.dataset.reset)
      confirmReset(`Forget progress for "${deck.title}"?`, [deck])
    }),
  )
  app.querySelector('#reset-selected').addEventListener('click', () => {
    const chosen = decks.filter((d) => selected.has(d.id))
    if (chosen.length) confirmReset(`Forget progress for the ${chosen.length} selected deck(s)?`, chosen)
  })
  app.querySelector('#reset-all').addEventListener('click', () => confirmReset('Forget all progress and start over?', decks))
}

/* ---------- study ---------- */

// Round-robin across the chosen decks so a mixed session isn't one topic at a time.
function buildPool() {
  const lists = decks.filter((d) => selected.has(d.id)).map((d) => d.cards)
  const out = []
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i])
  }
  return out
}

function startStudy() {
  queue = buildQueue(buildPool())
  if (!queue.length) return
  lastUndo = null

  app.innerHTML = `
    <main class="mx-auto flex h-full max-w-7xl flex-col px-5 pt-4 pb-4 sm:px-8">
      <header class="flex items-center justify-between gap-3 text-base font-bold">
        <button id="home" class="py-1 hover:underline">← Decks</button>
        <button id="undo" class="py-1 hover:underline disabled:opacity-30 disabled:hover:no-underline">Undo</button>
      </header>

      <section class="flex min-h-0 flex-1 items-center justify-center pb-5">
        <div class="stage relative">
          <div class="absolute inset-0 translate-y-5 scale-[0.9] rounded-[2rem] bg-white/15"></div>
          <div class="absolute inset-0 translate-y-2.5 scale-[0.95] rounded-[2rem] bg-white/30"></div>
          <div id="slot" class="absolute inset-0"></div>
        </div>
      </section>
    </main>`

  app.querySelector('#home').addEventListener('click', renderHome)
  app.querySelector('#undo').addEventListener('click', undoLast)
  showCard(queue[0])
}

// Big type that still fits: scale with the card, step down for longer text.
function fit(text, steps) {
  const [, w, h] = steps.find(([max]) => text.length <= max)
  return `font-size:min(${w}cqw, ${h}cqh)`
}

function face(card, deck, side) {
  const front = side === 'front'
  const big = front
    ? fit(card.romaji, [[6, 21, 26], [10, 12, 22], [12, 10, 18], [Infinity, 8.5, 14]])
    : fit(card.english, [[12, 11, 17], [30, 8, 12.5], [Infinity, 6.3, 9.5]])
  return `
    <div class="face themed ${front ? '' : 'back'} absolute inset-0 flex flex-col shadow-2xl" style="${themeVars(deck.index)}">
      ${art(card.id, 3)}
      <div class="head relative">
        ${
          front
            ? ''
            : `<span class="rule block h-px w-[7cqmin] shrink-0 bg-current opacity-50"></span>
               <div class="min-w-0">
                 <p class="title leading-[1.05] font-extrabold">${esc(card.romaji)}</p>
                 <p class="sub mt-[1.5cqmin] font-bold opacity-90">${esc(card.jp)}</p>
               </div>`
        }
      </div>
      <div class="relative my-auto w-full text-center">
        <p class="leading-[1.02] font-black break-words text-balance" style="${big}">${esc(front ? card.romaji : card.english)}</p>
        ${!front && card.note ? `<p class="sub mt-[3cqmin] font-semibold opacity-90 text-balance">${esc(card.note)}</p>` : ''}
      </div>
      <div class="art-space"></div>
    </div>`
}

function showCard(card) {
  current = card
  busy = false
  const deck = decks.find((d) => d.id === card.deck)

  app.querySelector('#slot').innerHTML = `
    <div class="card enter absolute inset-0 cursor-grab select-none active:cursor-grabbing">
      <div class="flip absolute inset-0">
        ${face(card, deck, 'front')}
        ${face(card, deck, 'back')}
      </div>
      <button data-speak aria-label="Hear the word" ${currentVoice() ? '' : 'hidden'} style="${themeVars(deck.index)}"
        class="speak absolute top-[6cqmin] right-[6cqmin] grid place-items-center rounded-full transition active:scale-90">
        <svg viewBox="0 0 24 24" class="size-1/2" fill="currentColor" aria-hidden="true">
          <path d="M3 9v6h4l5 4V5L7 9H3z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <div data-stamp="yes" class="pointer-events-none absolute top-[7cqmin] left-[7cqmin] rotate-6 rounded-full bg-white px-4 py-1.5 text-lg font-black tracking-wide text-emerald-600 opacity-0 shadow-lg">GOT IT</div>
      <div data-stamp="no" class="pointer-events-none absolute top-[7cqmin] left-[7cqmin] -rotate-6 rounded-full bg-white px-4 py-1.5 text-lg font-black tracking-wide text-rose-600 opacity-0 shadow-lg">AGAIN</div>
    </div>`

  attachGestures(app.querySelector('.card'))
  app.querySelector('[data-speak]').addEventListener('click', () => speak(card.jp))
  app.querySelector('#undo').disabled = !lastUndo
}

function setDrag(el, dx, dy) {
  el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`
  const strength = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1)
  el.querySelector('[data-stamp="yes"]').style.opacity = dx > 0 ? strength : 0
  el.querySelector('[data-stamp="no"]').style.opacity = dx < 0 ? strength : 0
}

function attachGestures(el) {
  let start = null

  el.addEventListener('pointerdown', (e) => {
    if (busy || e.target.closest('[data-speak]')) return // the speaker button is not a drag handle
    start = { x: e.clientX, y: e.clientY }
    el.classList.remove('enter')
    el.style.transition = 'none'
    el.setPointerCapture(e.pointerId)
  })

  el.addEventListener('pointermove', (e) => {
    if (!start || !isFlipped()) return // the card only moves once its meaning is showing
    setDrag(el, e.clientX - start.x, (e.clientY - start.y) * 0.4)
  })

  const end = (e) => {
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    start = null
    if (e.type === 'pointerup' && Math.hypot(dx, dy) < TAP_SLOP) {
      setDrag(el, 0, 0)
      flip()
    } else if (e.type === 'pointerup' && Math.abs(dx) > SWIPE_DISTANCE) {
      flyOut(dx > 0)
    } else {
      el.style.transition = 'transform 0.25s ease-out'
      setDrag(el, 0, 0)
    }
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

const isFlipped = () => !!app.querySelector('.flip.flipped')

function flip() {
  app.querySelector('.flip')?.classList.toggle('flipped')
}

function flyOut(known) {
  const el = app.querySelector('.card')
  if (!el || busy || !current || !isFlipped()) return
  busy = true
  const card = current
  const dir = known ? 1 : -1
  el.classList.remove('enter')
  el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in'
  setDrag(el, dir * window.innerWidth, 40)
  el.style.opacity = '0'

  setTimeout(() => {
    if (current !== card) return // left the study screen mid-animation
    lastUndo = swipe(queue, known)
    showCard(queue[0])
  }, 240)
}

function undoLast() {
  if (!lastUndo || busy) return
  undo(queue, lastUndo)
  lastUndo = null
  showCard(queue[0])
}

document.addEventListener('keydown', (e) => {
  if (!current) return
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    flip()
  } else if (e.key === 'ArrowRight') flyOut(true)
  else if (e.key === 'ArrowLeft') flyOut(false)
  else if (e.key === 's') speak(current.jp)
  else if (e.key === 'z' || e.key === 'Backspace') undoLast()
  else if (e.key === 'Escape') renderHome()
})

// Voices usually arrive a moment after page load.
onVoicesChanged(() => {
  if (!current) renderHome()
  else app.querySelector('[data-speak]')?.toggleAttribute('hidden', !currentVoice())
})

renderHome()
