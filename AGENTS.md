# Agent notes

## Finishing work: commit, merge, push — don't ask

When a change is done and verified (`pnpm test`, `pnpm build`, and `pnpm lint`
showing no new errors), carry it all the way through without asking:

1. Commit on a short-lived branch.
2. Fast-forward merge into `main` and delete the branch.
3. `git push`.

Then say what landed. Don't stop to ask "want me to merge / push?" — that's
already the answer. Only pause if verification fails or the change needs a
decision only the user can make.

Deploying is separate: the user runs `pnpm deploy` themselves (it needs an
interactive Cloudflare login). Remind them it's pending rather than running it.

## Cached data outlives code

Episodes are cached in `localStorage` (`src/lib/cache.ts`, 1h TTL), so a new
deploy will read data written by the previous version. Don't remove a guard
that normalises cached data on the grounds that old caches "will expire soon" —
users open the app right after a deploy. Episodes are sorted in one place,
`loadedState` in `src/hooks/useEpisodes.ts`, for both fetched and cached lists.
