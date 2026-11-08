import { afterEach, describe, expect, it, vi } from 'vitest'
import { dropMissingEpisodes, estimateEpisodeCount, fetchAllEpisodes, sortEpisodes, type SpotifyEpisode } from './spotify'

const DAY = 24 * 60 * 60 * 1000

describe('estimateEpisodeCount', () => {
  it('starts from the known count and grows ~2.25 a week', () => {
    const known = Date.UTC(2026, 10, 8)
    expect(estimateEpisodeCount(known)).toBe(500)
    expect(estimateEpisodeCount(known + 28 * DAY)).toBe(509)
    expect(estimateEpisodeCount(known - 365 * DAY)).toBe(500)
  })
})

describe('fetchAllEpisodes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function stubFeed(total: number, nullAt: number[] = []) {
    const requested: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get('offset'))
        requested.push(offset)
        const items: Array<SpotifyEpisode | null> = []
        for (let i = offset; i < Math.min(offset + 50, total); i++) {
          if (nullAt.includes(i)) {
            items.push(null)
            continue
          }
          items.push({
            id: `e${i}`,
            name: `${i + 1}. Episode`,
            description: '',
            duration_ms: 1,
            release_date: new Date(Date.UTC(2022, 0, 1) + i * DAY).toISOString().slice(0, 10),
            images: [],
            resume_point: null,
          })
        }
        return new Response(JSON.stringify({ items, total, limit: 50, offset }))
      }),
    )
    return requested
  }

  it('requests every estimated page in one parallel round', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 8), toFake: ['Date'] })
    const requested = stubFeed(500)
    const episodes = await fetchAllEpisodes('show', 'token', () => {})
    expect(episodes).toHaveLength(500)
    expect(requested.sort((a, b) => a - b)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450])
  })

  it('tops up with a second round when the show outgrew the estimate', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 8), toFake: ['Date'] })
    const requested = stubFeed(600)
    const episodes = await fetchAllEpisodes('show', 'token', () => {})
    expect(episodes).toHaveLength(600)
    expect(episodes[0].id).toBe('e0')
    expect(requested.slice(-2).sort((a, b) => a - b)).toEqual([500, 550])
  })

  it('drops null items Spotify returns for unavailable episodes', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 8), toFake: ['Date'] })
    stubFeed(500, [3, 200])
    const episodes = await fetchAllEpisodes('show', 'token', () => {})
    expect(episodes).toHaveLength(498)
    expect(() => sortEpisodes(episodes)).not.toThrow()
  })
})

describe('dropMissingEpisodes', () => {
  it('removes null/undefined entries, e.g. from caches written before the fix', () => {
    const ep = { id: 'a', name: '1. A', release_date: '2020-01-01' } as SpotifyEpisode
    expect(dropMissingEpisodes([null, ep, undefined, ep])).toEqual([ep, ep])
  })
})
