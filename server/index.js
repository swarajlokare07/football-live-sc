
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GET as getHighlights } from "../api/highlights.js";

// ==========================================
// ENVIRONMENT CONFIGURATION
// ==========================================

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

dotenv.config({
  path: path.join(projectRoot, ".env.local"),
});

dotenv.config({
  path: path.join(projectRoot, ".env"),
});

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// ==========================================
// API CONFIGURATION
// ==========================================

const rapidApiHost =
  process.env.RAPIDAPI_HOST ||
  "free-api-live-football-data3.p.rapidapi.com";

const rapidApiKey = process.env.RAPIDAPI_KEY;
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

// Confirmed initial endpoints from your existing project.
// Add other endpoints after verifying them in RapidAPI.
const footballEndpoints = {
  live: "football-current-live",
  fixtures: "football-get-matches-by-date",
  leagues: "football-popular-leagues",
  "match-location": "football-get-match-location",
};

// ==========================================
// EXTRACT ARRAY FROM RESPONSE
// ==========================================

function findArray(payload, pathName = "response", depth = 0) {
  if (Array.isArray(payload)) {
    return {
      matches: payload,
      source: pathName,
    };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    depth > 10
  ) {
    return null;
  }

  const preferredKeys = [
    "matches",
    "leagues",
    "events",
    "fixtures",
    "results",
    "response",
    "data",
  ];

  for (const key of preferredKeys) {
    if (Object.hasOwn(payload, key)) {
      const result = findArray(
        payload[key],
        pathName ? `${pathName}.${key}` : key,
        depth + 1
      );

      if (result) return result;
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (preferredKeys.includes(key)) continue;

    const result = findArray(
      value,
      pathName ? `${pathName}.${key}` : key,
      depth + 1
    );

    if (result) return result;
  }

  return null;
}

// ==========================================
// API DEBUG INFORMATION
// ==========================================

function getArrayPaths(value, pathName = "", paths = [], depth = 0) {
  if (
    paths.length >= 20 ||
    depth >= 8 ||
    !value ||
    typeof value !== "object"
  ) {
    return paths;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = pathName
      ? `${pathName}.${key}`
      : key;

    if (Array.isArray(child)) {
      paths.push({
        path: childPath,
        length: child.length,
      });
    } else {
      getArrayPaths(child, childPath, paths, depth + 1);
    }

    if (paths.length >= 20) break;
  }

  return paths;
}

function getDebug(payload, status) {
  return {
    status,

    topLevelKeys:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload)
        : [],

    arrayPaths: getArrayPaths(payload),
  };
}

// ==========================================
// API ERROR MESSAGES
// ==========================================

function getUpstreamError(status) {
  if (status === 401) {
    return "RapidAPI rejected the key. Check RAPIDAPI_KEY.";
  }

  if (status === 403) {
    return "RapidAPI access forbidden. Check subscription.";
  }

  if (status === 404) {
    return "RapidAPI endpoint not found.";
  }

  if (status === 429) {
    return "RapidAPI quota or rate limit exceeded.";
  }

  return `RapidAPI request failed with status ${status}.`;
}

// ==========================================
// DATE VALIDATION
// ==========================================

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// ==========================================
// HEALTH CHECK
// ==========================================

Invoke-RestMethod "http://localhost:4000/api/health"

// ==========================================
// FOOTBALL API ROUTES
// ==========================================

