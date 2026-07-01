import express from 'express';
import mongoose from 'mongoose';

import { buildScoreBreakdown } from '../../shared/scoring.js';
import { UserModel, PERMANENT_LOCK_DATE } from './authModel.js';
import { createUser, refreshAccessToken, toAuthResponse } from './authService.js';
import { clearAuthCookies, hashPassword, issueAuthTokens, normalizeIdentifier, sanitizeUser, setAuthCookies, verifyPassword } from './authHelpers.js';
import { requireAuth, requireRole } from './authMiddleware.js';
import type { MatchStage } from '../../src/types/matchstage.js';
import type { MatchResult } from '../src/types/resultInput.js';
import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../../src/types/auth.js';
import type { UserDocument } from '../src/types/userDocument.js';
import type { PasswordChangeRequestDocument, RawMatchDocument, UnlockRequestDocument, UserPredictionDocument } from './authTypes.js';

export function createAuthRouter() {
    const router = express.Router();

    router.post('/register', async (req, res) => {
        try {
            const payload = req.body as Partial<AuthRegisterInput>;
            const user = await createUser({
                account: typeof payload.account === 'string' ? payload.account : '',
                email: typeof payload.email === 'string' ? payload.email : '',
                password: typeof payload.password === 'string' ? payload.password : '',
                avatar: typeof payload.avatar === 'string' ? payload.avatar : '',
                fullName: typeof payload.fullName === 'string' ? payload.fullName : '',
                phoneNumber: typeof payload.phoneNumber === 'string' ? payload.phoneNumber : '',
            });

            const tokens = issueAuthTokens(user);
            setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
            res.status(201).json(toAuthResponse({ user, ...tokens }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Không thể đăng ký.';
            const status = message.includes('tồn tại') ? 409 : 400;
            clearAuthCookies(res);
            res.status(status).json({ message });
        }
    });

    router.post('/login', async (req, res) => {
        try {
            const payload = req.body as Partial<AuthLoginInput>;
            const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
            const password = typeof payload.password === 'string' ? payload.password : '';

            if (!identifier || !password) {
                clearAuthCookies(res);
                res.status(400).json({ message: 'Thiếu thông tin đăng nhập.' });
                return;
            }

            const user = await UserModel.findOne({
                $or: [{ account: normalizeIdentifier(identifier) }, { email: normalizeIdentifier(identifier) }],
            });

            if (!user) {
                clearAuthCookies(res);
                res.status(401).json({ message: 'Sai tài khoản/email hoặc mật khẩu.' });
                return;
            }

            if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
                const lockedUntilIso = user.lockedUntil.toISOString();
                clearAuthCookies(res);

                const isPermanent = user.lockedUntil.getTime() >= PERMANENT_LOCK_DATE.getTime();
                if (isPermanent) {
                    res.status(423).json({
                        message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Admin website để mở khóa tài khoản.',
                        lockedUntil: lockedUntilIso,
                        lockType: 'permanent',
                        allowUnlockRequest: true,
                    });
                } else {
                    res.status(423).json({
                        message: 'Tài khoản đã bị khóa.',
                        lockedUntil: lockedUntilIso,
                        lockType: 'temporary',
                    });
                }
                return;
            }

            if (!user.passwordHash || !user.passwordHash.length) {
                clearAuthCookies(res);
                res.status(401).json({ message: 'Sai tài khoản/email hoặc mật khẩu.' });
                return;
            }

            if (!verifyPassword(password, user.passwordHash)) {
                user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
                const remaining = Math.max(0, 5 - user.failedLoginAttempts);

                if (user.failedLoginAttempts >= 5) {
                    user.lockedUntil = PERMANENT_LOCK_DATE;
                }

                await user.save();

                clearAuthCookies(res);

                if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
                    const lockedUntilIso = user.lockedUntil.toISOString();
                    const isPermanent = user.lockedUntil.getTime() >= PERMANENT_LOCK_DATE.getTime();
                    if (isPermanent) {
                        res.status(423).json({
                            message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Admin website để mở khóa tài khoản.',
                            lockedUntil: lockedUntilIso,
                            lockType: 'permanent',
                            allowUnlockRequest: true,
                        });
                    } else {
                        res.status(423).json({
                            message: 'Tài khoản đã bị khóa do quá nhiều lần đăng nhập thất bại.',
                            lockedUntil: lockedUntilIso,
                            lockType: 'temporary',
                        });
                    }
                    return;
                }

                res.status(401).json({ message: 'Sai tài khoản/email hoặc mật khẩu.', failedAttempts: user.failedLoginAttempts, remainingAttempts: remaining });
                return;
            }

            user.failedLoginAttempts = 0;
            user.lockedUntil = null;
            await user.save();

            const authUser = sanitizeUser(user);
            const tokens = issueAuthTokens(authUser);
            setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
            res.json(toAuthResponse({ user: authUser, ...tokens }));
        } catch {
            clearAuthCookies(res);
            res.status(500).json({ message: 'Không thể đăng nhập.' });
        }
    });

    router.get('/me', requireAuth, (_req, res) => {
        res.json(toAuthResponse({
            user: res.locals.authUser,
            accessToken: res.locals.accessToken,
        }));
    });

    router.get('/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
        try {
            const query = UserModel.find({ role: { $ne: 'admin' } }).sort({ account: 1 });
            const users = (await query.lean().exec()) as Array<UserDocument & { _id: unknown }>;
            const sanitizedUsers = users.map((user) => sanitizeUser(user));
            res.json({ users: sanitizedUsers, count: sanitizedUsers.length });
        } catch (error) {
            console.error('[auth] admin users failed', error);
            res.status(500).json({ message: 'Không thể tải danh sách người dùng.' });
        }
    });

    router.post('/password-change-requests', requireAuth, async (req, res) => {
        try {
            const payload = req.body as { newPassword?: string; reason?: string };
            const newPassword = String(payload.newPassword || '').trim();
            if (newPassword.length < 6) {
                res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
                return;
            }

            const requestCollection = mongoose.connection.collection<PasswordChangeRequestDocument>('passwordchangerequests');
            const userId = String(res.locals.authUser?.id || '');
            if (!userId) {
                res.status(401).json({ message: 'Không xác thực được người dùng.' });
                return;
            }

            const existing = await requestCollection.findOne({ userId, status: 'pending' });
            if (existing) {
                res.status(400).json({ message: 'Bạn đã có yêu cầu đổi mật khẩu đang chờ duyệt.' });
                return;
            }

            const newPasswordHash = hashPassword(newPassword);
            const request: PasswordChangeRequestDocument = {
                userId,
                userAccount: String(res.locals.authUser?.account || ''),
                requestedAt: new Date().toISOString(),
                status: 'pending',
                newPasswordHash,
                processedAt: null,
                processedBy: null,
                reason: payload.reason?.trim() || null,
            };

            const result = await requestCollection.insertOne(request);
            res.json({ ok: true, requestId: String(result.insertedId) });
        } catch (error) {
            console.error('[auth] create password change request failed', error);
            res.status(500).json({ message: 'Không thể gửi yêu cầu đổi mật khẩu.' });
        }
    });

    router.post('/unlock-requests', async (req, res) => {
        try {
            const payload = req.body as { identifier?: string; reason?: string };
            const identifier = typeof payload.identifier === 'string' ? normalizeIdentifier(payload.identifier) : '';
            if (!identifier) {
                res.status(400).json({ message: 'Vui lòng cung cấp tài khoản hoặc email.' });
                return;
            }

            const user = await UserModel.findOne({
                $or: [{ account: identifier }, { email: identifier }],
            }).lean<UserDocument & { _id: unknown }>();

            if (!user || user.role === 'admin') {
                res.status(404).json({ message: 'Không tìm thấy tài khoản hợp lệ.' });
                return;
            }

            if (!user.lockedUntil || user.lockedUntil.getTime() <= Date.now()) {
                res.status(400).json({ message: 'Tài khoản không ở trạng thái bị khóa vĩnh viễn.' });
                return;
            }

            const isPermanent = user.lockedUntil.getTime() >= PERMANENT_LOCK_DATE.getTime();
            if (!isPermanent) {
                res.status(400).json({ message: 'Yêu cầu mở khóa chỉ dành cho tài khoản bị khóa vĩnh viễn.' });
                return;
            }

            const unlockRequestCollection = mongoose.connection.collection<UnlockRequestDocument>('unlockrequests');
            const existingUnlockRequest = await unlockRequestCollection.findOne({ userId: String(user._id), status: 'pending' });
            if (existingUnlockRequest) {
                res.status(400).json({ message: 'Bạn đã có yêu cầu mở khóa đang chờ duyệt.' });
                return;
            }

            const unlockRequest: UnlockRequestDocument = {
                userId: String(user._id),
                userAccount: user.account,
                requestedAt: new Date().toISOString(),
                status: 'pending',
                reason: payload.reason?.trim() || null,
            };

            const unlockResult = await unlockRequestCollection.insertOne(unlockRequest);
            res.json({ ok: true, requestId: String(unlockResult.insertedId) });
        } catch (error) {
            console.error('[auth] create unlock request failed', error);
            res.status(500).json({ message: 'Không thể gửi yêu cầu mở khóa.' });
        }
    });

    router.get('/admin/password-change-requests', requireAuth, requireRole('admin'), async (_req, res) => {
        try {
            const requestCollection = mongoose.connection.collection<PasswordChangeRequestDocument>('passwordchangerequests');
            const requests = await requestCollection.find({ status: 'pending' }).sort({ requestedAt: -1 }).toArray();
            res.json({
                requests: requests.map((request) => ({
                    id: String(request._id),
                    userId: request.userId,
                    userAccount: request.userAccount,
                    requestedAt: request.requestedAt,
                    status: request.status,
                    reason: request.reason ?? null,
                })),
            });
        } catch (error) {
            console.error('[auth] list password change requests failed', error);
            res.status(500).json({ message: 'Không thể tải danh sách yêu cầu đổi mật khẩu.' });
        }
    });

    router.get('/admin/unlock-requests', requireAuth, requireRole('admin'), async (_req, res) => {
        try {
            const requestCollection = mongoose.connection.collection<UnlockRequestDocument>('unlockrequests');
            const requests = await requestCollection.find({ status: 'pending' }).sort({ requestedAt: -1 }).toArray();
            res.json({
                requests: requests.map((request) => ({
                    id: String(request._id),
                    userId: request.userId,
                    userAccount: request.userAccount,
                    requestedAt: request.requestedAt,
                    status: request.status,
                    reason: request.reason ?? null,
                })),
            });
        } catch (error) {
            console.error('[auth] list unlock requests failed', error);
            res.status(500).json({ message: 'Không thể tải danh sách yêu cầu mở khóa.' });
        }
    });

    router.patch('/admin/password-change-requests/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const requestId = String(req.params.id || '');
            if (!requestId) {
                res.status(400).json({ message: 'ID yêu cầu không hợp lệ.' });
                return;
            }

            const requestCollection = mongoose.connection.collection<PasswordChangeRequestDocument>('passwordchangerequests');
            const request = await requestCollection.findOne({ _id: new mongoose.Types.ObjectId(requestId), status: 'pending' });
            if (!request) {
                res.status(404).json({ message: 'Không tìm thấy yêu cầu đổi mật khẩu.' });
                return;
            }

            const updatedUser = await UserModel.findByIdAndUpdate(
                request.userId,
                {
                    passwordHash: request.newPasswordHash,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
                { new: true, runValidators: true },
            ).lean<UserDocument & { _id: unknown }>();

            if (!updatedUser) {
                res.status(404).json({ message: 'Không tìm thấy người dùng liên quan đến yêu cầu.' });
                return;
            }

            await requestCollection.updateOne(
                { _id: new mongoose.Types.ObjectId(requestId) },
                {
                    $set: {
                        status: 'approved',
                        processedAt: new Date().toISOString(),
                        processedBy: String(res.locals.authUser?.id || ''),
                    },
                },
            );

            res.json({ ok: true });
        } catch (error) {
            console.error('[auth] approve password change request failed', error);
            res.status(500).json({ message: 'Không thể duyệt yêu cầu đổi mật khẩu.' });
        }
    });

    router.patch('/admin/password-change-requests/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const requestId = String(req.params.id || '');
            if (!requestId) {
                res.status(400).json({ message: 'ID yêu cầu không hợp lệ.' });
                return;
            }

            const requestCollection = mongoose.connection.collection<PasswordChangeRequestDocument>('passwordchangerequests');
            const request = await requestCollection.findOne({ _id: new mongoose.Types.ObjectId(requestId), status: 'pending' });
            if (!request) {
                res.status(404).json({ message: 'Không tìm thấy yêu cầu đổi mật khẩu.' });
                return;
            }

            await requestCollection.updateOne(
                { _id: new mongoose.Types.ObjectId(requestId) },
                {
                    $set: {
                        status: 'rejected',
                        processedAt: new Date().toISOString(),
                        processedBy: String(res.locals.authUser?.id || ''),
                    },
                },
            );

            res.json({ ok: true });
        } catch (error) {
            console.error('[auth] reject password change request failed', error);
            res.status(500).json({ message: 'Không thể từ chối yêu cầu đổi mật khẩu.' });
        }
    });

    router.patch('/admin/unlock-requests/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const requestId = String(req.params.id || '');
            if (!requestId) {
                res.status(400).json({ message: 'ID yêu cầu không hợp lệ.' });
                return;
            }

            const requestCollection = mongoose.connection.collection<UnlockRequestDocument>('unlockrequests');
            const request = await requestCollection.findOne({ _id: new mongoose.Types.ObjectId(requestId), status: 'pending' });
            if (!request) {
                res.status(404).json({ message: 'Không tìm thấy yêu cầu mở khóa.' });
                return;
            }

            const updatedUser = await UserModel.findByIdAndUpdate(
                request.userId,
                {
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
                { new: true, runValidators: true },
            ).lean<UserDocument & { _id: unknown }>();

            if (!updatedUser) {
                res.status(404).json({ message: 'Không tìm thấy người dùng liên quan đến yêu cầu.' });
                return;
            }

            await requestCollection.updateOne(
                { _id: new mongoose.Types.ObjectId(requestId) },
                {
                    $set: {
                        status: 'approved',
                        processedAt: new Date().toISOString(),
                        processedBy: String(res.locals.authUser?.id || ''),
                    },
                },
            );

            res.json({ ok: true });
        } catch (error) {
            console.error('[auth] approve unlock request failed', error);
            res.status(500).json({ message: 'Không thể duyệt yêu cầu mở khóa.' });
        }
    });

    router.patch('/admin/unlock-requests/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const requestId = String(req.params.id || '');
            if (!requestId) {
                res.status(400).json({ message: 'ID yêu cầu không hợp lệ.' });
                return;
            }

            const requestCollection = mongoose.connection.collection<UnlockRequestDocument>('unlockrequests');
            const request = await requestCollection.findOne({ _id: new mongoose.Types.ObjectId(requestId), status: 'pending' });
            if (!request) {
                res.status(404).json({ message: 'Không tìm thấy yêu cầu mở khóa.' });
                return;
            }

            await requestCollection.updateOne(
                { _id: new mongoose.Types.ObjectId(requestId) },
                {
                    $set: {
                        status: 'rejected',
                        processedAt: new Date().toISOString(),
                        processedBy: String(res.locals.authUser?.id || ''),
                    },
                },
            );

            res.json({ ok: true });
        } catch (error) {
            console.error('[auth] reject unlock request failed', error);
            res.status(500).json({ message: 'Không thể từ chối yêu cầu mở khóa.' });
        }
    });

    router.get('/admin/dashboard', requireAuth, requireRole('admin'), async (_req, res) => {
        try {
            const users = (await UserModel.find({ role: { $ne: 'admin' } }).sort({ account: 1 }).lean().exec()) as Array<UserDocument & { _id: unknown }>;
            const userIds = users.map((user) => String(user._id));
            const predictionCollection = mongoose.connection.collection<UserPredictionDocument>('userpredictions');
            const matchCollection = mongoose.connection.collection<RawMatchDocument>('tournamentmatches');
            const [predictions, matches] = await Promise.all([
                predictionCollection.find({ userId: { $in: userIds } }).toArray(),
                matchCollection.find({}).toArray(),
            ]);

            const matchById = new Map<number, RawMatchDocument>();
            for (const match of matches) {
                if (typeof match?.id === 'number') {
                    matchById.set(match.id, match);
                }
            }

            const leaderboardMap = new Map<string, { exactPoints: number; stagePoints: number; totalPoints: number; predictedMatches: number }>();
            for (const prediction of predictions) {
                const userId = String(prediction.userId);
                const stats = leaderboardMap.get(userId) ?? { exactPoints: 0, stagePoints: 0, totalPoints: 0, predictedMatches: 0 };
                stats.predictedMatches += 1;

                const match = matchById.get(Number(prediction.matchId));
                if (match?.result && match.stage) {
                    try {
                        const normalizedResult = match.result as MatchResult;
                        const score = buildScoreBreakdown(match.stage, prediction, normalizedResult);
                        stats.exactPoints += score.exactPoints ?? 0;
                        stats.stagePoints += score.stagePoints ?? 0;
                        stats.totalPoints += score.totalPoints ?? 0;
                    } catch {
                        // ignore invalid stage or scoring error
                    }
                }

                leaderboardMap.set(userId, stats);
            }

            const leaderboard = users.map((user) => {
                const stats = leaderboardMap.get(String(user._id)) ?? { exactPoints: 0, stagePoints: 0, totalPoints: 0, predictedMatches: 0 };
                return {
                    id: String(user._id),
                    account: user.account,
                    fullName: user.fullName ?? null,
                    exactPoints: stats.exactPoints,
                    stagePoints: stats.stagePoints,
                    totalPoints: stats.totalPoints,
                    predictedMatches: stats.predictedMatches,
                };
            }).sort((left, right) =>
                right.totalPoints - left.totalPoints ||
                right.stagePoints - left.stagePoints ||
                right.exactPoints - left.exactPoints ||
                right.predictedMatches - left.predictedMatches ||
                left.account.localeCompare(right.account, 'vi'),
            );

            const lockedUsers = users.filter((user) => user.lockedUntil && user.lockedUntil.getTime() > Date.now()).length;
            const usersWithPredictions = Array.from(leaderboardMap.values()).filter((item) => item.predictedMatches > 0).length;

            res.json({
                stats: {
                    totalUsers: users.length,
                    totalPredictions: predictions.length,
                    lockedUsers,
                    usersWithPredictions,
                },
                leaderboard,
            });
        } catch (error) {
            console.error('[auth] admin dashboard failed', error);
            res.status(500).json({ message: 'Không thể tải dữ liệu dashboard quản trị.' });
        }
    });

    router.patch('/admin/users/:id/lock', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const userId = String(req.params.id || '');
            if (!userId) {
                res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
                return;
            }

            const updated = await UserModel.findByIdAndUpdate(
                userId,
                {
                    failedLoginAttempts: 5,
                    lockedUntil: PERMANENT_LOCK_DATE,
                },
                { new: true, runValidators: true },
            ).lean<UserDocument & { _id: unknown }>();

            if (!updated) {
                res.status(404).json({ message: 'Không tìm thấy người dùng.' });
                return;
            }

            res.json({ ok: true, user: sanitizeUser(updated) });
        } catch (error) {
            console.error('[auth] lock user failed', error);
            res.status(500).json({ message: 'Không thể khóa tài khoản.' });
        }
    });

    router.patch('/admin/users/:id/unlock', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const userId = String(req.params.id || '');
            if (!userId) {
                res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
                return;
            }

            const updated = await UserModel.findByIdAndUpdate(
                userId,
                {
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
                { new: true, runValidators: true },
            ).lean<UserDocument & { _id: unknown }>();

            if (!updated) {
                res.status(404).json({ message: 'Không tìm thấy người dùng.' });
                return;
            }

            res.json({ ok: true, user: sanitizeUser(updated) });
        } catch (error) {
            console.error('[auth] unlock user failed', error);
            res.status(500).json({ message: 'Không thể mở khóa tài khoản.' });
        }
    });

    router.delete('/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
        try {
            const userId = String(req.params.id || '');
            if (!userId) {
                res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
                return;
            }

            const deleted = await UserModel.findByIdAndDelete(userId).lean<UserDocument & { _id: unknown }>();
            if (!deleted) {
                res.status(404).json({ message: 'Không tìm thấy người dùng.' });
                return;
            }

            res.json({ ok: true });
        } catch (error) {
            console.error('[auth] delete user failed', error);
            res.status(500).json({ message: 'Không thể xóa tài khoản.' });
        }
    });

    router.patch('/me', requireAuth, async (req, res) => {
        try {
            const payload = req.body as Partial<AuthProfileUpdateInput>;
            const updates: Partial<UserDocument> = {};

            if (typeof payload.avatar === 'string') {
                updates.avatar = payload.avatar.trim() || null;
            } else if (payload.avatar === null) {
                updates.avatar = null;
            }

            if (typeof payload.fullName === 'string') {
                updates.fullName = payload.fullName.trim() || null;
            } else if (payload.fullName === null) {
                updates.fullName = null;
            }

            if (typeof payload.phoneNumber === 'string') {
                updates.phoneNumber = payload.phoneNumber.trim() || null;
            } else if (payload.phoneNumber === null) {
                updates.phoneNumber = null;
            }

            const updated = await UserModel.findByIdAndUpdate(
                res.locals.authUser.id,
                { $set: updates },
                { new: true, runValidators: true },
            ).lean<UserDocument & { _id: unknown }>();

            if (!updated) {
                clearAuthCookies(res);
                res.status(404).json({ message: 'Không tìm thấy người dùng.' });
                return;
            }

            const authUser = sanitizeUser(updated);
            res.json(toAuthResponse({
                user: authUser,
                accessToken: res.locals.accessToken,
            }));
        } catch (error) {
            console.error('[auth] profile update failed', error);
            res.status(500).json({ message: 'Không thể cập nhật hồ sơ.' });
        }
    });

    router.post('/refreshNewToken', async (req, res) => {
        try {
            const auth = await refreshAccessToken(req, res);
            if (!auth) {
                res.status(401).json({ message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.' });
                return;
            }

            res.json(toAuthResponse({
                user: auth.user,
                accessToken: auth.accessToken,
            }));
        } catch (error) {
            console.error('[auth] refresh token error', error);
            clearAuthCookies(res);
            res.status(500).json({ message: 'Không thể refresh token.' });
        }
    });

    router.post('/logout', (_req, res) => {
        clearAuthCookies(res);
        res.json({ ok: true });
    });

    return router;
}

