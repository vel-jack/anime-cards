// Every folder in ./decks is a group (one anime / movie), and every .txt file
// inside it is a deck. Line format:
//   romaji | japanese | english | optional note
// The first "# Title | description" line names the deck; other # lines are comments.
// The group's name comes from its folder: "black-clover" -> "Black Clover".
const files = import.meta.glob('./decks/*/*.txt', { query: '?raw', import: 'default', eager: true })

const titleCase = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const decks = Object.keys(files)
  .sort()
  .map((path, index) => {
    const [group, file] = path.split('/').slice(-2)
    const id = `${group}/${file.replace(/\.txt$/, '')}`
    const lines = files[path].split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const header = lines.find((l) => l.startsWith('#')) ?? `# ${id}`
    const [title, description = ''] = header.replace(/^#\s*/, '').split('|').map((s) => s.trim())
    const cards = lines
      .filter((l) => !l.startsWith('#'))
      .map((l) => l.split('|').map((s) => s.trim()))
      .filter((p) => p.length >= 3)
      .map(([romaji, jp, english, note = '']) => ({
        id: `${id}:${romaji}:${jp}`,
        deck: id,
        romaji,
        jp,
        english,
        note,
      }))
    return { id, group, groupTitle: titleCase(group), title, description, cards, index }
  })

export const groups = [...new Set(decks.map((d) => d.group))].map((id) => {
  const own = decks.filter((d) => d.group === id)
  return { id, title: own[0].groupTitle, decks: own }
})
