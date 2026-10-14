import { EPISODE_NUMBER_RE, episodeNumber, type SpotifyEpisode } from './spotify'

export interface ArcEpisode {
  episode: SpotifyEpisode
  /** Index into the oldest → newest episodes array */
  index: number
  /** The "N." prefix from the title; null for unnumbered bonus / Empire Club episodes */
  number: number | null
}

export interface Arc {
  /** Stable across refreshes: derived from the first numbered episode's Spotify ID */
  id: string
  title: string
  /** Oldest → newest, bonus episodes interleaved where they were released */
  episodes: ArcEpisode[]
  firstNumber: number | null
  lastNumber: number | null
}

/**
 * Arcs for the back catalogue, by episode number. Titles in the early seasons
 * don't mark arcs at all, so these are hand-curated from the feed. Episodes
 * after the last curated number fall through to detectArcs().
 */
const CURATED_ARCS: Array<{ title: string; ranges: Array<[number, number]> }> = [
  { title: 'The British Raj', ranges: [[1, 7]] },
  { title: 'The Koh-i-Noor', ranges: [[8, 11]] },
  { title: 'The Road to Indian Independence', ranges: [[12, 18]] },
  { title: 'Listener Questions: India', ranges: [[19, 20]] },
  { title: 'The Ottoman Empire', ranges: [[21, 43]] },
  { title: 'Listener Questions: The Ottomans', ranges: [[44, 45]] },
  { title: 'Rebels: The Mau Mau & the Raj', ranges: [[46, 47]] },
  { title: 'The History of Slavery', ranges: [[48, 69]] },
  { title: 'Listener Questions: Slavery', ranges: [[70, 71]] },
  { title: 'The Russian Empire & the Great Game', ranges: [[72, 95]] },
  { title: 'Ancient Persia', ranges: [[96, 106]] },
  { title: 'Explorers: Zheng He, Cook & Antarctica', ranges: [[107, 111]] },
  { title: 'Iran: From Ferdowsi to the Houthis', ranges: [[112, 125]] },
  { title: 'Food of the Raj', ranges: [[126, 127]] },
  { title: 'Buddhism', ranges: [[128, 132]] },
  { title: 'Empresses & Queens', ranges: [[133, 147]] },
  { title: 'The American Empire', ranges: [[148, 169]] },
  { title: 'The Bengal Famine', ranges: [[170, 171]] },
  { title: "America's Cold War: Korea, Cuba & Vietnam", ranges: [[172, 178]] },
  { title: 'The Golden Road', ranges: [[179, 185]] },
  { title: 'Scotland & Empire', ranges: [[186, 192]] },
  { title: 'Empire of Numbers', ranges: [[193, 194]] },
  { title: 'Pirates', ranges: [[195, 203]] },
  { title: 'The Mughals', ranges: [[204, 211], [215, 222]] },
  { title: 'The Three Wise Men', ranges: [[212, 214]] },
  { title: 'Empire of Plants', ranges: [[223, 224]] },
  { title: 'Painting the Empire', ranges: [[225, 226]] },
  { title: 'The Man Who Lived A Thousand Lives', ranges: [[227, 228]] },
  { title: "Britain's Last Colony", ranges: [[229, 230]] },
  { title: 'Ireland', ranges: [[231, 246]] },
  { title: 'Victorian Narcos', ranges: [[247, 255]] },
  { title: 'Yalta & the Division of Europe', ranges: [[256, 262]] },
  { title: 'Greenland', ranges: [[263, 266]] },
  { title: 'Colonising Canada', ranges: [[267, 271]] },
  { title: "America's Lost Colony", ranges: [[272, 272]] },
  { title: 'Panama', ranges: [[273, 277]] },
  { title: 'Partition', ranges: [[278, 283]] },
  { title: 'The Suez Crisis', ranges: [[284, 288]] },
  { title: 'The Cholas', ranges: [[289, 290]] },
  { title: 'Gaza', ranges: [[291, 301]] },
  { title: 'Orwell', ranges: [[302, 305]] },
  { title: 'Empire on the Page: Conrad, Austen, Asterix & Tintin', ranges: [[306, 309]] },
  { title: 'Cricket', ranges: [[310, 311]] },
  { title: 'Kipling & Naipaul', ranges: [[312, 315]] },
  { title: 'Photographers of Empire', ranges: [[316, 317], [320, 321]] },
  { title: 'Heist of St Nicolas', ranges: [[318, 319]] },
  { title: 'Indian Uprising 1857', ranges: [[322, 329]] },
  { title: 'The Iranian Revolution: 1979 vs 2026', ranges: [[330, 331]] },
  { title: 'Bronze Age Apocalypse', ranges: [[332, 337]] },
  { title: 'Chairman Mao', ranges: [[338, 341], [344, 345]] },
  { title: 'Iran & Lebanon', ranges: [[342, 343]] },
  { title: 'The Arab-Israeli Wars', ranges: [[346, 353]] },
  { title: 'Liberator of Latin America: Simón Bolívar', ranges: [[354, 357]] },
  { title: 'Spice Wars', ranges: [[358, 360]] },
  { title: 'Louis Theroux', ranges: [[361, 361]] },
  { title: 'Ancient Egypt', ranges: [[362, 368]] },
  { title: 'The First British Indians', ranges: [[369, 372]] },
  { title: 'America at 250', ranges: [[373, 374]] },
  { title: 'Algerian Revolution', ranges: [[375, 380]] },
  { title: 'Empires of Tech', ranges: [[381, 382]] },
  { title: 'Invaders of Britain: Romans, Celts & Vikings', ranges: [[383, 388]] },
  { title: 'Road to 9/11', ranges: [[389, 394]] },
  { title: 'Stalin', ranges: [[395, 400]] },
]

