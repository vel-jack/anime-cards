// The study pile is an endless queue: the top card is shown, then put back.
//   swipe right -> goes to the bottom of the pile
//   swipe left  -> slipped back in at a random spot a few cards down
// What is saved per card is only how it was last swiped and when, which is
// enough to rebuild the pile in the same spirit on the next visit.
const KEY = 'anime-cards:v2'
const MIN_GAP = 2 // a missed card never comes straight back
const MAX_GAP = 10 // ...but is never buried deeper than this

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

// New cards first, then known ones (longest unseen first), with missed ones mixed in near the top.
export function buildQueue(pool) {
  const seenAt = (c) => state.cards[c.id].seen
  const fresh = pool.filter((c) => !state.cards[c.id])
  const known = pool.filter((c) => state.cards[c.id]?.known).sort((a, b) => seenAt(a) - seenAt(b))
  const missed = pool.filter((c) => state.cards[c.id]?.known === false)
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
