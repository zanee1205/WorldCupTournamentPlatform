import mongoose from 'mongoose';
import type { AuthUser } from '../../src/types/auth.js';
import type { MatchStage } from '../../src/types/matchstage.js';

export type AuthResult = {
    user: AuthUser;
    accessToken: string;
};

export type UserPredictionDocument = {
    userId: string;
    matchId: number;
    predictedHomeScore: number;
    predictedAwayScore: number;
    updatedAt: string;
};

export type PasswordChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export type PasswordChangeRequestDocument = {
    _id?: mongoose.Types.ObjectId;
    userId: string;
    userAccount: string;
    requestedAt: string;
    status: PasswordChangeRequestStatus;
    newPasswordHash: string;
    processedAt?: string | null;
    processedBy?: string | null;
    reason?: string | null;
};

export type UnlockRequestDocument = {
    _id?: mongoose.Types.ObjectId;
    userId: string;
    userAccount: string;
    requestedAt: string;
    status: PasswordChangeRequestStatus;
    reason?: string | null;
    processedAt?: string | null;
    processedBy?: string | null;
};

export type RawMatchDocument = {
    id: number;
    stage: MatchStage;
    result?: {
        actualHomeScore: number;
        actualAwayScore: number;
        halftimeHomeScore?: number;
        halftimeAwayScore?: number;
        goals?: Array<{ team: string; player: string; minute?: number | string }>;
        updatedAt: string;
    } | null;
};