const curatedByNumber = new Map<number, number>()
CURATED_ARCS.forEach((arc, arcIdx) => {
  for (const [first, last] of arc.ranges) {
    for (let n = first; n <= last; n++) curatedByNumber.set(n, arcIdx)
  }
})

const PART_RE = /\s*\((?:Part|Ep)\s*(\d+)\)\s*$/i

/** Title without the "N." prefix or the "(Part n)" suffix */
function bareTitle(title: string): string {
  return title.replace(EPISODE_NUMBER_RE, '').replace(PART_RE, '').trim()
}

function partNumber(title: string): number | null {
  const m = title.match(PART_RE)
  return m ? Number(m[1]) : null
}

/** "Road To 9/11: Origin of Al-Qaeda" → "Road To 9/11" */
function seriesPrefix(title: string): string | null {
  const bare = bareTitle(title)
  const colon = bare.indexOf(':')
  return colon > 0 ? bare.slice(0, colon).trim() : null
}

/**
 * Groups uncurated numbered episodes: consecutive episodes continue an arc if
 * they share a "Series:" prefix or their (Part n) markers run on sequentially.
 */
function detectArcs(items: ArcEpisode[]): Array<{ title: string; items: ArcEpisode[] }> {
  const arcs: Array<{ title: string; items: ArcEpisode[]; prefix: string | null }> = []
  for (const item of items) {
    const name = item.episode.name
    const prefix = seriesPrefix(name)
    const part = partNumber(name)
    const current = arcs[arcs.length - 1]
    const prev = current?.items[current.items.length - 1]

    const continues =
      current &&
      prev &&
      prev.number !== null &&
      item.number === prev.number + 1 &&
      ((prefix !== null && prefix.toLowerCase() === current.prefix?.toLowerCase()) ||
        (part !== null && part > 1 && partNumber(prev.episode.name) === part - 1))

    if (continues) {
      current.items.push(item)
    } else {
      arcs.push({ title: prefix ?? bareTitle(name), items: [item], prefix })
    }
  }
  return arcs
}

/**
 * episodes must be sorted oldest → newest. Returns arcs oldest → newest,
 * ordered by their first episode.
 */
