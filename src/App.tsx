import { LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EpisodeList } from '@/components/EpisodeList'
import { LoadingScreen } from '@/components/LoadingScreen'
import { LoginScreen } from '@/components/LoginScreen'
import { AllCaughtUp, NextEpisodeHero } from '@/components/NextEpisodeHero'
import { useAuth } from '@/hooks/useAuth'
import { useEpisodes } from '@/hooks/useEpisodes'

function MainApp({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { status, episodes, show, next, playedCount, loadedCount, totalCount, error, fromCache, refresh } =
    useEpisodes(token)

  if (status === 'loading' || status === 'idle') {
    return <LoadingScreen loaded={loadedCount} total={totalCount} />
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-svh px-6 text-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={refresh}>Retry</Button>
      </div>
    )
  }

  const cacheLabel = fromCache ? 'Cached' : 'Live'

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3 bg-background/80 backdrop-blur-sm border-b border-border/40"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🗺</span>
          <span className="text-sm font-semibold text-foreground truncate max-w-40">
            {show?.name ?? 'Empire'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            className="h-8 w-8 text-muted-foreground"
            title={`Refresh (${cacheLabel})`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="h-8 w-8 text-muted-foreground"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {next ? (
        <NextEpisodeHero result={next} totalEpisodes={episodes.length} playedCount={playedCount} />
      ) : (
        <AllCaughtUp totalEpisodes={episodes.length} />
      )}

      <EpisodeList episodes={episodes} nextEpisodeId={next?.episode.id ?? null} />

      <footer className="px-4 py-6 text-center">
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-xs mx-auto">
          Tabula Peutingeriana is a fan-made tool and is not affiliated with or endorsed by Empire,
          Goalhanger Podcasts, or Spotify.
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  const { state, token, error, login, logout } = useAuth()

  if (state === 'loading') {
    return <LoadingScreen loaded={0} total={0} />
  }

  if (state === 'unauthenticated' || state === 'error') {
    return <LoginScreen onLogin={login} error={error} />
  }

  return <MainApp token={token!} onLogout={logout} />
}
