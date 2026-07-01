import express from 'express';
import mongoose from 'mongoose';

import { UserModel, PERMANENT_LOCK_DATE } from './authModel.js';
import {
    ACCESS_COOKIE,
    ACCESS_SECRET,
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_COOKIE,
    REFRESH_SECRET,
    cookieOptions,
    clearAuthCookies,
    getCookieValue,
    hashPassword,
    normalizeIdentifier,
    sanitizeUser,
    signJwt,
    verifyJwt,
} from './authHelpers.js';
import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../../src/types/auth.js';
import type { JwtPayload } from '../src/types/jwtPayload.js';
import type { UserDocument } from '../src/types/userDocument.js';

export type AuthResult = {
    user: AuthUser;
    accessToken: string;
};

export function toAuthResponse(result: AuthResult): AuthSessionResponse {
    return {
        user: result.user,
        accessToken: result.accessToken,
    };
}

export async function findUserByIdentifier(identifier: string) {
    const normalized = normalizeIdentifier(identifier);
    return UserModel.findOne({
        $or: [{ account: normalized }, { email: normalized }],
    }).lean<UserDocument & { _id: unknown }>();
}

export async function createUser(payload: AuthRegisterInput) {
    const account = normalizeIdentifier(payload.account);
    const email = normalizeIdentifier(payload.email);
    const password = payload.password.trim();
    const avatar = typeof payload.avatar === 'string' ? payload.avatar.trim() : '';
    const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
    const phoneNumber = typeof payload.phoneNumber === 'string' ? payload.phoneNumber.trim() : '';

    if (!account || !email || !password) {
        throw new Error('Thiếu thông tin đăng ký.');
    }

    if (password.length < 6) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Email không hợp lệ.');
    }

    const existing = await UserModel.findOne({
        $or: [{ account }, { email }],
    }).lean<UserDocument & { _id: unknown }>();

    if (existing) {
        throw new Error('Tài khoản hoặc Email đã tồn tại. Vui lòng thử lại.');
    }

    const created = await UserModel.create({
        account,
        email,
        passwordHash: hashPassword(password),
        avatar: avatar || null,
        fullName: fullName || null,
        phoneNumber: phoneNumber || null,
        role: 'user',
        failedLoginAttempts: 0,
        lockedUntil: null,
    });

    return sanitizeUser(created.toObject() as UserDocument & { _id: unknown });
}

export async function authenticateAccessToken(req: express.Request, res: express.Response): Promise<AuthResult | null> {
    const accessToken = getCookieValue(req.headers.cookie, ACCESS_COOKIE);
    if (!accessToken) {
        return null;
    }

    const accessPayload = verifyJwt(decodeURIComponent(accessToken), ACCESS_SECRET, 'access');
    if (!accessPayload) {
        return null;
    }

    const user = await UserModel.findById(accessPayload.sub).lean<UserDocument & { _id: unknown }>();
    if (!user) {
        clearAuthCookies(res);
        return null;
    }

    return {
        user: sanitizeUser(user),
        accessToken: decodeURIComponent(accessToken),
    };
}

export async function refreshAccessToken(req: express.Request, res: express.Response): Promise<AuthResult | null> {
    const refreshToken = getCookieValue(req.headers.cookie, REFRESH_COOKIE);
    if (!refreshToken) {
        return null;
    }

    const refreshPayload = verifyJwt(decodeURIComponent(refreshToken), REFRESH_SECRET, 'refresh');
    if (!refreshPayload) {
        clearAuthCookies(res);
        return null;
    }

    const user = await UserModel.findById(refreshPayload.sub).lean<UserDocument & { _id: unknown }>();
    if (!user) {
        clearAuthCookies(res);
        return null;
    }

    const authUser = sanitizeUser(user);
    const access = signJwt(
        {
            sub: authUser.id,
            account: authUser.account,
            email: authUser.email,
            tokenType: 'access',
        },
        ACCESS_SECRET,
        ACCESS_TOKEN_TTL_SECONDS,
    );

    res.cookie(ACCESS_COOKIE, access.token, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
    res.setHeader('x-access-token', access.token);

    console.log('[auth] refresh token issued new access token', access.token);

    return {
        user: authUser,
        accessToken: access.token,
    };
}
