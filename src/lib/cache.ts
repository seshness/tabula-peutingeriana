import type { SpotifyEpisode, SpotifyShow } from './spotify'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CacheEntry {
  episodes: SpotifyEpisode[]
  show: SpotifyShow
  fetchedAt: number
}

function cacheKey(showId: string): string {
  return `tp_cache_${showId}`
}

export function readCache(showId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(showId))
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

export function writeCache(showId: string, show: SpotifyShow, episodes: SpotifyEpisode[]): void {
  try {
    const entry: CacheEntry = { show, episodes, fetchedAt: Date.now() }
    localStorage.setItem(cacheKey(showId), JSON.stringify(entry))
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

export function clearCache(showId: string): void {
  localStorage.removeItem(cacheKey(showId))
}

export function getCacheAge(showId: string): number | null {
  try {
    const raw = localStorage.getItem(cacheKey(showId))
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    return Date.now() - entry.fetchedAt
  } catch {
    return null
  }
}
