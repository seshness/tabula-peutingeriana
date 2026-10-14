import { useMemo, useState } from 'react'
import { Check, ChevronRight, Clock, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { descriptionSnippet, htmlToText } from '@/components/RichText'
import { descriptionMatch, groupIntoArcs, searchArcs, searchTerms, type Arc } from '@/lib/arcs'
import { readLastSelection, writeLastSelection, type LastSelection } from '@/lib/lastSelection'
import { episodeDeepLink, formatDate, formatDuration, type SpotifyEpisode } from '@/lib/spotify'

interface EpisodeListProps {
  episodes: SpotifyEpisode[]
  /** Played flag per episode, parallel to episodes */
  played: boolean[]
  playedCount: number
  nextEpisodeId: string | null
}

interface EpisodeRowProps {
  episode: SpotifyEpisode
  isNext: boolean
  isPlayed: boolean
  isBonus: boolean
  isLastOpened: boolean
  /** Active search terms, from searchTerms() */
  terms: string[]
  onOpen: () => void
}

function NextBadge() {
  return (
    <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: 'var(--color-gold)', color: '#000' }}>
      NEXT
    </Badge>
  )
}

function PlayedCheck() {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-played)' }}>
      <Check className="w-3 h-3 text-white" strokeWidth={3} />
    </div>
  )
}

// htmlToText is a dozen regex passes; rows re-render on every search keystroke
const snippets = new WeakMap<SpotifyEpisode, string | null>()

function episodeSnippet(episode: SpotifyEpisode): string | null {
  let snippet = snippets.get(episode)
  if (snippet === undefined) {
    const rawText = episode.html_description ? htmlToText(episode.html_description) : episode.description
    snippet = rawText ? descriptionSnippet(rawText) : null
    snippets.set(episode, snippet)
  }
  return snippet
}

