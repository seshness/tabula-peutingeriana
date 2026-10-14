const STORAGE_KEY = 'tp_last_selection'

export interface LastSelection {
  arcId: string | null
  episodeId: string | null
}

export function readLastSelection(): LastSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { arcId: null, episodeId: null }
    const parsed = JSON.parse(raw) as Partial<LastSelection>
    return { arcId: parsed.arcId ?? null, episodeId: parsed.episodeId ?? null }
  } catch {
    return { arcId: null, episodeId: null }
  }
}

export function writeLastSelection(selection: LastSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Storage unavailable — selection just won't persist
  }
}
