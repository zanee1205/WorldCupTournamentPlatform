export interface AdminUserStats {
    totalUsers: number;
    totalPredictions: number;
    lockedUsers: number;
    usersWithPredictions: number;
}

export interface AdminLeaderboardUser {
    id: string;
    account: string;
    fullName?: string | null;
    exactPoints: number;
    stagePoints: number;
    totalPoints: number;
    predictedMatches: number;
}

export interface AdminDashboardResponse {
    stats: AdminUserStats;
    leaderboard: AdminLeaderboardUser[];
}

export interface AdminPasswordChangeRequest {
    id: string;
    userId: string;
    userAccount: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string | null;
}

export interface AdminUnlockRequest {
    id: string;
    userId: string;
    userAccount: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string | null;
}

export interface AdminUser extends Record<string, unknown> {
    id: string;
    account: string;
    email: string;
    avatar?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    role: 'user' | 'admin';
    createdAt?: string;
    updatedAt?: string;
    failedLoginAttempts: number;
    lockedUntil: string | null;
}
