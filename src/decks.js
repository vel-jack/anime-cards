// Every folder in ./decks is a group (one anime / movie), and every .txt file
// inside it is a deck. The first "# Title | description" line names the deck;
// other # lines are comments. The group's name comes from its folder:
// "black-clover" -> "Black Clover".
//
// Word deck, one card per line:
//   romaji | japanese | english | optional note
//
// Sentence deck, a "> " line followed by the words it is made of, in order:
//   > romaji sentence | japanese | english
//   word | japanese | meaning
//   ~particle | japanese | meaning     (~ = breakdown only, no card of its own)
const files = import.meta.glob('./decks/*/*.txt', { query: '?raw', import: 'default', eager: true })

const titleCase = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function parseWords(id, rows) {
  return rows
    .filter((p) => p.length >= 3)
    .map(([romaji, jp, english, note = '']) => ({ id: `${id}:${romaji}:${jp}`, deck: id, romaji, jp, english, note }))
}

function parseSentences(id, rows) {
  const sentences = []
  for (const row of rows) {
    if (row[0].startsWith('>')) {
      const [romaji, jp = '', english = ''] = [row[0].replace(/^>\s*/, ''), ...row.slice(1)]
      sentences.push({ id: `${id}:${romaji}`, deck: id, romaji, jp, english, note: '', words: [] })
    } else if (sentences.length && row.length >= 3) {
      const [romaji, jp, english] = row
      const inBreakdownOnly = romaji.startsWith('~')
      sentences.at(-1).words.push({ romaji: romaji.replace(/^~\s*/, ''), jp, english, inBreakdownOnly })
    }
  }
  return sentences
}

export const decks = Object.keys(files)
  .sort()
  .map((path, index) => {
    const [group, file] = path.split('/').slice(-2)
    const id = `${group}/${file.replace(/\.txt$/, '')}`
    const lines = files[path].split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const header = lines.find((l) => l.startsWith('#')) ?? `# ${id}`
    const [title, description = ''] = header.replace(/^#\s*/, '').split('|').map((s) => s.trim())
    const rows = lines.filter((l) => !l.startsWith('#')).map((l) => l.split('|').map((s) => s.trim()))
    const kind = rows.some((r) => r[0].startsWith('>')) ? 'sentences' : 'words'
    const cards = kind === 'sentences' ? parseSentences(id, rows) : parseWords(id, rows)
    return { id, group, groupTitle: titleCase(group), title, description, kind, cards, index }
  })

export const groups = [...new Set(decks.map((d) => d.group))].map((id) => {
  const own = decks.filter((d) => d.group === id)
  return { id, title: own[0].groupTitle, decks: own }
})
