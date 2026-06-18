export interface GroupStandingTeam {
  rank: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface GroupStandingBoard {
  groupLabel: string;
  teams: GroupStandingTeam[];
}