app.get("/api/football/:endpoint", async (request, response) => {
  const endpointName = request.params.endpoint;
  const endpoint = footballEndpoints[endpointName];

  if (!endpoint) {
    return response.status(404).json({
      error: "Unknown football API endpoint.",
    });
  }

  if (!rapidApiKey) {
    return response.status(503).json({
      error: "RAPIDAPI_KEY is not configured.",
    });
  }

  // Fixtures date validation
  if (
    endpointName === "fixtures" &&
    !isValidDate(request.query.date)
  ) {
    return response.status(400).json({
      error: "date must be YYYY-MM-DD.",
    });
  }

  // Match location event ID validation
  const eventId =
    request.query.eventid ??
    request.query.eventId;

  if (
    endpointName === "match-location" &&
    (
      typeof eventId !== "string" ||
      eventId.length === 0 ||
      eventId.length > 200
    )
  ) {
    return response.status(400).json({
      error: "A valid eventid is required.",
    });
  }

  // Build upstream URL
  const upstreamUrl = new URL(
    `https://${rapidApiHost}/${endpoint}`
  );

  // Forward query parameters to RapidAPI.
  // Preserve provider's exact parameter names.
  for (const [key, value] of Object.entries(request.query)) {
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      key !== "eventId"
    ) {
      upstreamUrl.searchParams.set(key, value);
    }
  }

  // Normalize match-location event ID
  if (endpointName === "match-location") {
    upstreamUrl.searchParams.set("eventid", eventId);
  }

  // Request RapidAPI
  let upstream;

  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",

      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": rapidApiHost,
        Accept: "application/json",
      },

      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error(
      `[football-api] ${endpointName}:`,
      error.message
    );

    return response.status(
      error.name === "TimeoutError" ? 504 : 502
    ).json({
      error:
        error.name === "TimeoutError"
          ? "RapidAPI request timed out."
          : "Could not connect to RapidAPI.",
    });
  }

  // Read response
  let payload;

  try {
    payload = await upstream.json();
  } catch {
    return response.status(502).json({
      error: "RapidAPI returned invalid JSON.",
    });
  }

  // Handle upstream error
  if (!upstream.ok) {
    console.error(
      `[football-api] ${endpointName} failed:`,
      upstream.status
    );

    return response.status(upstream.status).json({
      error: getUpstreamError(upstream.status),
      source: "rapidapi",
      debug: getDebug(payload, upstream.status),
    });
  }

  // Match location response
  if (endpointName === "match-location") {
    return response.json({
      location:
        payload?.response ??
        payload?.data ??
        payload,

      debug: getDebug(payload, upstream.status),
    });
  }

  // Extract match arrays
  const result = findArray(payload);

  const matches = result?.matches ?? [];
  const source = result?.source ?? "not-found";

  const normalizedData =
    payload?.response ??
    payload?.data ??
    payload;

  console.info(
    `[football-api] ${endpointName}: ${matches.length} records (${source}).`
  );

  return response.json({
    data: normalizedData,
    matches,
    source,
    debug: getDebug(payload, upstream.status),
  });
});

// ==========================================
// YOUTUBE HIGHLIGHTS ROUTE
// ==========================================

app.get("/api/highlights", async (request, response) => {
  try {
    const requestUrl = new URL(
      request.originalUrl,
      `http://${request.get("host") || "localhost:4000"}`
    );

    const result = await getHighlights(
      new Request(requestUrl),
      {
        youtubeApiKey,
      }
    );

    response.status(result.status);

    response.set(
      "Content-Type",
      result.headers.get("Content-Type") ||
        "application/json; charset=utf-8"
    );

    response.set(
      "Cache-Control",
      result.headers.get("Cache-Control") || "no-store"
    );

    return response.send(await result.text());

  } catch (error) {
    console.error(
      "[youtube-api] Highlights error:",
      error
    );

    return response.status(502).json({
      error: "Could not load YouTube highlights.",

      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((error, _request, response, _next) => {
  console.error("[api] Server error:", error);

  response.status(500).json({
    error: "Internal FootBuzz API server error.",
  });
});

// ==========================================
// START EXPRESS SERVER
// ==========================================

const port = Number.parseInt(
  process.env.API_PORT || "4000",
  10
);

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error("Invalid API_PORT.");
}

const server = app.listen(port, "0.0.0.0", () => {
  console.info(
    `FootBuzz API server listening on http://localhost:${port}`
  );

  console.info(
    `RapidAPI host: ${rapidApiHost}`
  );
});

server.on("error", (error) => {
  console.error("[server] Startup error:", error);
});

process.on("SIGINT", () => {
  server.close(() => {
    console.info("[server] Stopped.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.info("[server] Stopped.");
    process.exit(0);
  });
});
