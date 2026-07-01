import type { OpenFootballMatch } from './worldcupMatchCore.js';

export type OpenFootballJson = {
    stage?: Record<string, OpenFootballMatch[]>;
    matches?: OpenFootballMatch[];
    [key: string]: unknown;
}