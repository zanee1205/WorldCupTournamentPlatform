import express from 'express';

import { authenticateAccessToken } from './authService.js';
import { clearAuthCookies, hashPassword } from './authHelpers.js';
import { UserModel } from './authModel.js';
import type { AuthUser } from '../../src/types/auth.js';
import type { UserDocument } from '../src/types/userDocument.js';

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    void (async () => {
        const auth = await authenticateAccessToken(req, res);
        if (!auth) {
            res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
            return;
        }

        res.locals.authUser = auth.user;
        res.locals.accessToken = auth.accessToken;
        next();
    })().catch((error) => {
        console.error('[auth] middleware error', error);
        clearAuthCookies(res);
        res.status(500).json({ message: 'Không thể xác thực người dùng.' });
    });
}

export function requireRole(role: 'admin' | 'user') {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authUser = res.locals.authUser as AuthUser | undefined;
        if (!authUser || authUser.role !== role) {
            res.status(403).json({ message: 'Bạn không có quyền truy cập tài nguyên này.' });
            return;
        }

        next();
    };
}

export async function ensureAdminUser() {
    if (UserModel.db.readyState !== 1) {
        return;
    }

    try {
        await UserModel.updateMany(
            { $or: [{ role: { $exists: false } }, { role: null }] },
            { $set: { role: 'user' } },
        ).exec();

        const existingAdmin = await UserModel.findOne({ role: 'admin' }).lean<UserDocument & { _id: unknown }>();
        if (existingAdmin) {
            return;
        }

        const adminUser = await UserModel.findOne({ account: 'admin' });
        if (adminUser) {
            adminUser.role = 'admin';
            adminUser.passwordHash = hashPassword('123456');
            await adminUser.save();
            return;
        }

        await UserModel.create({
            account: 'admin',
            email: 'admin@tournament.local',
            passwordHash: hashPassword('123456'),
            avatar: null,
            fullName: 'Administrator',
            phoneNumber: null,
            role: 'admin',
            failedLoginAttempts: 0,
            lockedUntil: null,
        });
    } catch (error) {
        console.error('[auth] ensureAdminUser failed', error);
    }
}
