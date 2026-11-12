const API_BASE = "/api/football";
const pendingRequests = new Map();

function formatErrorMessage(payload, status) {
  return (
    payload?.error ||
    payload?.message ||
    `Football API request failed (${status}).`
  );
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const requestUrl = url.toString();
  let request = pendingRequests.get(requestUrl);

  if (!request) {
    request = fetch(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(formatErrorMessage(payload, response.status));
        }
        return payload;
      })
      .finally(() => pendingRequests.delete(requestUrl));

    pendingRequests.set(requestUrl, request);
  }

  return request;
}

export const hasFootballApiKey = true; // Key is stored securely on the Express server.

export const formatFootballDate = (addDays = 0) => {
  const date = new Date();

  // Noon avoids date-boundary issues.
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + addDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// ==========================================
// COMMON API REQUEST
// ==========================================

const requestFootballApi = async (endpoint, params = {}) => {
  const url = new URL(
    `${API_BASE}/${endpoint}`,
    window.location.origin
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Football API returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      result.error || `Football API error: ${response.status}`
    );
  }

  if (!Array.isArray(result.matches)) {
    throw new Error(
      `Invalid football API response for ${endpoint}.`
    );
  }

  console.log(
    `[FOOTBALL API] ${endpoint}:`,
    result.matches.length,
    "records",
    result.source
  );

  return result.matches;
};

// ==========================================
// FETCH FIXTURES BY DATE
// ==========================================

export const fetchFixturesByDate = async (
  dateString = formatFootballDate()
) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("Invalid date. Expected YYYY-MM-DD.");
  }

  return requestFootballApi("fixtures", {
    date: dateString,
  });
};

// ==========================================
// FETCH LIVE SCORES
// ==========================================

export const fetchLiveScores = async () => {
  return requestFootballApi("live");
};

// ==========================================
// FETCH POPULAR LEAGUES
// ==========================================

export const fetchPopularLeagues = async () => {
  return requestFootballApi("leagues");
};

// ==========================================
// LOAD DASHBOARD
// ==========================================

export const loadFootballData = async () => {
  const requests = [
    ["live", fetchLiveScores()],
    ["fixtures", fetchFixturesByDate()],
    ["leagues", fetchPopularLeagues()],
  ];

  const settled = await Promise.allSettled(
    requests.map(([, promise]) => promise)
  );

  const data = {
    live: [],
    fixtures: [],
    leagues: [],
  };

  const errors = [];

  settled.forEach((result, index) => {
    const [key] = requests[index];

    if (result.status === "fulfilled") {
      data[key] = result.value;
    } else {
      errors.push({
        key,
        error: result.reason,
      });

      console.error(
        `[FOOTBALL API] ${key} failed:`,
        result.reason
      );
    }
  });

  return {
    data,
    hasPartialFailure: errors.length > 0,
    errors,
  };
};

// ==========================================
// MATCH LOCATION
// ==========================================

export const fetchMatchLocation = async (eventId) => {
  if (!eventId) {
    throw new Error("Match event ID is required.");
  }

  const url = new URL(
    `${API_BASE}/match-location`,
    window.location.origin
  );

  url.searchParams.set("eventid", String(eventId));

  const response = await fetch(url);

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "Unable to fetch match location."
    );
  }

  return result.location ?? {};
};

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

export const fetchFixtureByDate = fetchFixturesByDate;
export const loadFootballDashboard = loadFootballData;

export const findArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

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
    if (Object.hasOwn(value, key)) {
      const found = findArray(value[key]);
      if (found.length > 0 || Array.isArray(value[key])) return found;
    }
  }

  for (const child of Object.values(value)) {
    const found = findArray(child);
    if (found.length > 0) return found;
  }
  return [];
};

export const cleanValue = (value, fallback = "TBD") => {
  if (value === 0) return "0";
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.name || value.title || value.shortName || value.short_name || fallback;
};

export const getMatchValue = (item, paths, fallback = "TBD") => {
  const value = paths
    .map((path) => path.split(".").reduce((data, key) => data?.[key], item))
    .find((candidate) => candidate !== null && candidate !== undefined && candidate !== "");
  return cleanValue(value, fallback);
};

export const getHomeTeamName = (match) =>
  getMatchValue(match, ["home.name", "homeTeam.name", "teams.home.name"], "Home");

export const getAwayTeamName = (match) =>
  getMatchValue(match, ["away.name", "awayTeam.name", "teams.away.name"], "Away");

export const scorePaths = {
  home: ["home.score", "scores.home", "score.home", "goals.home", "homeScore", "homeTeam.score", "teams.home.score"],
  away: ["away.score", "scores.away", "score.away", "goals.away", "awayScore", "awayTeam.score", "teams.away.score"],
};

export const getMatchScore = (match) => {
  const home = getMatchValue(match, scorePaths.home, "");
  const away = getMatchValue(match, scorePaths.away, "");
  if (home !== "" && away !== "") {
    return { home, away, display: `${home} - ${away}`, hasPair: true, hasScore: true };
  }

  const scoreLine = getMatchValue(
    match,
    ["scores.display", "scoreStr", "status.scoreStr"],
    "",
  );
  if (scoreLine) {
    return { home, away, display: scoreLine, hasPair: false, hasScore: true };
  }
  return { home: "", away: "", display: "vs", hasPair: false, hasScore: false };
};

export const getMatchStatus = (match, fallback = "Scheduled") => {
  const status = getMatchValue(
    match,
    ["status.long", "status.description", "status.name", "status.type", "status.short", "status"],
    "",
  );
  if (status) return status;
  return getMatchValue(match, ["time", "date"], fallback);
};

export const getMatchLeague = (match) =>
  getMatchValue(
    match,
    ["league.name", "competition.name", "tournament.name", "leagueName", "league"],
    "Competition",
  );
export const getmatchLeague = getMatchLeague;

export const getMatchEventId = (match) =>
  getMatchValue(match, ["id", "eventId", "eventid", "event_id", "matchId", "fixture.id"], "");

export const getImageValue = (item, paths) => {
  const value = paths
    .map((path) => path.split(".").reduce((data, key) => data?.[key], item))
    .find((candidate) => typeof candidate === "string" && /^https?:\/\//i.test(candidate));
  return value || "";
};

export const getTeamLogo = (match, side) => {
  const paths = side === "home"
    ? ["home.logo", "home.image", "home.crest", "home.logoUrl", "home.imageUrl", "homeTeam.logo", "teams.home.logo"]
    : ["away.logo", "away.image", "away.crest", "away.logoUrl", "away.imageUrl", "awayTeam.logo", "teams.away.logo"];
  return getImageValue(match, paths);
};
