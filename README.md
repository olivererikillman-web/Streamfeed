# StreamFeed

A unified feed showing new YouTube videos from channels you subscribe to.

## Setup

### 1. Google OAuth credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **YouTube Data API v3**
3. Create OAuth 2.0 credentials → add `http://localhost:3001/auth/callback` as an authorized redirect URI
4. Copy Client ID + Secret

### 2. Environment variables
Copy `.env.example` to `.env` and fill in your values:
```
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_API_KEY=...
SESSION_SECRET=any_random_string
PORT=3001
```

### 3. Run the app

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend (new terminal):**
```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Notes
- YouTube Data API has a **10,000 unit/day quota** — the feed fetches max 50 subscriptions and 5 recent videos per channel
- OAuth tokens refresh automatically before expiry
