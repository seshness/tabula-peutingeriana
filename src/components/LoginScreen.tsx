import { Button } from '@/components/ui/button'

interface LoginScreenProps {
  onLogin: () => void
  error?: string | null
}

export function LoginScreen({ onLogin, error }: LoginScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-6 text-center bg-background">
      <div className="mb-8 select-none">
        <div className="text-6xl mb-3">🗺</div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Tabula Peutingeriana</h1>
        <p className="mt-2 text-muted-foreground text-sm">Your place in the Empire back catalog</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <Button
          onClick={onLogin}
          className="w-full h-12 text-base font-semibold cursor-pointer"
          style={{ backgroundColor: '#1DB954', color: '#000' }}
        >
          Connect with Spotify
        </Button>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      <p className="mt-16 text-xs text-muted-foreground max-w-xs leading-relaxed opacity-60">
        Tabula Peutingeriana is a fan-made tool and is not affiliated with or endorsed by Empire,
        Goalhanger Podcasts, or Spotify.
      </p>
    </div>
  )
}
