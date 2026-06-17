export const EMPIRE_SHOW_ID = '2hfgUFM3natVutm7KDdBpr'

export interface ResumePoint {
  fully_played: boolean
  resume_position_ms: number
}

export interface SpotifyEpisode {
  id: string
  name: string
  description: string
  html_description?: string
  duration_ms: number
  release_date: string
  images: Array<{ url: string; width: number; height: number }>
  resume_point: ResumePoint | null
}

export interface SpotifyShow {
  id: string
  name: string
  publisher: string
  images: Array<{ url: string; width: number; height: number }>
  description: string
}

interface EpisodesPage {
  items: SpotifyEpisode[]
  total: number
  limit: number
  offset: number
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (resp.status === 401) throw new Error('UNAUTHORIZED')
  if (!resp.ok) throw new Error(`Spotify API error: ${resp.status}`)
  return resp.json()
}

async function fetchEpisodesPage(showId: string, token: string, offset: number): Promise<EpisodesPage> {
  const url = `https://api.spotify.com/v1/shows/${showId}/episodes?limit=50&offset=${offset}&market=from_token`
  return apiFetch<EpisodesPage>(url, token)
}

export async function fetchAllEpisodes(
  showId: string,
  token: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<SpotifyEpisode[]> {
  const first = await fetchEpisodesPage(showId, token, 0)
  const total = first.total
  onProgress(first.items.length, total)

  const remaining: Array<Promise<EpisodesPage>> = []
  for (let offset = 50; offset < total; offset += 50) {
    remaining.push(fetchEpisodesPage(showId, token, offset))
  }

  let loaded = first.items.length
  const pages = await Promise.all(
    remaining.map(p =>
      p.then(page => {
        loaded += page.items.length
        onProgress(loaded, total)
        return page
      }),
    ),
  )

  const all = [...first.items, ...pages.flatMap(p => p.items)]

  // Spotify returns newest-first; sort oldest-first for the streak algorithm
  return all.sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
}

export async function fetchShow(showId: string, token: string): Promise<SpotifyShow> {
  return apiFetch<SpotifyShow>(`https://api.spotify.com/v1/shows/${showId}`, token)
}

export function episodeDeepLink(episodeId: string): string {
  return `spotify:episode:${episodeId}`
}

// The spotify: URI doesn't support a position parameter, but the web URL does
// and iOS opens it in the app via universal links.
export function episodePlayLink(episodeId: string, resumeMs: number): string {
  const base = `https://open.spotify.com/episode/${episodeId}`
  if (resumeMs <= 0) return base
  return `${base}?t=${Math.floor(resumeMs / 1000)}`
}

export function episodeWebLink(episodeId: string): string {
  return `https://open.spotify.com/episode/${episodeId}`
}

export function getBestImage(images: SpotifyEpisode['images']): string {
  if (!images?.length) return ''
  return [...images].sort((a, b) => b.width - a.width)[0].url
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
