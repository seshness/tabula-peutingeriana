import { Check, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { descriptionSnippet, htmlToText } from '@/components/RichText'
import { episodeDeepLink, formatDate, formatDuration, type SpotifyEpisode } from '@/lib/spotify'
import { getPlayedCount } from '@/lib/streak'

interface EpisodeListProps {
  episodes: SpotifyEpisode[]
  nextEpisodeId: string | null
}

function EpisodeRow({ episode, isNext, isPlayed }: { episode: SpotifyEpisode; isNext: boolean; isPlayed: boolean }) {
  const resumePct =
    episode.resume_point && !episode.resume_point.fully_played && episode.duration_ms > 0
      ? episode.resume_point.resume_position_ms / episode.duration_ms
      : 0

  const rawText = episode.html_description ? htmlToText(episode.html_description) : episode.description
  const snippet = rawText ? descriptionSnippet(rawText) : null

  return (
    <a
      id={`episode-${episode.id}`}
      href={episodeDeepLink(episode.id)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-start gap-3 px-4 py-3 active:bg-card/80 transition-colors ${isNext ? 'bg-card/60' : ''}`}
    >
      <div className="mt-0.5 shrink-0">
        {isPlayed ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-played)' }}>
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {isNext && (
            <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: 'var(--color-gold)', color: '#000' }}>
              NEXT
            </Badge>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{formatDate(episode.release_date)}</span>
        </div>
        <p className={`text-sm leading-snug line-clamp-2 ${isNext ? 'font-medium text-foreground' : isPlayed ? 'text-muted-foreground' : 'text-foreground/90'}`}>
          {episode.name}
        </p>

        {snippet && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 leading-snug">
            {snippet}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDuration(episode.duration_ms)}
          </span>
          {resumePct > 0 && (
            <div className="flex items-center gap-1.5 flex-1 max-w-24">
              <div className="h-0.5 flex-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${resumePct * 100}%`, backgroundColor: 'var(--color-gold)' }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{Math.round(resumePct * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </a>
  )
}

export function EpisodeList({ episodes, nextEpisodeId }: EpisodeListProps) {
  const n = episodes.length
  if (n === 0) return null

  // Compute played status using the same right-to-left logic as streak.ts
  const played = new Array<boolean>(n).fill(false)
  for (let i = n - 1; i >= 0; i--) {
    const rp = episodes[i].resume_point
    if (!rp) { played[i] = false; continue }
    if (rp.fully_played) { played[i] = true; continue }
    const pct = episodes[i].duration_ms > 0 ? rp.resume_position_ms / episodes[i].duration_ms : 0
    const allSubsequentPlayed = i === n - 1 || played.slice(i + 1).every(Boolean)
    played[i] = pct > 0.9 && allSubsequentPlayed
  }

  // Newest first in the list UI
  const displayEpisodes = [...episodes].reverse()
  const playedCount = getPlayedCount(episodes)

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">All Episodes</p>
        <span className="text-xs text-muted-foreground">{playedCount}/{n} played</span>
      </div>
      <Separator className="mb-0" />

      <ScrollArea className="scroll-momentum">
        <div>
          {displayEpisodes.map((episode, displayIdx) => {
            // displayIdx 0 = newest; map back to original index
            const origIdx = n - 1 - displayIdx
            return (
              <div key={episode.id}>
                <EpisodeRow
                  episode={episode}
                  isNext={episode.id === nextEpisodeId}
                  isPlayed={played[origIdx]}
                />
                {displayIdx < displayEpisodes.length - 1 && (
                  <Separator className="mx-4 w-auto opacity-30" />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
