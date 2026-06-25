import type { OpenFootballMatch } from './worldcupMatchCore';

export type OpenFootballJson = {
    stage?: Record<string, OpenFootballMatch[]>;
    matches?: OpenFootballMatch[];
    [key: string]: unknown;
}