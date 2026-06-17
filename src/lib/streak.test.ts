import { describe, expect, it } from 'vitest'
import { findNextEpisode } from './streak'
import type { SpotifyEpisode } from './spotify'

function ep(
  id: string,
  duration_ms: number,
  resumeOptions: { fully_played?: boolean; resume_position_ms?: number } | null = null,
): SpotifyEpisode {
  return {
    id,
    name: id,
    description: '',
    duration_ms,
    release_date: '2024-01-01',
    images: [],
    resume_point: resumeOptions
      ? { fully_played: resumeOptions.fully_played ?? false, resume_position_ms: resumeOptions.resume_position_ms ?? 0 }
      : null,
  }
}

const HOUR = 3_600_000

describe('findNextEpisode', () => {
  it('returns the first episode when nothing has been played', () => {
    const episodes = [ep('a', HOUR), ep('b', HOUR), ep('c', HOUR)]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('a')
    expect(result?.resumeMs).toBe(0)
  })

  it('returns null when all episodes are fully played', () => {
    const episodes = [
      ep('a', HOUR, { fully_played: true }),
      ep('b', HOUR, { fully_played: true }),
    ]
    expect(findNextEpisode(episodes)).toBeNull()
  })

  it('returns the first unplayed episode after a fully played one', () => {
    const episodes = [
      ep('a', HOUR, { fully_played: true }),
      ep('b', HOUR, { fully_played: true }),
      ep('c', HOUR),
      ep('d', HOUR),
    ]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('c')
    expect(result?.resumeMs).toBe(0)
  })

  it('resumes from the saved position of the next episode if it was started', () => {
    const episodes = [
      ep('a', HOUR, { fully_played: true }),
      ep('b', HOUR, { resume_position_ms: 600_000 }), // 600s in, not done
    ]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('b')
    expect(result?.resumeMs).toBe(600_000)
  })

  it('treats >90% as played when all subsequent episodes are fully played', () => {
    const episodes = [
      ep('a', HOUR, { resume_position_ms: HOUR * 0.95 }), // 95%
      ep('b', HOUR, { fully_played: true }),
      ep('c', HOUR, { fully_played: true }),
      ep('d', HOUR),
    ]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('d')
  })

  it('does NOT treat >90% as played when subsequent are not played (frontier episode)', () => {
    const episodes = [
      ep('a', HOUR, { fully_played: true }),
      ep('b', HOUR, { resume_position_ms: HOUR * 0.95 }), // frontier at 95%
      ep('c', HOUR),
    ]
    const result = findNextEpisode(episodes)
    // b is the frontier — return b itself, not c
    expect(result?.episode.id).toBe('b')
    expect(result?.resumeMs).toBe(HOUR * 0.95)
  })

  it('treats >90% as played when the next episode has been meaningfully started (>5%)', () => {
    // Real-world case: ep27 at 95.1%, ep28 at 89.9%, ep29 unstarted
    // ep27 should count as played because ep28 is started
    const episodes = [
      ep('ep26', HOUR, { fully_played: true }),
      ep('ep27', HOUR, { resume_position_ms: HOUR * 0.951 }), // 95.1%
      ep('ep28', HOUR, { resume_position_ms: HOUR * 0.899 }), // 89.9% — started but <90%
      ep('ep29', HOUR),
    ]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('ep28')
    expect(result?.resumeMs).toBe(HOUR * 0.899)
  })

  it('ignores an isolated fully-played bonus episode far ahead of the streak', () => {
    // Real-world case: bonus episode at idx 430 fully played, but the actual
    // streak ended at idx 26. The bonus should not become the anchor.
    const episodes = [
      ep('e1', HOUR, { fully_played: true }),
      ep('e2', HOUR, { fully_played: true }),
      ep('e3', HOUR, { resume_position_ms: HOUR * 0.95 }), // frontier at 95%
      ep('e4', HOUR),
      ...Array.from({ length: 50 }, (_, i) => ep(`skip${i}`, HOUR)), // big gap of unplayed
      ep('bonus', HOUR, { fully_played: true }), // isolated listen
      ep('after-bonus', HOUR),
    ]
    const result = findNextEpisode(episodes)
    // Should pick up where the real streak stopped (e3/e4), not after the bonus
    expect(result?.episode.id).toBe('e3')
  })

  it('returns null for an empty episode list', () => {
    expect(findNextEpisode([])).toBeNull()
  })

  it('handles a single unplayed episode', () => {
    const result = findNextEpisode([ep('only', HOUR)])
    expect(result?.episode.id).toBe('only')
  })

  it('handles a single fully played episode', () => {
    expect(findNextEpisode([ep('only', HOUR, { fully_played: true })])).toBeNull()
  })

  it('does not treat a barely-started next episode (<5%) as meaningful start', () => {
    // ep-a at 95%, ep-b at 1% (just tapped in Spotify) → ep-a is still frontier
    const episodes = [
      ep('prev', HOUR, { fully_played: true }),
      ep('ep-a', HOUR, { resume_position_ms: HOUR * 0.95 }),
      ep('ep-b', HOUR, { resume_position_ms: HOUR * 0.01 }), // 1%, barely touched
      ep('ep-c', HOUR),
    ]
    const result = findNextEpisode(episodes)
    expect(result?.episode.id).toBe('ep-a')
  })

  describe('against real Empire cache data', () => {
    it('returns ep 28 Battle of Lepanto from the actual cache snapshot', async () => {
      const fs = await import('node:fs/promises')
      let data: { episodes: SpotifyEpisode[] }
      try {
        const raw = await fs.readFile(
          new URL('../../../dist/cached-show.json', import.meta.url),
          'utf8',
        )
        data = JSON.parse(raw)
      } catch {
        // Cache file not present in CI — skip
        return
      }
      const result = findNextEpisode(data.episodes)
      expect(result?.episode.name).toBe('28. The Battle of Lepanto')
      expect(result?.resumeMs).toBe(2_527_000)
    })
  })
})
