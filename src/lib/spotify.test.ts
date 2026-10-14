import { afterEach, describe, expect, it, vi } from 'vitest'
import { estimateEpisodeCount, fetchAllEpisodes, type SpotifyEpisode } from './spotify'

const DAY = 24 * 60 * 60 * 1000

describe('estimateEpisodeCount', () => {
  it('starts from the known count and grows ~2.25 a week', () => {
    const known = Date.UTC(2026, 9, 11)
    expect(estimateEpisodeCount(known)).toBe(416)
    expect(estimateEpisodeCount(known + 28 * DAY)).toBe(425)
    expect(estimateEpisodeCount(known - 365 * DAY)).toBe(416)
  })
})

describe('fetchAllEpisodes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function stubFeed(total: number) {
    const requested: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get('offset'))
        requested.push(offset)
        const items: SpotifyEpisode[] = []
        for (let i = offset; i < Math.min(offset + 50, total); i++) {
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
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 11), toFake: ['Date'] })
    const requested = stubFeed(416)
    const episodes = await fetchAllEpisodes('show', 'token', () => {})
    expect(episodes).toHaveLength(416)
    expect(requested.sort((a, b) => a - b)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400])
  })

  it('tops up with a second round when the show outgrew the estimate', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 11), toFake: ['Date'] })
    const requested = stubFeed(520)
    const episodes = await fetchAllEpisodes('show', 'token', () => {})
    expect(episodes).toHaveLength(520)
    expect(episodes[0].id).toBe('e0')
    expect(requested.slice(-2).sort((a, b) => a - b)).toEqual([450, 500])
  })
})
