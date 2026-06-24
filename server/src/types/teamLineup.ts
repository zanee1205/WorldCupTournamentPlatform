export interface LineupPlayer {
  playerId: string;
  apiId: number;
  name: string;
  age: number | null;
  number: number | null;
  photo: string;
  position: string;
  teamCode: string;
  teamName: string;
  teamId: number;
  group: string;
  x: number;
  y: number;
  replacements: ReplacementPlayer[];
}

export interface ReplacementPlayer {
  playerId: string;
  apiId: number;
  name: string;
  age: number | null;
  number: number | null;
  photo: string;
  position: string;
}

export interface TeamLineup {
  teamName: string;
  teamCode: string;
  group: string;
  formation: string;
  formationSource: string;
  players: LineupPlayer[];
  squadSize: number;
}
