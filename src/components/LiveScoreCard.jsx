import {
  getMatchLeague,
  getMatchStatus,
  getMatchValue,
  getTeamLogo,
  scorePaths,
} from "../service/FOOTBALLApi";
import { liveScoreCardStyles as s } from "../assets/dummyStyles";

const teamPaths = {
  home: ["home.name", "homeTeam.name", "teams.home.name", "homeTeam", "home"],
  away: ["away.name", "awayTeam.name", "teams.away.name", "awayTeam", "away"],
};

function TeamLogo({ logo, name }) {
  return (
    <div className={s.teamLogoContainer}>
      {logo ? (
        <img src={logo} alt={`${name} logo`} className={s.teamLogoImg} />
      ) : (
        name.slice(0, 3).toUpperCase()
      )}
    </div>
  );
}

export default function LiveScoreCard({ match }) {
  const homeTeam = getMatchValue(match, teamPaths.home, "Home");
  const awayTeam = getMatchValue(match, teamPaths.away, "Away");
  const homeLogo = getTeamLogo(match, "home");
  const awayLogo = getTeamLogo(match, "away");
  const homeScore = getMatchValue(match, scorePaths.home, "0");
  const awayScore = getMatchValue(match, scorePaths.away, "0");
  const league = getMatchLeague(match);
  const matchTime = getMatchValue(
    match,
    ["minute", "time.elapsed", "status.elapsed", "status"],
    getMatchStatus(match, "Live"),
  );

  return (
    <article className={s.card}>
      <div className={s.glowRed} />
      <div className={s.glowBlue} />

      <div className={s.header}>
        <p className={s.leagueText}>{league}</p>
        <div className={s.liveBadge}>
          <span className={s.liveDot} aria-hidden="true" />
          <span className={s.liveText}>{matchTime === "Live" ? "LIVE" : String(matchTime)}</span>
        </div>
      </div>

      <div className={s.teamsGrid}>
        <div className={s.teamColumn}>
          <TeamLogo logo={homeLogo} name={homeTeam} />
          <p className={s.teamName}>{homeTeam}</p>
        </div>

        <div className={s.scoreBox}>
          <p className={s.scoreText}>
            {homeScore}
            <span className={s.colon}>:</span>
            {awayScore}
          </p>
        </div>

        <div className={s.teamColumn}>
          <TeamLogo logo={awayLogo} name={awayTeam} />
          <p className={s.teamName}>{awayTeam}</p>
        </div>
      </div>

      <div className={s.divider} />
      <p className={s.footerText}>{getMatchStatus(match, "Match Day")}</p>
    </article>
  );
}