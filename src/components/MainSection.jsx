import { useEffect, useMemo, useRef, useState } from "react";
import Hero from "./Hero";
import Highlights from "./Highlights";
import {
  Fixtures,
  LiveScores,
  MatchCenter,
  MatchDetailsPanel,
  Standings,
} from "./MainSectionParts";
import { getMatchLocation, getTeams, venuePaths } from "./MainSectionUtils";
import {
  fetchLiveScores,
  fetchFixturesByDate,
  formatFootballDate,
  getMatchEventId,
  getMatchStatus,
  getMatchValue,
  loadFootballDashboard,
} from "../service/FOOTBALLApi";
import { mainSectionStyles as s } from "../assets/dummyStyles";

export default function MainSection() {
  const [date, setDate] = useState({ live: [], leagues: [], fixtures: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState("");
  const [dateOffset, setDateOffset] = useState(0);
  const selectedDateOffset = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("Venue TBC");

  useEffect(() => {
    let active = true;

    async function loadFootball() {
      try {
        const result = await loadFootballDashboard();
        if (!active) return;

        setDate((prev) => ({
          live: result?.data?.live ?? prev.live,
          leagues: result?.data?.leagues ?? prev.leagues,
          fixtures:
            selectedDateOffset.current === 0
              ? result?.data?.fixtures ?? prev.fixtures
              : prev.fixtures,
        }));

        if (result?.hasPartialFailure) {
          const reasons = result.errors
            .map(({ key, error: requestError }) => {
              const message =
                requestError instanceof Error
                  ? requestError.message
                  : String(requestError);
              return `${key}: ${message}`;
            })
            .join(" ");
          setError(`Could not load all API data. ${reasons}`);
        } else {
          setError("");
        }
      } catch {
        if (active) {
          setError("Could not load API data. Check your network and RapidAPI setup.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadFootball();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    selectedDateOffset.current = dateOffset;

    async function updateFixtures() {
      setFixturesLoading(true);
      setFixturesError("");
      setDate((prev) => ({ ...prev, fixtures: [] }));
      try {
        const selectedDate = formatFootballDate(dateOffset);
        console.info("[fixtures] fetching matches for:", selectedDate);
        const fixtures = await fetchFixturesByDate(selectedDate);
        if (active) {
          setDate((prev) => ({ ...prev, fixtures }));
        }
      } catch (fixturesError) {
        if (active) {
          setDate((prev) => ({ ...prev, fixtures: [] }));
          setFixturesError(
            fixturesError instanceof Error
              ? fixturesError.message
              : "Could not load fixtures for the selected date.",
          );
        }
      } finally {
        if (active) {
          setFixturesLoading(false);
        }
      }
    }

    updateFixtures();
    return () => {
      active = false;
    };
  }, [dateOffset]);

  useEffect(() => {
    if (!selectedMatch) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedMatch(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMatch]);

  useEffect(() => {
    if (!selectedMatch?.match) return undefined;

    const eventId = getMatchEventId(selectedMatch.match);
    if (!eventId) return undefined;

    let active = true;

    getMatchLocation(eventId, "Venue TBC", () => active)
      .then((location) => {
        if (active && location) setSelectedLocation(location);
      })
      .catch(() => {
        if (active) {
          setSelectedLocation(getMatchValue(selectedMatch.match, venuePaths, "Venue TBC"));
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMatch]);

  const openMatchDetails = (match, statusLabel = getMatchStatus(match)) => {
    const fallbackVenue = getMatchValue(match, venuePaths, "Venue TBC");
    setSelectedLocation(getMatchEventId(match) ? "Loading venue..." : fallbackVenue);
    setSelectedMatch({ match, statusLabel });
  };

  const closeMatchDetails = () => {
    setSelectedMatch(null);
    setSelectedLocation("Venue TBC");
  };

  const refreshLiveScores = async () => {
    setRefreshing(true);
    try {
      const live = await fetchLiveScores();
      setDate((prev) => ({ ...prev, live }));
      setError("");
    } catch (refreshError) {
      const reason = refreshError instanceof Error ? ` ${refreshError.message}` : "";
      setError(`Could not refresh live scores.${reason}`);
    } finally {
      setRefreshing(false);
    }
  };

  const empty = (text, isLoading = loading || fixturesLoading) => (
    <div className={s.emptyBase}>{isLoading ? "Loading fresh football data..." : text}</div>
  );

  const matchCenterItems = useMemo(
    () => [...(date.live ?? []), ...(date.fixtures ?? [])].slice(0, 5),
    [date.live, date.fixtures],
  );

  const filteredFixtures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return date.fixtures ?? [];

    return (date.fixtures ?? []).filter((match) => {
      const teams = getTeams(match);
      return Object.values(teams).some((team) =>
        String(team).toLowerCase().includes(query),
      );
    });
  }, [date.fixtures, searchQuery]);

  return (
    <>
      <Hero matches={matchCenterItems} loading={loading} onMatchSelect={openMatchDetails} />
      <Highlights />
      <main className={s.mainContainer}>
        <div className={s.glowLeft} />
        <div className={s.glowRight} />

        <div className={s.innerWrapper}>
          {error && <div className={s.errorBanner}>{error}</div>}
          <MatchCenter matches={matchCenterItems} loading={loading} onViewMatch={openMatchDetails} />
          <LiveScores
            matches={date.live ?? []}
            loading={loading}
            refreshing={refreshing}
            onRefresh={refreshLiveScores}
            empty={empty}
          />
          <Standings leagues={date.leagues ?? []} loading={loading} empty={empty} />
          <Fixtures
            dateOffset={dateOffset}
            selectedDate={formatFootballDate(dateOffset)}
            fixtures={filteredFixtures}
            loading={loading || fixturesLoading}
            error={fixturesError}
            searchQuery={searchQuery}
            setDateOffset={setDateOffset}
            setSearchQuery={setSearchQuery}
            onViewMatch={openMatchDetails}
            empty={empty}
          />
        </div>

        <MatchDetailsPanel
          selection={selectedMatch}
          location={selectedLocation}
          onClose={closeMatchDetails}
        />
      </main>
    </>
  );
}
