import { Progress } from '@/components/ui/progress'

interface LoadingScreenProps {
  loaded: number
  total: number
}

export function LoadingScreen({ loaded, total }: LoadingScreenProps) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-6 text-center bg-background">
      <div className="mb-8 select-none">
        <div className="text-5xl mb-4">🗺</div>
        <h2 className="text-xl font-semibold text-foreground">Charting the Empire…</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {total > 0 ? `${loaded} of ${total} episodes` : 'Fetching episode list…'}
        </p>
      </div>

      <div className="w-full max-w-xs">
        <Progress value={pct} className="h-1.5" />
      </div>
    </div>
  )
}