export function groupIntoArcs(episodes: SpotifyEpisode[]): Arc[] {
  const items: ArcEpisode[] = episodes.map((episode, index) => ({
    episode,
    index,
    number: episodeNumber(episode.name),
  }))

  // Phase 1: numbered episodes → arcs (curated, then auto-detected)
  const curatedGroups = new Map<number, ArcEpisode[]>()
  const uncurated: ArcEpisode[] = []
  for (const item of items) {
    if (item.number === null) continue
    const arcIdx = curatedByNumber.get(item.number)
    if (arcIdx === undefined) {
      uncurated.push(item)
    } else {
      if (!curatedGroups.has(arcIdx)) curatedGroups.set(arcIdx, [])
      curatedGroups.get(arcIdx)!.push(item)
    }
  }

  const groups: Array<{ title: string; items: ArcEpisode[] }> = [
    ...[...curatedGroups.entries()].map(([arcIdx, arcItems]) => ({
      title: CURATED_ARCS[arcIdx].title,
      items: arcItems,
    })),
    ...detectArcs(uncurated),
  ]

  const arcOfIndex = new Map<number, number>()
  groups.forEach((g, groupIdx) => g.items.forEach(item => arcOfIndex.set(item.index, groupIdx)))

  // Phase 2: unnumbered (bonus / Empire Club) episodes join the arc they were
  // released in the middle of; at an arc boundary they join the preceding arc.
  const bonus = items.filter(item => item.number === null)
  const orphans: ArcEpisode[] = []
  for (const item of bonus) {
    let prevArc: number | undefined
    for (let i = item.index - 1; i >= 0 && prevArc === undefined; i--) prevArc = arcOfIndex.get(i)
    let nextArc: number | undefined
    for (let i = item.index + 1; i < items.length && nextArc === undefined; i++) nextArc = arcOfIndex.get(i)

    const target = prevArc ?? nextArc
    if (target === undefined) orphans.push(item)
    else groups[target].items.push(item)
  }
  if (orphans.length) groups.push({ title: 'Episodes', items: orphans })

  return groups
    .map(g => {
      const sorted = [...g.items].sort((a, b) => a.index - b.index)
      const numbered = sorted.filter(item => item.number !== null)
      const anchor = numbered[0] ?? sorted[0]
      return {
        id: `arc-${anchor.episode.id}`,
        title: g.title,
        episodes: sorted,
        firstNumber: numbered[0]?.number ?? null,
        lastNumber: numbered[numbered.length - 1]?.number ?? null,
      }
    })
    .sort((a, b) => a.episodes[0].index - b.episodes[0].index)
}

/**
 * Lowercases and strips accents per character, keeping the string's length so
 * indices into the folded text line up with the original.
 */
function fold(text: string): string {
  let out = ''
  for (const c of text) {
    const folded = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    out += folded.length === c.length ? folded : c
  }
  return out
}

// Descriptions run to a couple of KB each; fold them once, not per keystroke
const foldedDescriptions = new WeakMap<SpotifyEpisode, string>()

function foldedDescription(episode: SpotifyEpisode): string {
  let folded = foldedDescriptions.get(episode)
  if (folded === undefined) {
    folded = fold(episode.description ?? '')
    foldedDescriptions.set(episode, folded)
  }
  return folded
}

export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

export interface ArcSearchResult {
  arc: Arc
  /** The arc's episodes that match; all of them when the arc title matches */
  episodes: ArcEpisode[]
}

/**
 * Filters arcs by search terms (from searchTerms). An arc whose title matches
 * keeps all its episodes; otherwise it keeps only the episodes whose titles or
 * descriptions match. Terms may be split across the arc title and the episode.
 */
export function searchArcs(arcs: Arc[], terms: string[]): ArcSearchResult[] {
  if (terms.length === 0) return arcs.map(arc => ({ arc, episodes: arc.episodes }))

  const result: ArcSearchResult[] = []
  for (const arc of arcs) {
    const arcTitle = fold(arc.title)
    if (terms.every(t => arcTitle.includes(t))) {
      result.push({ arc, episodes: arc.episodes })
      continue
    }
    const episodes = arc.episodes.filter(({ episode }) => {
      const title = fold(episode.name)
      return terms.every(t => arcTitle.includes(t) || title.includes(t) || foldedDescription(episode).includes(t))
    })
    if (episodes.length) result.push({ arc, episodes })
  }
  return result
}

/**
 * When a search term appears in an episode's description but not its title,
 * returns the part of the description around the first such match.
 */
export function descriptionMatch(episode: SpotifyEpisode, terms: string[]) {
  const text = episode.description ?? ''
  const title = fold(episode.name)
  for (const term of terms) {
    if (title.includes(term)) continue
    const at = foldedDescription(episode).indexOf(term)
    if (at === -1) continue
    const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, at - 40)) + 1)
    return {
      before: (start > 0 ? '…' : '') + text.slice(start, at),
      match: text.slice(at, at + term.length),
      after: text.slice(at + term.length, at + term.length + 160),
    }
  }
  return null
}
