export interface ScheduleConstraints {
  startDate: string;
  startTime: string;
  roundIntervalDays: number;
  gameSpacingMinutes: number;
  maxGamesPerDay: number;
  blackoutDates: string[];
  includeReverseFixtures: boolean;
}

export interface ScheduledGame {
  round: number;
  gameNumber: number;
  homeTeam: string;
  awayTeam: string;
  scheduledAt: string;
}

export interface GeneratedSchedule {
  teamCount: number;
  roundCount: number;
  gameCount: number;
  byesPerRound: number;
  games: ScheduledGame[];
}

interface RoundPair {
  homeTeam: string;
  awayTeam: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function nextNonBlackoutDay(date: Date, blackout: Set<string>): Date {
  let candidate = startOfDay(date);
  while (blackout.has(toIsoDate(candidate))) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function uniqueTeams(rawTeams: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of rawTeams) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function buildRounds(teams: string[]): RoundPair[][] {
  const rotation = [...teams];
  const rounds: RoundPair[][] = [];

  const needsBye = rotation.length % 2 !== 0;
  if (needsBye) {
    rotation.push("BYE");
  }

  const participantCount = rotation.length;
  const roundCount = participantCount - 1;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const pairs: RoundPair[] = [];
    for (let i = 0; i < participantCount / 2; i += 1) {
      const left = rotation[i];
      const right = rotation[participantCount - 1 - i];

      if (left === "BYE" || right === "BYE") {
        continue;
      }

      const shouldFlip = (roundIndex + i) % 2 === 0;
      pairs.push({
        homeTeam: shouldFlip ? left : right,
        awayTeam: shouldFlip ? right : left,
      });
    }

    rounds.push(pairs);

    const fixed = rotation[0];
    const moving = rotation.slice(1);
    moving.unshift(moving.pop() ?? "");
    rotation.splice(0, rotation.length, fixed, ...moving);
  }

  return rounds;
}

export function generateRoundRobinSchedule(
  rawTeams: string[],
  constraints: ScheduleConstraints,
): GeneratedSchedule {
  const teams = uniqueTeams(rawTeams);
  if (teams.length < 2) {
    return {
      teamCount: teams.length,
      roundCount: 0,
      gameCount: 0,
      byesPerRound: teams.length % 2 === 0 ? 0 : 1,
      games: [],
    };
  }

  const baseRounds = buildRounds(teams);
  const allRounds = constraints.includeReverseFixtures
    ? [
        ...baseRounds,
        ...baseRounds.map((round) =>
          round.map((pair) => ({
            homeTeam: pair.awayTeam,
            awayTeam: pair.homeTeam,
          })),
        ),
      ]
    : baseRounds;

  const blackoutSet = new Set(constraints.blackoutDates.filter(Boolean));
  const scheduled: ScheduledGame[] = [];

  let roundAnchor = parseDateTime(constraints.startDate, constraints.startTime);
  let gameNumber = 1;

  for (let roundIndex = 0; roundIndex < allRounds.length; roundIndex += 1) {
    const round = allRounds[roundIndex];
    let roundDay = nextNonBlackoutDay(roundAnchor, blackoutSet);
    let gamesScheduledOnDay = 0;

    for (const pair of round) {
      if (gamesScheduledOnDay >= constraints.maxGamesPerDay) {
        roundDay = nextNonBlackoutDay(addDays(roundDay, 1), blackoutSet);
        gamesScheduledOnDay = 0;
      }

      const gameDateTime = new Date(roundDay);
      gameDateTime.setHours(0, 0, 0, 0);

      const [baseHour, baseMinute] = constraints.startTime.split(":").map((value) => Number(value));
      const offset = gamesScheduledOnDay * constraints.gameSpacingMinutes;
      const totalMinutes = baseHour * 60 + baseMinute + offset;
      gameDateTime.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);

      scheduled.push({
        round: roundIndex + 1,
        gameNumber,
        homeTeam: pair.homeTeam,
        awayTeam: pair.awayTeam,
        scheduledAt: gameDateTime.toISOString(),
      });

      gameNumber += 1;
      gamesScheduledOnDay += 1;
    }

    roundAnchor = addDays(roundDay, Math.max(1, constraints.roundIntervalDays));
  }

  return {
    teamCount: teams.length,
    roundCount: allRounds.length,
    gameCount: scheduled.length,
    byesPerRound: teams.length % 2 === 0 ? 0 : 1,
    games: scheduled,
  };
}
