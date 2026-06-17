import type { SpotifyEpisode } from './spotify'

export interface NextEpisodeResult {
  episode: SpotifyEpisode
  resumeMs: number
  streakLength: number
}

function pct(episode: SpotifyEpisode): number {
  if (!episode.resume_point || episode.duration_ms === 0) return 0
  return episode.resume_point.resume_position_ms / episode.duration_ms
}

/**
 * An episode is "effectively played" if:
 * - fully_played === true, OR
 * - listened >90% AND (all subsequent episodes are played, OR the immediately
 *   next episode has been meaningfully started >5% — meaning the user moved on)
 *
 * The "next episode started" branch handles the common case of two consecutive
 * near-complete episodes: e.g. 95% → 89% → unplayed. Without it the 95% episode
 * wouldn't qualify as played because the 89% episode is not "played", so the
 * algorithm would return the 95% episode rather than the 89% one.
 */
function isEffectivelyPlayed(
  episode: SpotifyEpisode,
  nextEpisode: SpotifyEpisode | null,
  allSubsequentPlayed: boolean,
): boolean {
  const rp = episode.resume_point
  if (!rp) return false
  if (rp.fully_played) return true
  if (pct(episode) <= 0.9) return false

  if (allSubsequentPlayed) return true

  // Next episode meaningfully started → user moved on, consider this one done
  if (nextEpisode) {
    const nextRp = nextEpisode.resume_point
    if (nextRp && (nextRp.fully_played || pct(nextEpisode) > 0.05)) return true
  }

  return false
}

/**
 * episodes must be sorted oldest → newest.
 *
 * Returns the next episode to play: the first unplayed episode after the most
 * recent anchor. An anchor is a "played" episode that is part of a consecutive
 * chain (its immediate predecessor is also played), which prevents an isolated
 * bonus listen far ahead in the feed from hijacking the streak position.
 */
export function findNextEpisode(episodes: SpotifyEpisode[]): NextEpisodeResult | null {
  const n = episodes.length
  if (n === 0) return null

  const played = new Array<boolean>(n).fill(false)

  // Right-to-left so later episodes inform the 90%+chain rule for earlier ones
  for (let i = n - 1; i >= 0; i--) {
    const allSubsequentPlayed = i === n - 1 || played.slice(i + 1).every(Boolean)
    const nextEpisode = i < n - 1 ? episodes[i + 1] : null
    played[i] = isEffectivelyPlayed(episodes[i], nextEpisode, allSubsequentPlayed)
  }

  // Scan newest → oldest. Accept a played episode as an anchor only if its
  // immediate predecessor is also played (chain check). This skips isolated
  // bonus listens that would otherwise override the real streak position.
  for (let i = n - 1; i >= 0; i--) {
    if (!played[i]) continue
    const inChain = i === 0 || played[i - 1]
    if (!inChain) continue

    for (let j = i + 1; j < n; j++) {
      if (!played[j]) {
        return {
          episode: episodes[j],
          resumeMs: episodes[j].resume_point?.resume_position_ms ?? 0,
          streakLength: i + 1,
        }
      }
    }
  }

  // No played episodes at all — start from the beginning
  if (!played[0]) {
    return { episode: episodes[0], resumeMs: 0, streakLength: 0 }
  }

  return null // All episodes played
}

export function getPlayedCount(episodes: SpotifyEpisode[]): number {
  const n = episodes.length
  if (n === 0) return 0
  const played = new Array<boolean>(n).fill(false)
  for (let i = n - 1; i >= 0; i--) {
    const allSubsequentPlayed = i === n - 1 || played.slice(i + 1).every(Boolean)
    const nextEpisode = i < n - 1 ? episodes[i + 1] : null
    played[i] = isEffectivelyPlayed(episodes[i], nextEpisode, allSubsequentPlayed)
  }
  return played.filter(Boolean).length
}
