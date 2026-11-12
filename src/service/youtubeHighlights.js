const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const pendingRequests = new Map();

/**
 * Fetches highlights through the local Express proxy.
 * The Google API key must never be placed in Vite/frontend environment variables.
 */
export async function fetchMatchHighlights(options = {}) {
  const query = (options.query || "football match highlights").trim();
  const limit = Math.min(10, Math.max(1, Number(options.limit) || 8));
  const regionCode = (options.regionCode || "IN").toUpperCase();
  const cacheKey = `${query}|${limit}|${regionCode}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) cache.delete(cacheKey);

  let request = pendingRequests.get(cacheKey);
  if (!request) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      regionCode,
    });

    request = fetch(`/api/highlights?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const details = payload.details ? ` ${payload.details}` : "";
          throw new Error(
            `${payload.error || "Highlights request failed"} (${response.status}).${details}`,
          );
        }

        const highlights = Array.isArray(payload.highlights)
          ? payload.highlights
          : [];
        const result = { highlights, resultCount: highlights.length };
        cache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return result;
      })
      .finally(() => pendingRequests.delete(cacheKey));

    pendingRequests.set(cacheKey, request);
  }

  return request;
}

export default fetchMatchHighlights;
