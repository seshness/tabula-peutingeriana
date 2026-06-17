# Tabula Peutingeriana — Build Plan

A personal fan tool for tracking your place in the Empire podcast back catalog. Named after the famous Roman road map.

## What it does

Fetches the Empire podcast episode list from Spotify, finds where your streak stopped, and gives you a one-tap deep link to resume in the Spotify app. Spotify lacks a native "resume mid-catalog" feature; this fills that gap.

---

## Core Algorithm — The Streak Finder

Episodes are sorted **oldest → newest** (index 0 = oldest).

**"Played" definition (evaluated right-to-left so later episodes inform earlier ones):**
1. `resume_point.fully_played === true` → definitively played
2. `resume_point.resume_position_ms / duration_ms > 0.90` AND all subsequent episodes are also "played" → considered played (you skimmed the last 10% but kept going)
3. Everything else (< 90%, or > 90% but later episodes unplayed) → NOT played

**Finding the next episode:**
1. Walk from newest to oldest, find the most recent "played" episode that has at least one unplayed episode after it
2. The **next episode** = first unplayed episode after that
3. The **resume position** = that next episode's `resume_position_ms` (could be 0 if never started)
4. Edge case — no episodes played: return episode 1 at position 0
5. Edge case — all episodes played: show a "fully caught up" state

---

## Hardcoded Show

**Empire podcast** — show ID: `2hfgUFM3natVutm7KDdBpr`
No search UI. This is a single-purpose tool.

---

## Auth — Spotify PKCE

- Flow: Authorization Code with PKCE (no client secret needed, pure frontend)
- Scopes: `user-read-playback-position user-library-read`
- Token storage: `localStorage` (accepted XSS tradeoff for a personal tool)
- Auto-refresh: silently exchange `refresh_token` when `access_token` expires (1hr TTL)
- Stay logged in indefinitely until explicit logout

PKCE keys in localStorage:
- `tp_access_token`
- `tp_refresh_token`
- `tp_expires_at`

---

## Data Fetching Strategy

Empire has 500+ episodes; Spotify returns 50 per page.

1. Fetch offset=0 to get total count + first 50 episodes
2. Fan out all remaining offsets in parallel (no rate-limit issues for personal use)
3. Sort all episodes oldest→newest after collecting
4. Show a progress indicator during fetch
5. Cache full episode list + show metadata in `localStorage` under `tp_cache_2hfgUFM3natVutm7KDdBpr`
6. Cache TTL: 1 hour — new episodes drop weekly so stale cache is fine for a day
7. Offline: cached data powers the app with no network

---

## UI Structure

**Screens:**
- `LoginScreen` — big login button, app name, unofficial disclaimer
- `LoadingScreen` — progress bar while fetching all episodes
- `MainScreen` — two sections:
  1. **Next Episode Hero** — show art, episode title, date, duration, description excerpt, giant "Play in Spotify" button (`spotify:episode:<id>` deep link)
  2. **Episode List** — scrollable, all episodes, played/unplayed badge, click any for its deep link

**Deep links:** `<a href="spotify:episode:ID">` — works natively on iOS Safari, no JS needed.

---

## PWA

- Installable (add to home screen on iOS)
- Service worker via `vite-plugin-pwa` — caches app shell offline
- Manifest: app name "Tabula Peutingeriana", imperial-themed icon, standalone display mode
- Optimized for iOS Safari first

---

## Visual Design

- Dark imperial theme: near-black warm background, gold accents
- **NOT** official Empire branding — unofficial fan tool
- Footer: "Tabula Peutingeriana is a fan-made tool and is not affiliated with or endorsed by Empire, Goalhanger Podcasts, or Spotify."

---

## Tech Stack

| Layer | Choice |
|---|---|
| Bundler | Vite |
| Framework | React 18 + TypeScript |
| UI components | shadcn/ui |
| Styling | Tailwind CSS v4 |
| PWA | vite-plugin-pwa |
| Package manager | pnpm |
| Auth | Spotify PKCE (pure client-side) |
| State | React hooks + localStorage |
| Routing | None — URL param detection for auth callback |

---

## File Layout

```
src/
  lib/
    auth.ts          PKCE flow, token storage/refresh
    spotify.ts       API client, parallel episode fetching
    streak.ts        Streak algorithm
    cache.ts         localStorage cache with TTL
  hooks/
    useAuth.ts       Auth state machine
    useEpisodes.ts   Fetch + cache + streak computation
  components/
    LoginScreen.tsx
    LoadingScreen.tsx
    NextEpisodeHero.tsx
    EpisodeCard.tsx
    EpisodeList.tsx
  App.tsx
  main.tsx
  index.css
public/
  manifest.json
  icons/             PWA icons (SVG-generated)
```

---

## Environment Variables

```
VITE_SPOTIFY_CLIENT_ID=<your Spotify app client ID>
```

Redirect URI is computed as `window.location.origin` + `/` — no separate env var needed. User must register this in their Spotify Developer app.

---

## Out of Scope (for now)

- Multi-show support
- Playback control via API (play/pause/seek)
- Backend/server
- Social features
