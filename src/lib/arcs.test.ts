import { describe, expect, it } from 'vitest'
import { groupIntoArcs, searchArcs as searchArcsByTerms, searchTerms, type Arc } from './arcs'
import { episodeNumber, sortEpisodes, type SpotifyEpisode } from './spotify'

// Arcs left after filtering, each holding only its matching episodes
const searchArcs = (arcs: Arc[], query: string) =>
  searchArcsByTerms(arcs, searchTerms(query)).map(({ arc, episodes }) => ({ ...arc, episodes }))

function ep(name: string, i: number): SpotifyEpisode {
  return {
    id: `id${i}`,
    name,
    description: '',
    duration_ms: 3_600_000,
    release_date: new Date(Date.UTC(2030, 0, 1 + i)).toISOString().slice(0, 10),
    images: [],
    resume_point: null,
  }
}

const eps = (names: string[]) => names.map((name, i) => ep(name, i))
const titles = (names: string[]) => groupIntoArcs(eps(names)).map(arc => arc.title)
const sizes = (names: string[]) => groupIntoArcs(eps(names)).map(arc => arc.episodes.length)

describe('episodeNumber', () => {
  it('parses the leading number with or without a space', () => {
    expect(episodeNumber('21. The Ottoman Empire')).toBe(21)
    expect(episodeNumber('  338.Chairman Mao: Birth of A Dictator (Ep 1)')).toBe(338)
    expect(episodeNumber('Welcome to the Empire Club')).toBeNull()
  })
})

describe('groupIntoArcs', () => {
  it('uses curated arcs for the back catalogue, including split ranges', () => {
    const arcs = groupIntoArcs(
      eps([
        '211. A Beautiful World: The Art of Akbar',
        '212. Who Were The Three Wise Men?',
        '214. The Empire of Frankincense & Myrrh',
        '215. Jahangir: A World of Light And Darkness',
      ]),
    )
    expect(arcs.map(a => [a.title, a.episodes.length])).toEqual([
      ['The Mughals', 2],
      ['The Three Wise Men', 2],
    ])
  })

  it('auto-detects new arcs by shared prefix and by sequential parts', () => {
    expect(
      titles([
        '9001. Foo Wars: Beginnings (Part 1)',
        '9002. Foo Wars: Endings (Part 2)',
        '9003. Something Else Entirely (Part 1)',
        '9004. Different Prefix: Sequel (Part 2)',
        '9005. A One-Off',
      ]),
    ).toEqual(['Foo Wars', 'Something Else Entirely', 'A One-Off'])
  })

  it('puts bonus episodes inside the arc they interrupt, or the preceding arc at a boundary', () => {
    const names = [
      'Trailer',
      '1. The East India Company',
      'Club Extra',
      '2. Company Rule in India',
      '7. Mahatma Gandhi',
      'Boundary Bonus',
      '8. The Koh-i-Noor Diamond',
    ]
    const arcs = groupIntoArcs(eps(names))
    expect(arcs.map(a => a.episodes.map(e => e.episode.name))).toEqual([
      ['Trailer', '1. The East India Company', 'Club Extra', '2. Company Rule in India', '7. Mahatma Gandhi', 'Boundary Bonus'],
      ['8. The Koh-i-Noor Diamond'],
    ])
    expect(arcs[0].firstNumber).toBe(1)
    expect(arcs[0].lastNumber).toBe(7)
  })

  it('keeps an arc together when release dates are out of step with the numbering', () => {
    const dated = (name: string, date: string, i: number) => ({ ...ep(name, i), release_date: date })
    // Spotify returns newest-first; 404–406 are dated before 403
    const feed = [
      dated('Your Questions: St George', '2026-10-12', 0),
      dated('406. The Norman Conquests: The First Crusade (Part 6)', '2026-10-10', 1),
      dated('405. The Norman Conquests: Medieval Mafia (Part 5)', '2026-10-10', 2),
      dated('404. The Norman Conquests: Colonising Ireland (Part 4)', '2026-10-10', 3),
      dated('403. The Norman Conquests: The Battle of Hastings (Part 3)', '2026-10-11', 4),
      dated('402. The Norman Conquests: The Real Story of 1066 (Part 2)', '2026-10-07', 5),
      dated('401. The Norman Conquests: Secrets of the Bayeux Tapestry (Part 1)', '2026-10-04', 6),
    ]
    const sorted = sortEpisodes(feed)
    expect(sorted.map(e => e.name.slice(0, 4))).toEqual(['401.', '402.', '403.', '404.', '405.', '406.', 'Your'])
    const arcs = groupIntoArcs(sorted)
    expect(arcs.map(a => [a.title, a.episodes.length])).toEqual([['The Norman Conquests', 7]])
  })

  it('derives a stable id from the first numbered episode', () => {
    const arcs = groupIntoArcs(eps(['Trailer', '1. The East India Company']))
    expect(arcs[0].id).toBe('arc-id1')
  })

  it('handles a feed with no numbered episodes', () => {
    expect(sizes(['A', 'B'])).toEqual([2])
  })
})

describe('searchArcs', () => {
  const arcs = groupIntoArcs(
    eps(['21. The Ottoman Empire', '24. The Fall of Constantinople', '28. The Battle of Lepanto', '204. Babur: The First Mughal Emperor']),
  )

  it('keeps every episode of an arc whose title matches', () => {
    const result = searchArcs(arcs, 'ottoman')
    expect(result.map(a => a.episodes.length)).toEqual([3])
  })

  it('keeps only matching episodes otherwise, ignoring case and accents', () => {
    const result = searchArcs(arcs, 'LÉPANTO')
    expect(result.map(a => a.episodes.map(e => e.episode.name))).toEqual([['28. The Battle of Lepanto']])
  })

  it('matches terms across arc title and episode title', () => {
    expect(searchArcs(arcs, 'mughals babur')[0].episodes).toHaveLength(1)
  })

  it('matches episode descriptions', () => {
    const withDescription = groupIntoArcs([
      { ...ep('28. The Battle of Lepanto', 0), description: 'Don John of Austria and the Holy League' },
    ])
    expect(searchArcs(withDescription, 'holy league')[0].episodes).toHaveLength(1)
    expect(searchArcs(withDescription, 'holy grail')).toHaveLength(0)
  })

  it('returns everything for a blank query', () => {
    expect(searchArcs(arcs, '  ')).toEqual(arcs)
  })
})
