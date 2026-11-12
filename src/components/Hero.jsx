import {
  getMatchScore,
  getMatchStatus,
  getMatchValue,
  getTeamLogo,
} from '../service/FOOTBALLApi';
import { heroStyles as s } from '../assets/dummyStyles';

const teamNamePaths = {
  home: ['home.name', 'homeTeam.name', 'teams.home.name', 'homeTeam', 'home'],
  away: ['away.name', 'awayTeam.name', 'teams.away.name', 'awayTeam', 'away'],
};

function RealTeamBadge({ logo, name, featured }) {
  const badgeStyle = featured ? s.badgeFeatured : s.badgeDefault;
  const fallbackStyle = featured
    ? s.badgeFallbackFeatured
    : s.badgeFallbackDefault;
  const initials = name === 'TBD' ? 'TBD' : name.slice(0, 3).toUpperCase();

  return (
    <div className={`${s.badgeBase} ${badgeStyle}`}>
      {logo ? (
        <img src={logo} alt={`${name} logo`} className={s.badgeLogo} />
      ) : (
        <span className={fallbackStyle}>{initials}</span>
      )}
    </div>
  );
}

function Stat({ value, label, loading }) {
  return (
    <div aria-busy={loading}>
      <p className={s.statValue}>
        {loading ? (
          <span className="animate-pulse" aria-label="Loading">
            ...
          </span>
        ) : (
          value
        )}
      </p>
      <p className={s.statLabel}>{label}</p>
    </div>
  );
}

function MatchRow({ match, featured = false, onMatchSelect }) {
  if (!match) return null;

  const home = getMatchValue(match, teamNamePaths.home);
  const away = getMatchValue(match, teamNamePaths.away);
  const homeLogo = getTeamLogo(match, 'home');
  const awayLogo = getTeamLogo(match, 'away');
  const matchDate = getMatchValue(
    match,
    ['status.long', 'time', 'matchDate', 'status', 'date'],
    'Upcoming',
  );
  const score = getMatchScore(match);
  const status = getMatchStatus(match);

  return (
    <div className={featured ? s.matchRowFeatured : s.matchRowDefault}>
      {!featured && <p className={s.matchDate}>{matchDate}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className={s.teamColumn}>
          <RealTeamBadge logo={homeLogo} name={home} featured={featured} />
          <span
            className={`${s.teamNameBase} ${
              featured ? s.teamNameFeatured : s.teamNameDefault
            }`}
          >
            {home}
          </span>
        </div>
        <span
          className={`${s.vsBase} ${
            featured ? s.vsFeatured : s.vsDefault
          }`}
          aria-label={score.hasScore ? 'Score' : 'versus'}
        >
          {score.display}
        </span>
        <div className={s.teamColumn}>
          <RealTeamBadge logo={awayLogo} name={away} featured={featured} />
          <span
            className={`${s.teamNameBase} ${
              featured ? s.teamNameFeatured : s.teamNameDefault
            }`}
          >
            {away}
          </span>
        </div>
        {featured && (
          <button
            type="button"
            className={s.featuredMatchButton}
            onClick={onMatchSelect ? () => onMatchSelect(match) : undefined}
            disabled={!onMatchSelect}
            aria-label={`View ${home} versus ${away}`}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      {featured && (
        <p className="mt-3 text-center text-xs font-bold text-zinc-500">
          {status}
        </p>
      )}
    </div>
  );
}

function isLiveMatch(match) {
  return /live|in.?play|half.?time/i.test(getMatchStatus(match, ''));
}

export default function Hero({
  matches = [],
  loading = false,
  onMatchSelect,
}) {
  const matchList = Array.isArray(matches) ? matches : [];
  const featuredMatch = matchList[0];
  const remainingMatches = matchList.slice(1, 4);

  return (
    <section className={s.section}>
      <div className={s.innerBg}>
        <div className={s.overlayGradient} />

        <div className={s.gridContainer}>
          <aside className={s.statsAside} aria-label="Match statistics">
            <Stat value="8.4" label="Match Rating" loading={loading} />
            <Stat value="$9.57M" label="Market Value" loading={loading} />
            <Stat value="97%" label="Pass Accuracy" loading={loading} />
          </aside>

          <div className={s.headingWrapper}>
            <h1 className={s.heading}>Football<br />Live</h1>
          </div>

          <div className={s.rightPanel}>
            {loading ? (
              <div className={s.emptyState} role="status">
                <span className="animate-pulse">Loading matches...</span>
              </div>
            ) : featuredMatch ? (
              <>
                <div className={s.featuredMatchCard}>
                  <div className={s.featuredMatchHeader}>
                    <p className={s.featuredMatchHeaderText}>
                      {isLiveMatch(featuredMatch)
                        ? 'Live match'
                        : 'Featured match'}
                    </p>
                  </div>
                  <MatchRow
                    match={featuredMatch}
                    featured
                    onMatchSelect={onMatchSelect}
                  />
                </div>

                {remainingMatches.length > 0 && (
                  <>
                    <div className={s.moreMatchesRow}>
                      <p className={s.moreMatchesLabel}>More matches</p>
                    </div>
                    <div className={s.remainingMatchesGrid}>
                      {remainingMatches.map((match, index) => (
                        <MatchRow
                          key={
                            getMatchValue(
                              match,
                              ['id', 'eventId', 'matchId'],
                              '',
                            ) || `${getMatchValue(match, teamNamePaths.home)}-${index}`
                          }
                          match={match}
                          onMatchSelect={onMatchSelect}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={s.emptyState}>
                No matches are available right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
