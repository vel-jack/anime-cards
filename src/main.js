import { decks, groups } from './decks.js'
import { state, save, buildQueue, shuffle, swipe, undo, stats, reset } from './srs.js'
import { themeVars, art } from './themes.js'
import { japaneseVoices, currentVoice, setVoice, speak, onVoicesChanged } from './speech.js'

const app = document.querySelector('#app')
const SWIPE_DISTANCE = 90
const TAP_SLOP = 8
const MIN_WORD_PX = 12

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

let selected = new Set((state.selected ?? decks.map((d) => d.id)).filter((id) => decks.some((d) => d.id === id)))
const collapsed = new Set(state.collapsed ?? [])
let queue = []
// Sentence decks: the words of the sentence on top of the queue are shown first,
// shuffled. `warmup` holds the word cards still to go; `warmedUp` remembers which
// sentence has had its words, so the sentence card itself comes next.
let warmup = []
let warmedUp = null
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
        class="tile themed relative flex h-[23rem] w-full flex-col overflow-hidden rounded-[2rem] border-[5px] p-5 text-left transition
          ${on ? 'border-white shadow-xl' : 'border-transparent opacity-45 hover:opacity-70'}">
        ${art(d.id)}
        <span class="relative grid size-8 place-items-center rounded-full text-base font-black text-white" style="background:var(--dot)">${on ? '✓' : ''}</span>
        <span class="relative mt-4 block h-px w-6 bg-current opacity-50"></span>
        <h4 class="relative mt-3 max-w-[70%] text-2xl leading-[1.05] font-extrabold">${esc(d.title)}</h4>
        <p class="relative mt-2 max-w-[60%] text-xs leading-snug font-medium opacity-80">${esc(d.description)}</p>
        <span class="relative mt-auto block pt-6 text-xs font-bold tracking-wide">${d.kind === 'sentences' ? 'SENTENCES' : 'WORDS'}</span>
        <span class="relative block text-6xl leading-none font-black">${s.total}</span>
      </button>
      ${
        s.known + s.learning
          ? `<button data-reset="${d.id}" aria-label="Reset progress for ${esc(d.title)}" title="Reset progress" style="${themeVars(d.index)}"
              class="reset-btn absolute top-5 right-5 grid size-9 place-items-center rounded-full transition hover:rotate-[-45deg] active:scale-90 ${on ? '' : 'opacity-45'}">
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
              </svg>
            </button>`
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

const SUBGROUPS = [
  ['words', 'Words'],
  ['sentences', 'Sentences'],
]

// One kind of deck within a group, with its own select toggle. Only used when a
// group mixes word and sentence decks; otherwise its decks are listed directly.
function subgroup(g, kind, label) {
  const own = g.decks.filter((d) => d.kind === kind)
  if (!own.length) return ''
  const allOn = own.every((d) => selected.has(d.id))
  const key = `${g.id}|${kind}`
  const open = !collapsed.has(key)
  return `
    <div class="mt-6 flex items-center justify-between gap-4">
      <button data-fold="${key}" aria-expanded="${open}" class="flex min-w-0 flex-1 items-center gap-2.5 text-left text-white/70 hover:text-white">
        <span class="inline-block text-[0.6rem] transition-transform ${open ? 'rotate-90' : ''}">▶</span>
        <h3 class="text-sm font-extrabold tracking-[0.2em] uppercase">${label}</h3>
      </button>
      <button data-subgroup="${g.id}|${kind}" class="text-sm font-bold text-white/70 hover:text-white">
        ${allOn ? 'Select none' : 'Select all'}
      </button>
    </div>
    ${open ? `<ul class="mt-4 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${own.map(deckTile).join('')}</ul>` : ''}`
}

function studyLabel() {
  const chosen = decks.filter((d) => selected.has(d.id))
  const total = (kind) => chosen.filter((d) => d.kind === kind).reduce((n, d) => n + d.cards.length, 0)
  const parts = [
    [total('words'), 'words'],
    [total('sentences'), 'sentences'],
  ]
  return parts
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(' + ')
}

// The go-to-top button only shows once the deck list has been scrolled a fair way.
function toggleToTop() {
  app.querySelector('#to-top')?.toggleAttribute('hidden', window.scrollY < 400)
}

function renderHome() {
  current = null
  const chosenDecks = decks.filter((d) => selected.has(d.id))
  const count = chosenDecks.reduce((n, d) => n + d.cards.length, 0)
  const hasProgress = chosenDecks.some((d) => stats(d.cards).fresh < d.cards.length)

  app.innerHTML = `
    <main class="mx-auto flex min-h-full max-w-7xl flex-col px-4 pt-8 pb-32 sm:px-8">
      <header class="mb-2 flex items-end justify-between gap-4">
        <div>
          <span class="block size-9 rounded-full bg-[#ff5757]"></span>
          <span class="mt-4 block h-px w-6 bg-white/50"></span>
          <h1 class="mt-3 text-4xl leading-none font-extrabold sm:text-5xl">Romaji<br />Cards</h1>
        </div>
        <div class="flex items-center gap-3">
          ${
            groups.length > 1
              ? `<button id="select-everything" class="rounded-full border border-white/40 px-4 py-2 text-sm font-bold hover:bg-white/10">
                  ${decks.every((d) => selected.has(d.id)) ? 'Deselect all groups' : 'Select all groups'}
                </button>`
              : ''
          }
          <button id="reset-selected" aria-label="Reset progress for the selected decks" title="Reset progress for the selected decks" ${hasProgress ? '' : 'disabled'}
            class="grid size-10 place-items-center rounded-full border border-white/40 transition hover:rotate-[-45deg] hover:bg-white/10 active:scale-90 disabled:pointer-events-none disabled:opacity-30">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
            </svg>
          </button>
        </div>
      </header>

      ${groups
        .map((g) => {
          const allOn = g.decks.every((d) => selected.has(d.id))
          const open = !collapsed.has(g.id)
          const picked = g.decks.filter((d) => selected.has(d.id)).length
          return `
            <section class="mt-8">
              <div class="flex items-end justify-between gap-4 border-b border-white/20 pb-3">
                <button data-fold="${g.id}" aria-expanded="${open}" class="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span class="inline-block text-sm transition-transform ${open ? 'rotate-90' : ''}">▶</span>
                  <h2 class="truncate text-xl font-extrabold sm:text-2xl">${esc(g.title)}</h2>
                  <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${picked ? 'bg-white text-navy' : 'bg-white/15 text-white/70'}">${picked} / ${g.decks.length}</span>
                </button>
                <button data-group="${g.id}" class="text-sm font-bold text-white/70 hover:text-white">
                  ${allOn ? 'Select none' : 'Select all'}
                </button>
              </div>
              ${
                open
                  ? new Set(g.decks.map((d) => d.kind)).size > 1
                    ? SUBGROUPS.map(([kind, label]) => subgroup(g, kind, label)).join('')
                    : `<ul class="mt-5 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${g.decks.map(deckTile).join('')}</ul>`
                  : ''
              }
            </section>`
        })
        .join('')}

      ${voicePicker()}
    </main>

    <button id="to-top" aria-label="Go to top" hidden
      class="fixed right-4 bottom-24 z-10 grid size-12 place-items-center rounded-full bg-white text-xl font-black text-navy shadow-xl transition active:scale-90 sm:right-8">↑</button>

    <div class="fixed inset-x-0 bottom-0 bg-gradient-to-t from-navy via-navy to-transparent px-4 pt-10 pb-5">
      <button id="start" ${count ? '' : 'disabled'}
        class="mx-auto block w-full max-w-md rounded-full bg-white py-4 text-lg font-extrabold text-navy shadow-xl
          transition active:scale-[0.98] disabled:opacity-40">
        ${count ? `Study ${studyLabel()}` : 'Pick a deck'}
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
  app.querySelectorAll('[data-subgroup]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const [groupId, kind] = btn.dataset.subgroup.split('|')
      const ids = decks.filter((d) => d.group === groupId && d.kind === kind).map((d) => d.id)
      select(ids, !ids.every((id) => selected.has(id)))
    }),
  )
  app.querySelector('#select-everything')?.addEventListener('click', () => {
    const ids = decks.map((d) => d.id)
    select(ids, !ids.every((id) => selected.has(id)))
  })
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
  app.querySelector('#start').addEventListener('click', () => startStudy())
  app.querySelector('#to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
  toggleToTop()

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
    const all = chosen.length === decks.length
    if (chosen.length) confirmReset(all ? 'Forget all progress and start over?' : `Forget progress for the ${chosen.length} selected deck(s)?`, chosen)
  })
}

/* ---------- study ---------- */

function startStudy(fromHistory = false) {
  queue = buildQueue(decks.filter((d) => selected.has(d.id)).flatMap((d) => d.cards))
  if (!queue.length) return
  lastUndo = null
  warmup = []
  warmedUp = null

  app.innerHTML = `
    <main class="mx-auto flex h-full max-w-7xl flex-col px-5 pt-4 pb-4 sm:px-8">
      <header class="flex items-center justify-between gap-3 text-base font-bold">
        <button id="home" class="py-1 hover:underline">← Decks</button>
        <div id="steps" class="flex items-center gap-1.5"></div>
        <button id="undo" class="py-1 hover:underline disabled:opacity-30 disabled:hover:no-underline">Undo</button>
      </header>

      <section class="flex min-h-0 flex-1 items-center justify-center pb-5">
        <div class="stage relative">
          <div id="pile" class="absolute inset-0"></div>
          <div id="slot" class="absolute inset-0"></div>
        </div>
      </section>
    </main>`

  // Studying is its own history entry, so the browser or phone back action returns to the decks.
  if (!fromHistory) history.pushState({ study: true }, '')
  app.querySelector('#home').addEventListener('click', leaveStudy)
  app.querySelector('#undo').addEventListener('click', undoLast)
  showNext()
}

const wordCards = (sentence) =>
  sentence.words
    .filter((w) => !w.inBreakdownOnly)
    .map((w, i) => ({ id: `${sentence.id}#${i}`, deck: sentence.deck, romaji: w.romaji, jp: w.jp, english: w.english, note: '' }))

// A sentence that is new, or was missed last time, gets its words first. One
// that was understood last time comes back as the sentence alone.
function showNext() {
  const top = queue[0]
  if (!warmup.length && top.words && warmedUp !== top.id && !state.cards[top.id]?.known) {
    warmup = shuffle(wordCards(top))
    warmedUp = top.id
  }
  showCard(warmup[0] ?? top)
}

// One dot per word of the sentence being built up, then a bar for the sentence itself.
function renderSteps() {
  const sentence = queue[0]
  const inFlow = sentence.words && warmedUp === sentence.id
  const total = inFlow ? wordCards(sentence).length : 0
  const done = total - warmup.length
  const dot = (on, wide) => `<span class="h-1.5 ${wide ? 'w-5' : 'w-1.5'} rounded-full ${on ? 'bg-white' : 'bg-white/30'}"></span>`
  app.querySelector('#steps').innerHTML = inFlow
    ? Array.from({ length: total }, (_, i) => dot(i < done)).join('') + dot(!warmup.length, true)
    : ''
}

// Start each main word at its largest size, then shrink it until no word is
// cut off and everything fits on the card.
function fitWords() {
  const cardEl = app.querySelector('.card')
  const { clientWidth: w, clientHeight: h } = cardEl ?? {}
  if (!w || !h) return
  for (const el of cardEl.querySelectorAll('.word')) {
    const faceEl = el.closest('.face')
    const body = el.closest('.body')
    const head = faceEl.querySelector('.head')
    const [byWidth, byHeight] = el.dataset.max.split(',').map(Number)
    // The text is centred, so one margin keeps it clear of both the corner header and the speaker button.
    const speaker = cardEl.querySelector('[data-speak]:not([hidden])')
    const margin = Math.max(head.offsetTop + head.offsetHeight, speaker ? h - speaker.offsetTop : 0) + 4
    const tooTall = () => body.offsetTop < margin
    let size = Math.min(w * byWidth, h * byHeight)
    el.style.fontSize = `${size}px`
    while (size > MIN_WORD_PX && (el.scrollWidth > el.clientWidth + 1 || faceEl.scrollHeight > faceEl.clientHeight + 1 || tooTall())) {
      size *= 0.94
      el.style.fontSize = `${size}px`
    }
  }
}

// A whole sentence: romaji to read on the front; on the back the meaning, with
// a word-by-word breakdown underneath to check your reading against.
function sentenceFace(card, deck, side) {
  const front = side === 'front'
  const breakdown = card.words
    .map((w) => `<span class="inline-block px-[1.4cqmin]"><b class="font-extrabold">${esc(w.romaji)}</b> <span class="opacity-80">${esc(w.english)}</span></span>`)
    .join('')
  return `
    <div class="face themed ${front ? '' : 'back'} absolute inset-0 flex flex-col shadow-2xl" style="${themeVars(deck.index)}">
      <div class="head wide">
        <p class="sub leading-snug font-bold opacity-90">${esc(card.jp)}</p>
      </div>
      <div class="body relative my-auto w-full text-center">
        <p class="word leading-[1.08] font-black text-balance" data-max="${front ? '0.105,0.15' : '0.085,0.12'}">${esc(front ? card.romaji : card.english)}</p>
        ${front ? '' : `<p class="gloss mt-[4cqmin] font-medium text-balance">${breakdown}</p>`}
      </div>
    </div>`
}

function face(card, deck, side) {
  if (card.words) return sentenceFace(card, deck, side)
  const front = side === 'front'
  return `
    <div class="face themed ${front ? '' : 'back'} absolute inset-0 flex flex-col shadow-2xl" style="${themeVars(deck.index)}">
      <div class="head">
        ${
          front
            ? `<p class="title leading-[1.05] font-extrabold">${esc(card.jp)}</p>`
            : `<div class="min-w-0">
                 <p class="title leading-[1.05] font-extrabold">${esc(card.romaji)}</p>
                 <p class="sub mt-[1.5cqmin] font-bold opacity-90">${esc(card.jp)}</p>
               </div>`
        }
      </div>
      <div class="body relative my-auto w-full text-center">
        <p class="word leading-[1.02] font-black text-balance" data-max="${front ? '0.21,0.26' : '0.11,0.17'}">${esc(front ? card.romaji : card.english)}</p>
        ${!front && card.note ? `<p class="sub mt-[3cqmin] font-semibold opacity-90 text-balance">${esc(card.note)}</p>` : ''}
      </div>
    </div>`
}

function showCard(card) {
  current = card
  busy = false
  const deck = decks.find((d) => d.id === card.deck)

  // The next cards show as a stack underneath, in their own deck colours.
  const upcoming = [...warmup, ...queue].filter((c) => c !== card)
  app.querySelector('#pile').innerHTML = [3, 2, 1]
    .filter((depth) => upcoming[depth - 1])
    .map((depth) => {
      const under = decks.find((d) => d.id === upcoming[depth - 1].deck)
      return `<div class="pile-card themed" style="${themeVars(under.index)};--depth:${depth}"></div>`
    })
    .join('')

  app.querySelector('#slot').innerHTML = `
    <div class="card enter absolute inset-0 cursor-grab select-none active:cursor-grabbing">
      <div class="flip absolute inset-0">
        ${face(card, deck, 'front')}
        ${face(card, deck, 'back')}
      </div>
      <button data-speak aria-label="Hear the word" ${currentVoice() ? '' : 'hidden'} style="${themeVars(deck.index)}"
        class="speak absolute right-[6cqmin] bottom-[6cqmin] grid place-items-center rounded-full transition active:scale-90">
        <svg viewBox="0 0 24 24" class="size-1/2" fill="currentColor" aria-hidden="true">
          <path d="M3 9v6h4l5 4V5L7 9H3z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <div data-stamp="yes" class="pointer-events-none absolute top-[7cqmin] left-[7cqmin] rotate-6 rounded-full bg-white px-4 py-1.5 text-lg font-black tracking-wide text-emerald-600 opacity-0 shadow-lg">GOT IT</div>
      <div data-stamp="no" class="pointer-events-none absolute top-[7cqmin] left-[7cqmin] -rotate-6 rounded-full bg-white px-4 py-1.5 text-lg font-black tracking-wide text-rose-600 opacity-0 shadow-lg">AGAIN</div>
    </div>`

  fitWords()
  attachGestures(app.querySelector('.card'))
  app.querySelector('[data-speak]').addEventListener('click', () => speak(card.jp))
  app.querySelector('#undo').disabled = !lastUndo
  renderSteps()
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
  // Give supported phones a tiny tactile confirmation; desktop browsers ignore it.
  navigator.vibrate?.(known ? 12 : [8, 24, 8])
  const card = current
  const dir = known ? 1 : -1
  el.classList.remove('enter')
  el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in'
  setDrag(el, dir * window.innerWidth, 40)
  el.style.opacity = '0'

  setTimeout(() => {
    if (current !== card) return // left the study screen mid-animation
    if (warmup.length) {
      // A word of the sentence being built up: a miss goes back among the remaining words.
      lastUndo = { warmup: [...warmup] }
      warmup.shift()
      if (!known) warmup.splice(Math.min(warmup.length, 1 + Math.floor(Math.random() * warmup.length)), 0, card)
    } else {
      lastUndo = { ...swipe(queue, known), warmedUp }
      warmedUp = null
    }
    showNext()
  }, 240)
}

function leaveStudy() {
  if (history.state?.study) history.back()
  else renderHome()
}

function undoLast() {
  if (!lastUndo || busy) return
  if (lastUndo.warmup) {
    warmup = lastUndo.warmup
  } else {
    undo(queue, lastUndo)
    warmup = []
    warmedUp = lastUndo.warmedUp
  }
  lastUndo = null
  showCard(warmup[0] ?? queue[0])
}

document.addEventListener('keydown', (e) => {
  if (!current) return
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    flip()
  } else if (e.key === 'ArrowRight') flyOut(true)
  else if (e.key === 'ArrowLeft') flyOut(false)
  else if (e.key === 's') speak(current.jp)
  else if (e.key === 'z') undoLast()
  else if (e.key === 'Escape' || e.key === 'Backspace') leaveStudy()
})

window.addEventListener('scroll', toggleToTop, { passive: true })

window.addEventListener('popstate', () => {
  if (history.state?.study) startStudy(true)
  else renderHome()
})

// Card size follows the window, and text widths change once the web font loads.
window.addEventListener('resize', fitWords)
document.fonts?.ready.then(fitWords)

// Voices usually arrive a moment after page load.
onVoicesChanged(() => {
  if (!current) renderHome()
  else app.querySelector('[data-speak]')?.toggleAttribute('hidden', !currentVoice())
})

// A reload in the middle of a session keeps its history entry, so reopen the
// session; back then returns to the decks as usual.
if (history.state?.study) startStudy(true)
else renderHome()
