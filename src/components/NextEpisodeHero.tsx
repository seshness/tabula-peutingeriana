import { ArrowDown, ExternalLink, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { htmlToText, RichText } from '@/components/RichText'
import { cn } from '@/lib/utils'
import {
  episodePlayLink,
  episodeWebLink,
  formatDate,
  formatDuration,
  getBestImage,
} from '@/lib/spotify'
import type { NextEpisodeResult } from '@/lib/streak'

interface NextEpisodeHeroProps {
  result: NextEpisodeResult
  totalEpisodes: number
  playedCount: number
}

function formatResume(ms: number, durationMs: number): string | null {
  if (ms <= 0) return null
  const pct = Math.round((ms / durationMs) * 100)
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `Resume at ${m}:${s.toString().padStart(2, '0')} (${pct}%)`
}

function scrollToEpisode(episodeId: string) {
  document.getElementById(`episode-${episodeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function NextEpisodeHero({ result, totalEpisodes, playedCount }: NextEpisodeHeroProps) {
  const { episode, resumeMs } = result
  const image = getBestImage(episode.images)
  const resumeLabel = formatResume(resumeMs, episode.duration_ms)
  const playLink = episodePlayLink(episode.id, resumeMs)
  const webLink = episodeWebLink(episode.id)

  return (
    <div className="px-4 pt-6 pb-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
        Up Next
      </p>

      <Card className="border-border/50 bg-card overflow-hidden">
        <CardContent className="p-0">
          {image && (
            <div className="relative w-full aspect-square overflow-hidden">
              <img
                src={image}
                alt={episode.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
            </div>
          )}

          <div className="px-4 pt-3 pb-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--color-gold)] text-[var(--color-gold)]"
                >
                  {formatDate(episode.release_date)}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDuration(episode.duration_ms)}</span>
              </div>
              <h2 className="text-base font-semibold text-foreground leading-snug line-clamp-2">
                {episode.name}
              </h2>
              {resumeLabel && (
                <p className="mt-1 text-xs font-medium" style={{ color: 'var(--color-gold)' }}>
                  {resumeLabel}
                </p>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              <RichText text={episode.html_description ? htmlToText(episode.html_description) : episode.description} />
            </p>

            <div className="flex gap-2 pt-1">
              <a
                href={playLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'flex-1 h-11 font-semibold gap-2 no-underline',
                )}
                style={{ backgroundColor: '#1DB954', color: '#000', borderColor: 'transparent' }}
              >
                <Play className="w-4 h-4 fill-current" />
                Play in Spotify
              </a>
              <a
                href={webLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'icon' }),
                  'h-11 w-11 shrink-0 border-border/50 no-underline',
                )}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="sr-only">Open in browser</span>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{playedCount} of {totalEpisodes} episodes played</span>
        <button
          onClick={() => scrollToEpisode(episode.id)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowDown className="w-3 h-3" />
          Jump to list
        </button>
      </div>
    </div>
  )
}

export function AllCaughtUp({ totalEpisodes }: { totalEpisodes: number }) {
  return (
    <div className="px-4 pt-6 pb-4 text-center">
      <div className="text-4xl mb-3">🏆</div>
      <h2 className="text-xl font-semibold text-foreground">All caught up!</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You've listened to all {totalEpisodes} Empire episodes.
      </p>
    </div>
  )
}