function EpisodeRow({ episode, isNext, isPlayed, isBonus, isLastOpened, terms, onOpen }: EpisodeRowProps) {
  const resumePct =
    episode.resume_point && !episode.resume_point.fully_played && episode.duration_ms > 0
      ? episode.resume_point.resume_position_ms / episode.duration_ms
      : 0

  const excerpt = terms.length ? descriptionMatch(episode, terms) : null
  const snippet = excerpt ? null : episodeSnippet(episode)

  return (
    <a
      id={`episode-${episode.id}`}
      href={episodeDeepLink(episode.id)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className={`flex items-start gap-3 pl-6 pr-4 py-3 active:bg-card/80 transition-colors ${isNext || isLastOpened ? 'bg-card/60' : ''}`}
    >
      <div className="mt-0.5 shrink-0">
        {isPlayed ? (
          <PlayedCheck />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {isNext && <NextBadge />}
          {isLastOpened && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0" style={{ borderColor: 'var(--color-gold-muted)', color: 'var(--color-gold)' }}>
              LAST OPENED
            </Badge>
          )}
          {isBonus && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
              BONUS
            </Badge>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{formatDate(episode.release_date)}</span>
        </div>
        <p className={`text-sm leading-snug line-clamp-2 ${isNext ? 'font-medium text-foreground' : isPlayed ? 'text-muted-foreground' : 'text-foreground/90'}`}>
          {episode.name}
        </p>

        {excerpt ? (
          <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2 leading-snug">
            {excerpt.before}
            <mark className="bg-transparent font-medium" style={{ color: 'var(--color-gold)' }}>{excerpt.match}</mark>
            {excerpt.after}
          </p>
        ) : (
          snippet && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 leading-snug">
              {snippet}
            </p>
          )
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

function arcSubtitle(arc: Arc): string {
  const parts: string[] = []
  if (arc.firstNumber !== null) {
    parts.push(arc.firstNumber === arc.lastNumber ? `Ep ${arc.firstNumber}` : `Ep ${arc.firstNumber}–${arc.lastNumber}`)
  }
  const first = formatDate(arc.episodes[0].episode.release_date, { day: false })
  const last = formatDate(arc.episodes[arc.episodes.length - 1].episode.release_date, { day: false })
  parts.push(first === last ? first : `${first} – ${last}`)
  return parts.join(' · ')
}

interface ArcHeaderProps {
  arc: Arc
  played: boolean[]
  expanded: boolean
  containsNext: boolean
  isLastOpened: boolean
  onToggle: () => void
}

function ArcHeader({ arc, played, expanded, containsNext, isLastOpened, onToggle }: ArcHeaderProps) {
  const total = arc.episodes.length
  const playedInArc = arc.episodes.filter(item => played[item.index]).length
  const complete = playedInArc === total

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-card/80 transition-colors ${isLastOpened ? 'bg-card/40' : ''}`}
    >
      <ChevronRight
        className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-medium leading-snug truncate ${complete ? 'text-muted-foreground' : 'text-foreground'}`}>
            {arc.title}
          </p>
          {containsNext && <NextBadge />}
          {isLastOpened && !containsNext && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-gold)' }} title="Last opened" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{arcSubtitle(arc)}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {complete ? (
          <PlayedCheck />
        ) : (
          <span className="text-xs tabular-nums text-muted-foreground">
            {playedInArc}/{total}
          </span>
        )}
      </div>
    </button>
  )
}

export function EpisodeList({ episodes, played, playedCount, nextEpisodeId }: EpisodeListProps) {
  const arcs = useMemo(() => groupIntoArcs(episodes), [episodes])
  const nextArcId = useMemo(
    () => arcs.find(arc => arc.episodes.some(item => item.episode.id === nextEpisodeId))?.id ?? null,
    [arcs, nextEpisodeId],
  )

  const [lastSelection, setLastSelection] = useState<LastSelection>(readLastSelection)
  // Initially open: the last arc opened and the one holding the next episode
  const [openArcs, setOpenArcs] = useState(() => new Set([lastSelection.arcId, nextArcId]))
  // While searching every matching arc is open; this tracks the ones closed by hand
  const [closedInSearch, setClosedInSearch] = useState<Set<string | null>>(new Set())
  const [query, setQuery] = useState('')

  const remember = (selection: LastSelection) => {
    setLastSelection(selection)
    writeLastSelection(selection)
  }

  const terms = useMemo(() => searchTerms(query), [query])
  const searching = terms.length > 0
  const visibleArcs = useMemo(() => searchArcs(arcs, terms), [arcs, terms])
  const isExpanded = (arcId: string) => (searching ? !closedInSearch.has(arcId) : openArcs.has(arcId))

  const toggleArc = (arcId: string) => {
    const flip = (prev: Set<string | null>) => {
      const next = new Set(prev)
      if (!next.delete(arcId)) next.add(arcId)
      return next
    }
    if (searching) setClosedInSearch(flip)
    else setOpenArcs(flip)
    if (!isExpanded(arcId) && lastSelection.arcId !== arcId) remember({ ...lastSelection, arcId })
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    setClosedInSearch(new Set())
  }

  if (episodes.length === 0) return null

  // Newest first, for arcs and for the episodes within them
  const displayArcs = [...visibleArcs].reverse()

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {arcs.length} Arcs
        </p>
        <span className="text-xs text-muted-foreground">{playedCount}/{episodes.length} played</span>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => updateQuery(e.target.value)}
            placeholder="Search arcs and episodes"
            aria-label="Search arcs and episodes"
            enterKeyHint="search"
            autoComplete="off"
            className="w-full h-10 pl-9 pr-9 rounded-lg bg-card border border-border text-base sm:text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-[color:var(--color-gold-muted)] [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => updateQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <Separator />

      {displayArcs.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No arcs or episodes match “{query.trim()}”</p>
      )}

      {displayArcs.map(({ arc, episodes: matches }) => {
        const open = isExpanded(arc.id)
        return (
          <div key={arc.id} className="border-b border-border/40">
            <ArcHeader
              arc={arc}
              played={played}
              expanded={open}
              containsNext={arc.id === nextArcId}
              isLastOpened={arc.id === lastSelection.arcId}
              onToggle={() => toggleArc(arc.id)}
            />
            {open &&
              [...matches].reverse().map(item => (
                <div key={item.episode.id}>
                  <Separator className="ml-6 mr-4 w-auto opacity-30" />
                  <EpisodeRow
                    episode={item.episode}
                    isNext={item.episode.id === nextEpisodeId}
                    isPlayed={played[item.index]}
                    isBonus={item.number === null}
                    isLastOpened={item.episode.id === lastSelection.episodeId}
                    terms={terms}
                    onOpen={() => remember({ arcId: arc.id, episodeId: item.episode.id })}
                  />
                </div>
              ))}
          </div>
        )
      })}
    </div>
  )
}
