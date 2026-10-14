import { useCallback, useEffect, useRef, useState } from 'react'
import { clearCache, readCache, writeCache } from '@/lib/cache'
import { EMPIRE_SHOW_ID, fetchAllEpisodes, fetchShow, type SpotifyEpisode, type SpotifyShow } from '@/lib/spotify'
import { findNextEpisode, getPlayedFlags, type NextEpisodeResult } from '@/lib/streak'

interface EpisodeState {
  status: 'idle' | 'loading' | 'success' | 'error'
  episodes: SpotifyEpisode[]
  show: SpotifyShow | null
  next: NextEpisodeResult | null
  /** Played flag per episode, parallel to episodes */
  played: boolean[]
  playedCount: number
  loadedCount: number
  totalCount: number
  error: string | null
  fromCache: boolean
}

function loadedState(episodes: SpotifyEpisode[], show: SpotifyShow, fromCache: boolean): EpisodeState {
  const played = getPlayedFlags(episodes)
  return {
    status: 'success',
    episodes,
    show,
    next: findNextEpisode(episodes, played),
    played,
    playedCount: played.filter(Boolean).length,
    loadedCount: episodes.length,
    totalCount: episodes.length,
    error: null,
    fromCache,
  }
}

export function useEpisodes(token: string | null) {
  const [state, setState] = useState<EpisodeState>({
    status: 'idle',
    episodes: [],
    show: null,
    next: null,
    played: [],
    playedCount: 0,
    loadedCount: 0,
    totalCount: 0,
    error: null,
    fromCache: false,
  })

  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!token) return

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      if (!forceRefresh) {
        const cached = readCache(EMPIRE_SHOW_ID)
        if (cached) {
          setState(loadedState(cached.episodes, cached.show, true))
          return
        }
      }

      setState(s => ({ ...s, status: 'loading', loadedCount: 0, totalCount: 0, error: null, fromCache: false }))

      try {
        const [show, episodes] = await Promise.all([
          fetchShow(EMPIRE_SHOW_ID, token),
          fetchAllEpisodes(EMPIRE_SHOW_ID, token, (loaded, total) => {
            setState(s => ({ ...s, loadedCount: loaded, totalCount: total }))
          }),
        ])

        writeCache(EMPIRE_SHOW_ID, show, episodes)
        setState(loadedState(episodes, show, false))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message || 'Failed to load episodes.',
        }))
      }
    },
    [token],
  )

  useEffect(() => {
    if (token) load()
    return () => abortRef.current?.abort()
  }, [token, load])

  const refresh = useCallback(() => {
    clearCache(EMPIRE_SHOW_ID)
    load(true)
  }, [load])

  return { ...state, refresh }
}
