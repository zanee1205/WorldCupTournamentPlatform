import crypto from 'crypto';
import express from 'express';

import type { AuthUser } from '../../src/types/auth.js';
import type { JwtPayload, AuthTokenType } from '../src/types/jwtPayload.js';
import type { UserDocument } from '../src/types/userDocument.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 10 * 60;
export const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-access-secret';
export const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-refresh-secret';
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = 'sha512';

export function normalizeIdentifier(value: string) {
    return value.trim().toLowerCase();
}

function base64UrlEncode(value: string | Buffer) {
    return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresInSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresInSeconds;
    const tokenPayload: JwtPayload = {
        ...payload,
        iat: now,
        exp,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

    return {
        token: `${encodedHeader}.${encodedPayload}.${signature}`,
        expiresAt: new Date(exp * 1000).toISOString(),
    };
}

export function verifyJwt(token: string, secret: string, expectedType: AuthTokenType): JwtPayload | null {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
        return null;
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');

        const isValidSignature =
            expectedSignature.length === signature.length &&
            crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

        if (!isValidSignature) {
            return null;
        }

        const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;
        if (payload.tokenType !== expectedType) {
            return null;
        }

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
    const derived = crypto
        .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
        .toString('hex');

    return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
    const [scheme, iterationsText, salt, hash] = passwordHash.split('$');
    if (scheme !== 'pbkdf2' || !iterationsText || !salt || !hash) {
        return false;
    }

    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations <= 0) {
        return false;
    }

    const derived = crypto
        .pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
        .toString('hex');

    if (derived.length !== hash.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(derived, 'utf8'), Buffer.from(hash, 'utf8'));
}

export function getCookieValue(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return null;

    const match = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    if (!match) return null;

    return decodeURIComponent(match.slice(name.length + 1));
}

export function cookieOptions(maxAgeMs: number) {
    const secure = String(process.env.COOKIE_SECURE ?? '').toLowerCase() === 'true' || process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : 'lax';

    return {
        httpOnly: true,
        secure,
        sameSite: sameSite as 'none' | 'lax',
        path: '/',
        maxAge: maxAgeMs,
    };
}

export function setAuthCookies(response: express.Response, accessToken: string, refreshToken: string) {
    response.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
    response.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000));
}

export function setAccessCookie(response: express.Response, accessToken: string) {
    response.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
}

export function clearAuthCookies(response: express.Response) {
    const options = cookieOptions(0);
    response.clearCookie(ACCESS_COOKIE, options);
    response.clearCookie(REFRESH_COOKIE, options);
}

export function toIsoString(value?: Date | string | null) {
    if (!value) {
        return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function sanitizeUser(user: UserDocument & { _id: unknown }): AuthUser {
    return {
        id: String(user._id),
        account: user.account,
        email: user.email,
        avatar: user.avatar ?? null,
        fullName: user.fullName ?? null,
        phoneNumber: user.phoneNumber ?? null,
        role: user.role ?? 'user',
        createdAt: toIsoString(user.createdAt),
        updatedAt: toIsoString(user.updatedAt),
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        lockedUntil: toIsoString(user.lockedUntil) ?? null,
    };
}

export function issueAuthTokens(user: AuthUser) {
    const access = signJwt(
        {
            sub: user.id,
            account: user.account,
            email: user.email,
            tokenType: 'access',
        },
        process.env.JWT_ACCESS_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-access-secret',
        ACCESS_TOKEN_TTL_SECONDS,
    );

    const refresh = signJwt(
        {
            sub: user.id,
            account: user.account,
            email: user.email,
            tokenType: 'refresh',
        },
        process.env.JWT_REFRESH_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-refresh-secret',
        REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
        accessToken: access.token,
        refreshToken: refresh.token,
    };
}
