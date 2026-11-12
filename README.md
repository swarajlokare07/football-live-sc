# FootBuzz

FootBuzz is a React/Vite frontend with an Express API server. RapidAPI and
YouTube API keys are read only by the server and are never included in the
frontend bundle.

## Set up environment variables

Revoke and regenerate any RapidAPI key that was exposed in a screenshot. Do not
reuse the exposed key. Copy `.env.example` to `.env` in the project root and set
the new `RAPIDAPI_KEY`. `YOUTUBE_API_KEY` is optional; football scores and
fixtures work without it, but the highlights endpoint will return a clear
configuration error.

```env
RAPIDAPI_KEY=YOUR_NEW_RAPIDAPI_KEY
RAPIDAPI_HOST=free-api-live-football-data.p.rapidapi.com
YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_KEY
API_PORT=4000
```

Never put either API key in a `VITE_` variable or frontend source file. Do not
commit `.env`.

## Run the app

```sh
npm install
npm run dev
```

The frontend is at `http://localhost:5173`; the API health check is at
`http://localhost:4000/api/health`. The dev command starts both servers. To run
them separately, use `npm run server` and `npm run dev:client` in two terminals.

## Local API routes

- `GET /api/health` reports whether server-side API keys are configured.
- `GET /api/football/live` returns live matches and response-path debug details.
- `GET /api/football/fixtures?date=YYYY-MM-DD` returns fixtures for a date.
- `GET /api/football/leagues` returns the provider's popular leagues.
- `GET /api/football/match-location?eventid=...` returns a match location.
- `GET /api/highlights?home=...&away=...` returns YouTube highlights.

The Express server calls RapidAPI and the YouTube Data API. Vite proxies local
`/api` requests to Express while developing. Live matches may legitimately be
empty when no fixtures are in progress. For API errors, check the server
response: 401 usually means an invalid key, 403 means missing access or
subscription, and 429 means a quota or rate limit.

The `football-popular-leagues` endpoint is not a standings endpoint, so the UI
labels that section “Popular Leagues.” Actual standings require the provider's
`football-get-standing-all` endpoint and its required league/season parameters.

For production, deploy the Express server and configure the frontend host to
proxy `/api` to it. Keep `RAPIDAPI_KEY` and `YOUTUBE_API_KEY` in server
environment variables.
