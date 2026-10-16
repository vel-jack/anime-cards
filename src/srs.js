// The study pile is an endless queue: the top card is shown, then put back.
//   swipe right -> goes to the bottom of the pile
//   swipe left  -> slipped back in at a random spot a few cards down
// What is saved per card is only how it was last swiped, which is enough to
// rebuild the pile in the same spirit (in a new shuffled order) next time.
const KEY = 'anime-cards:v2'
const MIN_GAP = 5 // a missed card gets a little breathing room
const MAX_GAP = 15 // ...but is still reviewed within the next handful of cards

function load() {
  try {
    return { turn: 0, cards: {}, selected: null, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { turn: 0, cards: {}, selected: null }
  }
}

export const state = load()

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode): progress just lasts for this visit
  }
}

function insertRandomly(queue, card) {
  const lo = Math.min(MIN_GAP, queue.length)
  const hi = Math.min(MAX_GAP, queue.length)
  queue.splice(lo + Math.floor(Math.random() * (hi - lo + 1)), 0, card)
}

export function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// A fresh order every session: new cards first, then known ones, each group
// shuffled, with missed ones mixed in near the top.
export function buildQueue(pool) {
  const fresh = shuffle(pool.filter((c) => !state.cards[c.id]))
  const known = shuffle(pool.filter((c) => state.cards[c.id]?.known))
  const missed = shuffle(pool.filter((c) => state.cards[c.id]?.known === false))
  const queue = [...fresh, ...known]
  for (const c of missed) insertRandomly(queue, c)
  return queue
}

// Grades the top card of the queue and puts it back.
export function swipe(queue, known) {
  const card = queue[0]
  const prev = state.cards[card.id]
  const snapshot = { id: card.id, prev: prev ? { ...prev } : null, turn: state.turn, queue: [...queue] }
  queue.shift()
  if (known) queue.push(card)
  else insertRandomly(queue, card)
  state.turn += 1
  state.cards[card.id] = { known, seen: state.turn }
  save()
  return snapshot
}

export function undo(queue, snapshot) {
  if (snapshot.prev) state.cards[snapshot.id] = snapshot.prev
  else delete state.cards[snapshot.id]
  state.turn = snapshot.turn
  queue.splice(0, queue.length, ...snapshot.queue)
  save()
}

export function stats(cards) {
  let learning = 0
  let known = 0
  for (const c of cards) {
    const s = state.cards[c.id]
    if (!s) continue
    if (s.known) known += 1
    else learning += 1
  }
  return { total: cards.length, learning, known, fresh: cards.length - learning - known }
}

export function reset(cards) {
  for (const c of cards) delete state.cards[c.id]
  save()
}
