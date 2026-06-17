# Tabula Peutingeriana

A personal fan tool for tracking your place in the **Empire** podcast back catalog. Named after the famous Roman road map.

Spotify lacks a native "resume mid-catalog" feature — this fills the gap.

## Setup

### 1. Create a Spotify app

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set **Redirect URIs** to:
   - `http://127.0.0.1:5173/` (development)
   - Your production URL (if deploying)
4. Copy your **Client ID**

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and set VITE_SPOTIFY_CLIENT_ID=your_client_id_here
```

### 3. Run

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), connect with Spotify, and find your next Empire episode.

## How it works

The app fetches all Empire episodes from the Spotify API (in parallel for speed), then runs a streak algorithm:

- An episode is **played** if `fully_played = true`, or if >90% listened and all subsequent episodes are also played
- It finds the most recent played episode that still has unplayed episodes after it
- The **next episode** is the first unplayed after that, resumed from its saved position

Results are cached in `localStorage` for 1 hour.

## PWA

Add to your iPhone home screen: open in Safari → Share → Add to Home Screen.

---

*Fan-made tool. Not affiliated with or endorsed by Empire, Goalhanger Podcasts, or Spotify.*
