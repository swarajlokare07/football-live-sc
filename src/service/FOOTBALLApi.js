const API_HOST = "free-api-live-football-data.p.rapidapi.com";
const API_URL = `https://${API_HOST}/v2/`;
const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;

const api = {
  async get(path, { params = {} } = {}) {
    if (!API_KEY) {
      throw new Error("Missing VITE_RAPIDAPI_KEY environment variable.");
    }

    const url = new URL(path.replace(/^\//, ""), API_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": API_HOST,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Football API request failed (${response.status} ${response.statusText}).`,
      );
    }

    return { data: await response.json() };
  },
};

export const hasFootballApiKey = Boolean(API_KEY);

export const formatFootballDate = (addDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const scorePaths = {
  home: [
    "scores.home",
    "score.home",
    "goals.home",
    "homeScore",
    "home.score",
    "homeTeam.score",
    "teams.home.score",
    "score.fullTime.home",
    "score.current.home",
    "status.homeScore",
    "status.score.home",
  ],
  away: [
    "scores.away",
    "score.away",
    "goals.away",
    "awayScore",
    "away.score",
    "awayTeam.score",
    "teams.away.score",
    "score.fullTime.away",
    "score.current.away",
    "status.awayScore",
    "status.score.away",
  ],
};

export const cleanValue = (value, fallback = "TBD") => {
  if (value === 0) return "0";
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return value.name || value.title || value.shortName || fallback;
};

export const getMatchValue = (item, paths, fallback = "TBD") => {
  const value = paths
    .map((path) =>
      path.split(".").reduce((data, key) => data?.[key], item),
    )
    .find((candidate) => candidate !== null && candidate !== undefined && candidate !== "");

  return cleanValue(value, fallback);
};

export const getMatchScore = (match) => {
  const scoreLine = getMatchValue(
    match,
    ["scores.display", "scoreStr", "Scores.display", "status.scoreStr"],
    "",
  );
  const home = getMatchValue(match, scorePaths.home, "");
  const away = getMatchValue(match, scorePaths.away, "");
  const hasPair = home !== "" && away !== "";

  if (hasPair) {
    return {
      home,
      away,
      display: `${home} - ${away}`,
      hasPair: true,
      hasScore: true,
    };
  }

  if (scoreLine) {
    return {
      home,
      away,
      display: scoreLine,
      hasPair: false,
      hasScore: true,
    };
  }

  return {
    home: "",
    away: "",
    display: "vs",
    hasPair: false,
    hasScore: false,
  };
};

const statusPaths = ["status.long", "status.type", "status.short", "status"];

export const getMatchStatus = (match, fallback = "Scheduled") => {
  const explicitStatus = getMatchValue(match, statusPaths, "");
  if (explicitStatus) return explicitStatus;
  if (getMatchScore(match).hasPair) return "Full Time";
  return getMatchValue(match, ["time", "date"], fallback);
};

export const getmatchLeague = (match) =>
  getMatchValue(
    match,
    ["league.name", "competition.name", "tournament.name", "league"],
    "competition",
  );

export const getMatchLeague = getmatchLeague;

export const getMatchEventId = (match) =>
  getMatchValue(
    match,
    [
      "id",
      "eventId",
      "eventid",
      "event_id",
      "matchId",
      "fixture.id",
      "fixture.eventId",
      "detail.matchId",
    ],
    "",
  );

export const findArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const item of Object.values(value)) {
    const found = findArray(item);
    if (found.length) return found;
  }

  return [];
};

export const getImageValue = (item, paths) => {
  const value = paths
    .map((path) =>
      path.split(".").reduce((data, key) => data?.[key], item),
    )
    .find(
      (candidate) =>
        typeof candidate === "string" && candidate.startsWith("http"),
    );

  return value || "";
};

export const getTeamLogo = (match, side) => {
  const sidePaths = {
    home: [
      "home.logo",
      "home.image",
      "home.crest",
      "homeTeam.logo",
      "homeTeam.image",
      "homeTeam.crest",
      "teams.home.logo",
      "teams.home.image",
      "teams.home.crest",
      "home.logoUrl",
      "homeTeam.logoUrl",
      "teams.home.logoUrl",
    ],
    away: [
      "away.logo",
      "away.image",
      "away.crest",
      "awayTeam.logo",
      "awayTeam.image",
      "awayTeam.crest",
      "teams.away.logo",
      "teams.away.image",
      "teams.away.crest",
      "away.logoUrl",
      "awayTeam.logoUrl",
      "teams.away.logoUrl",
    ],
  };

  const url = getImageValue(match, sidePaths[side] || []);
  if (url) return url;

  const teamId = getMatchValue(
    match,
    [`${side}.id`, `${side}Team.id`, `teams.${side}.id`],
    "",
  );
  if (teamId) {
    return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`;
  }

  return "";
};

export const loadFootballData = async () => {
  const requests = [
    ["live", api.get("/football-current-live")],
    ["leagues", api.get("/football-popular-leagues")],
    [
      "fixtures",
      api.get("/football-get-matches-by-date", {
        params: { date: formatFootballDate() },
      }),
    ],
  ];
  const settled = await Promise.allSettled(
    requests.map(([, request]) => request),
  );
  const data = {};
  const errors = [];

  settled.forEach((result, index) => {
    const [key] = requests[index];
    if (result.status === "fulfilled") {
      data[key] = findArray(result.value.data);
    } else {
      errors.push({ key, error: result.reason });
    }
  });

  return {
    data,
    hasPartialFailure: errors.length > 0,
    errors,
  };
};

export const fetchFixturesByDate = async (dateString = formatFootballDate()) => {
  const response = await api.get("/football-get-matches-by-date", {
    params: { date: dateString },
  });
  return findArray(response.data);
};