# Project: StreamFeed (working title)

## What this is
A web app that shows new content from creator platforms in one unified feed.
The user logs in with their accounts and sees new videos/streams from channels they already follow.

## Current Status
🚧 MVP in progress — YouTube only

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Auth:** Google OAuth 2.0 (for YouTube)
- **APIs:** YouTube Data API v3

## Project Structure
```
/client       → React frontend
/server       → Express backend
.env          → API keys and secrets (never commit this)
```

## Environment Variables needed
```
PORT=3001
CLIENT_ORIGIN=https://your-frontend.vercel.app
```

## MVP Features (build these first)
- [ ] Google OAuth login
- [ ] Fetch user's YouTube subscriptions
- [ ] Show new videos (last 7 days) from subscribed channels
- [ ] Clean feed UI — thumbnail, title, channel name, upload date
- [ ] Logout button

## Future Platforms (do NOT build yet)
- Twitch (VODs + live status)
- Kick
- Rumble (may need scraping, no official API)

## Design Notes
- Mobile-friendly layout
- Dark mode preferred
- Keep it fast — cache API responses where possible (YouTube API has daily quota limits)

## Known Constraints
- YouTube Data API v3 has a 10,000 unit/day quota — be efficient with calls
- OAuth tokens need to be refreshed — handle expiry gracefully

## Session Notes

### Session 1 — 2026-06-01
**Built:**
- Full project scaffold: `server/` (Express) + `client/` (React/Vite)
- Google OAuth 2.0 login flow with token refresh
- `GET /api/feed` — fetches subscriptions + recent videos (last 7 days, max 50 channels × 5 videos)
- `GET /api/subscriptions`, `GET /auth/status`, `GET /auth/logout`
- React frontend: login page, video card grid, channel filter pills, dark mode UI
- `.env` with credentials, `.env.example`, `README.md`

**What's next:**
- Add a `.gitignore` (exclude `.env`, `node_modules`)
- Test full OAuth flow — confirm redirect URI is set in Google Cloud Console
- Handle YouTube quota errors gracefully (show a message if quota exceeded)
- Cache feed responses to avoid re-fetching on page reload
- Paginate subscriptions beyond 50 (nextPageToken)
