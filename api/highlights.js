const CACHE_TTL_MS = 15 * 60 * 1000;
const responseCache = new Map();

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function cleanVideo(item) {
  const videoId = item?.id?.videoId;
  if (!videoId) return null;

  const snippet = item.snippet || {};
  const thumbnails = snippet.thumbnails || {};

  return {
    id: videoId,
    videoId,
    title: snippet.title || "Football highlight",
    description: snippet.description || "",
    channel: snippet.channelTitle || "YouTube",
    channelTitle: snippet.channelTitle || "YouTube",
    publishedAt: snippet.publishedAt || null,
    thumbnail:
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      "",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
  };
}

/**
 * Express adapter calls this function with a Web Request and the server-only key.
 * It returns a Web Response so the route can forward status and JSON consistently.
 */
export async function GET(request, { youtubeApiKey } = {}) {
  const apiKey = youtubeApiKey || process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "YOUTUBE_API_KEY is not configured on the Express server." },
      503,
    );
  }

  const incomingUrl = new URL(request.url);
  const query = (incomingUrl.searchParams.get("q") || "football match highlights")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
  const parsedLimit = Number.parseInt(incomingUrl.searchParams.get("limit") || "8", 10);
  const maxResults = Number.isFinite(parsedLimit)
    ? Math.min(10, Math.max(1, parsedLimit))
    : 8;
  const regionCodeRaw = (incomingUrl.searchParams.get("regionCode") || "IN").toUpperCase();
  const regionCode = /^[A-Z]{2}$/.test(regionCodeRaw) ? regionCodeRaw : "IN";

  const cacheKey = `${query}|${maxResults}|${regionCode}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse(cached.body, 200, {
      "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      "X-FootBuzz-Cache": "HIT",
    });
  }
  if (cached) responseCache.delete(cacheKey);

  const youtubeUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  youtubeUrl.search = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(maxResults),
    order: "date",
    regionCode,
    key: apiKey,
  }).toString();

  let upstream;
  try {
    upstream = await fetch(youtubeUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    const status = error.name === "TimeoutError" ? 504 : 502;
    return jsonResponse(
      {
        error:
          status === 504
            ? "YouTube API request timed out."
            : "Could not connect to the YouTube Data API.",
        details: error.message,
      },
      status,
    );
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return jsonResponse(
      { error: "YouTube returned an invalid JSON response." },
      502,
    );
  }

  if (!upstream.ok) {
    const googleMessage = payload?.error?.message || "YouTube Data API request failed.";
    const googleReason = payload?.error?.errors?.[0]?.reason;
    console.error("[youtube-api] Upstream error:", upstream.status, googleReason, googleMessage);
    return jsonResponse(
      {
        error: googleMessage,
        reason: googleReason || null,
        source: "youtube",
      },
      upstream.status,
    );
  }

  const highlights = Array.isArray(payload.items)
    ? payload.items.map(cleanVideo).filter(Boolean)
    : [];

  const body = {
    highlights,
    resultCount: highlights.length,
    query,
    cached: false,
  };

  responseCache.set(cacheKey, {
    body,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  // Keep the in-memory cache bounded during long-running development sessions.
  if (responseCache.size > 100) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }

  return jsonResponse(body, 200, {
    "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
    "X-FootBuzz-Cache": "MISS",
  });
}
