import { useEffect, useMemo, useState } from "react";
import { loadFootballData, getHomeTeamName, getAwayTeamName, getMatchScore, getMatchLeague, getMatchStatus, getTeamLogo } from "./service/FOOTBALLApi";
import { fetchMatchHighlights } from "./service/youtubeHighlights";

const emptyFootballData = { live: [], fixtures: [], leagues: [] };

function MatchCard({ match, isLive }) {
  const homeLogo = getTeamLogo(match, "home");
  const awayLogo = getTeamLogo(match, "away");
  const score = getMatchScore(match);

  return (
    <article className="fb-match-card">
      <div className="fb-match-meta">
        <span>{getMatchLeague(match)}</span>
        <span className={isLive ? "fb-live-label" : "fb-status-label"}>
          {isLive ? "LIVE" : getMatchStatus(match)}
        </span>
      </div>
      <div className="fb-match-teams">
        <div className="fb-team">
          {homeLogo ? <img src={homeLogo} alt="" loading="lazy" /> : <span className="fb-team-placeholder">H</span>}
          <strong>{getHomeTeamName(match)}</strong>
        </div>
        <strong className="fb-score">{score.hasScore ? score.display : "vs"}</strong>
        <div className="fb-team fb-team-away">
          <strong>{getAwayTeamName(match)}</strong>
          {awayLogo ? <img src={awayLogo} alt="" loading="lazy" /> : <span className="fb-team-placeholder">A</span>}
        </div>
      </div>
    </article>
  );
}

function HighlightCard({ video }) {
  return (
    <article className="fb-highlight-card">
      <a href={video.url || `https://www.youtube.com/watch?v=${video.videoId || video.id}`} target="_blank" rel="noreferrer">
        {video.thumbnail ? <img src={video.thumbnail} alt={video.title || "Football highlight"} loading="lazy" /> : null}
        <h3>{video.title || "Football highlight"}</h3>
      </a>
      <p>{video.channelTitle || video.channel || "YouTube"}</p>
    </article>
  );
}

export default function App() {
  const [footballData, setFootballData] = useState(emptyFootballData);
  const [footballLoading, setFootballLoading] = useState(true);
  const [footballError, setFootballError] = useState("");
  const [videos, setVideos] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  const [youtubeError, setYoutubeError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadFootballData()
      .then((result) => {
        if (cancelled) return;
        setFootballData(result?.data ?? emptyFootballData);
        if (result?.hasPartialFailure) {
          setFootballError("Some football data could not be loaded. Check the browser console and Express terminal.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Football API:", error);
        setFootballError(error.message || "Football data could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setFootballLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchMatchHighlights({ query: "football match highlights", limit: 8, regionCode: "IN" })
      .then((result) => {
        if (!cancelled) setVideos(Array.isArray(result?.highlights) ? result.highlights : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("YouTube API:", error);
        setYoutubeError(error.message || "Highlights are temporarily unavailable.");
      })
      .finally(() => {
        if (!cancelled) setYoutubeLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const hasLiveMatches = footballData.live.length > 0;
  const matchesToShow = useMemo(
    () => hasLiveMatches ? footballData.live : footballData.fixtures,
    [hasLiveMatches, footballData.live, footballData.fixtures],
  );

  return (
    <main className="footbuzz-app">
      <header className="fb-header">
        <h1>FOOTBUZZ</h1>
        <nav aria-label="Main navigation">
          <a href="#matches">Matches</a>
          <a href="#highlights">Highlights</a>
        </nav>
      </header>

      <section id="matches" className="fb-section">
        <div className="fb-section-heading">
          <div>
            <p className="fb-eyebrow">MATCH CENTER</p>
            <h2>{hasLiveMatches ? "Live Matches" : "Today's Fixtures"}</h2>
          </div>
          <span>{hasLiveMatches ? "LIVE NOW" : "FIXTURES"}</span>
        </div>

        {footballLoading ? <p>Loading football matches...</p> : null}
        {footballError ? <p className="fb-error" role="status">{footballError}</p> : null}
        {!footballLoading && matchesToShow.length === 0 ? (
          <p>No live matches or fixtures were returned by the football API.</p>
        ) : null}
        <div className="fb-match-grid">
          {matchesToShow.map((match, index) => (
            <MatchCard
              key={match.id ?? match.eventId ?? `${getHomeTeamName(match)}-${getAwayTeamName(match)}-${index}`}
              match={match}
              isLive={hasLiveMatches}
            />
          ))}
        </div>
      </section>

      <section id="highlights" className="fb-section">
        <div className="fb-section-heading">
          <div>
            <p className="fb-eyebrow">WATCH THE ACTION</p>
            <h2>Football Highlights</h2>
          </div>
          <span>YOUTUBE</span>
        </div>

        {youtubeLoading ? <p>Loading highlights...</p> : null}
        {youtubeError ? <p className="fb-error" role="status">Highlights unavailable: {youtubeError}</p> : null}
        {!youtubeLoading && !youtubeError && videos.length === 0 ? (
          <p>No highlights were returned. Try again later.</p>
        ) : null}
        <div className="fb-highlight-grid">
          {videos.map((video, index) => (
            <HighlightCard key={video.videoId || video.id || index} video={video} />
          ))}
        </div>
      </section>
    </main>
  );
}
