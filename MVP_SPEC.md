# MVP Spec — Paste this into Claude Code to start

---

Build a web app called **StreamFeed** — a unified feed that shows new YouTube videos from channels I subscribe to.

## Stack
- Frontend: React with Vite
- Backend: Node.js + Express
- Auth: Google OAuth 2.0
- API: YouTube Data API v3

## What to build

### Backend (server/)
1. Google OAuth 2.0 login flow — user clicks "Login with Google", authorizes, gets a session
2. Store OAuth tokens in server-side session (use express-session)
3. Endpoint: `GET /api/subscriptions` — fetches all channels the user is subscribed to via YouTube Data API
4. Endpoint: `GET /api/feed` — for each subscribed channel, fetch videos uploaded in the last 7 days. Return: title, thumbnail, channel name, published date, video URL
5. Handle token refresh automatically if access token expires
6. `GET /api/logout` — clears session

### Frontend (client/)
1. If not logged in: show a centered "Login with YouTube" button
2. If logged in: show a feed of new videos — card layout with thumbnail, title, channel name, time ago (e.g. "2 days ago")
3. Sort feed by most recent first
4. Show a loading state while fetching
5. Show channel name as a filter pill at the top (optional, do last)
6. Logout button in top right

### General
- Dark mode UI
- Mobile responsive
- Use .env file for all secrets (provide a .env.example)
- Add a README with setup instructions

## Important constraints
- YouTube API has a 10,000 unit/day quota — minimize calls, avoid fetching all channel videos, only fetch recent ones
- Don't fetch more than 50 subscriptions in the MVP to stay within quota

## Start by scaffolding the project structure, then build backend auth first, then the feed endpoint, then the frontend.
