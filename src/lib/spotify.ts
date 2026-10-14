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

  return sortEpisodes([...first.items, ...pages.flatMap(p => p.items)])
}

/** Matches the "N. " prefix on numbered episode titles */
export const EPISODE_NUMBER_RE = /^\s*(\d+)\.\s*/

/** The "N." prefix from the title; null for unnumbered bonus / Empire Club episodes */
export function episodeNumber(title: string): number | null {
  const m = title.match(EPISODE_NUMBER_RE)
  return m ? Number(m[1]) : null
}

/**
 * Oldest → newest for the streak algorithm. Release dates are only day-precise
 * and sometimes out of step with the numbering (e.g. 404–406 dated before 403),
 * so numbered episodes are reordered by number within the slots they occupy.
 * Unnumbered episodes keep their date position.
 */
export function sortEpisodes(episodes: SpotifyEpisode[]): SpotifyEpisode[] {
  const byDate = episodes
    .map(episode => ({ episode, number: episodeNumber(episode.name), time: new Date(episode.release_date).getTime() }))
    .sort((a, b) => a.time - b.time)
  const numbered = byDate.filter(d => d.number !== null).sort((a, b) => a.number! - b.number!)
  let next = 0
  return byDate.map(d => (d.number === null ? d.episode : numbered[next++].episode))
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

export function formatDate(dateStr: string, { day = true } = {}): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: day ? 'numeric' : undefined,
    month: 'short',
    year: 'numeric',
  })
}
