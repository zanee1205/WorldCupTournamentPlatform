import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';

import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../../src/types/auth.js';
import type { JwtPayload, AuthTokenType } from '../src/types/jwtPayload.js';
import type { UserDocument } from '../src/types/userDocument.js';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 10 * 60;
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = 'sha512';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-refresh-secret';

type AuthResult = {
  user: AuthUser;
  accessToken: string;
};

const userSchema = new mongoose.Schema<UserDocument>(
  {
    account: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: null },
    fullName: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);

const UserModel =
  (mongoose.models.TournamentUser as mongoose.Model<UserDocument> | undefined) ||
  mongoose.model<UserDocument>('TournamentUser', userSchema);

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresInSeconds: number) {
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

function verifyJwt(token: string, secret: string, expectedType: AuthTokenType): JwtPayload | null {
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

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString('hex');

  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
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

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(name.length + 1));
}

function cookieOptions(maxAgeMs: number) {
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

function setAuthCookies(response: express.Response, accessToken: string, refreshToken: string) {
  response.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
  response.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000));
}

function clearAuthCookies(response: express.Response) {
  const options = cookieOptions(0);
  response.clearCookie(ACCESS_COOKIE, options);
  response.clearCookie(REFRESH_COOKIE, options);
}

function toIsoString(value?: Date | string | null) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function sanitizeUser(user: UserDocument & { _id: unknown }): AuthUser {
  return {
    id: String(user._id),
    account: user.account,
    email: user.email,
    avatar: user.avatar ?? null,
    fullName: user.fullName ?? null,
    phoneNumber: user.phoneNumber ?? null,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

function issueAuthTokens(user: AuthUser) {
  const access = signJwt(
    {
      sub: user.id,
      account: user.account,
      email: user.email,
      tokenType: 'access',
    },
    ACCESS_SECRET,
    ACCESS_TOKEN_TTL_SECONDS,
  );

  const refresh = signJwt(
    {
      sub: user.id,
      account: user.account,
      email: user.email,
      tokenType: 'refresh',
    },
    REFRESH_SECRET,
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
  };
}

function toAuthResponse(result: AuthResult): AuthSessionResponse {
  return {
    user: result.user,
    accessToken: result.accessToken,
  };
}

async function findUserByIdentifier(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  return UserModel.findOne({
    $or: [{ account: normalized }, { email: normalized }],
  }).lean<UserDocument & { _id: unknown }>();
}

async function createUser(payload: AuthRegisterInput) {
  const account = normalizeIdentifier(payload.account);
  const email = normalizeIdentifier(payload.email);
  const password = payload.password.trim();
  const avatar = typeof payload.avatar === 'string' ? payload.avatar.trim() : '';
  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
  const phoneNumber = typeof payload.phoneNumber === 'string' ? payload.phoneNumber.trim() : '';

  if (!account || !email || !password) {
    throw new Error('Thieu thong tin dang ky.');
  }

  if (password.length < 6) {
    throw new Error('Mat khau phai co it nhat 6 ky tu.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email khong hop le.');
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
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  return sanitizeUser(created.toObject() as UserDocument & { _id: unknown });
}

async function authenticateWithRefresh(req: express.Request, res: express.Response): Promise<AuthResult | null> {
  const refreshToken = getCookieValue(req.headers.cookie, REFRESH_COOKIE);
  if (!refreshToken) {
    clearAuthCookies(res);
    return null;
  }

  const refreshPayload = verifyJwt(refreshToken, REFRESH_SECRET, 'refresh');
  if (!refreshPayload) {
    clearAuthCookies(res);
    return null;
  }

  const accessToken = getCookieValue(req.headers.cookie, ACCESS_COOKIE);
  const accessPayload = accessToken ? verifyJwt(accessToken, ACCESS_SECRET, 'access') : null;

  const user = await UserModel.findById(refreshPayload.sub).lean<UserDocument & { _id: unknown }>();
  if (!user) {
    clearAuthCookies(res);
    return null;
  }

  const authUser = sanitizeUser(user);

  if (accessPayload && accessPayload.sub === authUser.id) {
    return {
      user: authUser,
      accessToken: accessToken as string,
    };
  }

  const tokens = issueAuthTokens(authUser);
  res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
  res.setHeader('x-access-token', tokens.accessToken);

  return {
    user: authUser,
    accessToken: tokens.accessToken,
  };
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  void (async () => {
    const auth = await authenticateWithRefresh(req, res);
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
      const message = error instanceof Error ? error.message : 'Khong the dang ky.';
      const status = message.includes('ton tai') ? 409 : 400;
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

      // load mongoose document so we can update counters
      const user = await UserModel.findOne({
        $or: [{ account: normalizeIdentifier(identifier) }, { email: normalizeIdentifier(identifier) }],
      });

      if (!user) {
        clearAuthCookies(res);
        res.status(401).json({ message: 'Sai tài khoản/email hoặc mật khẩu.' });
        return;
      }

      // check if account is locked
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const lockedUntilIso = user.lockedUntil.toISOString();
        clearAuthCookies(res);
        res.status(423).json({ message: 'Tài khoản bị khóa tạm thời.', lockedUntil: lockedUntilIso });
        return;
      }

      if (!verifyPassword(password, user.passwordHash)) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        const remaining = Math.max(0, 5 - user.failedLoginAttempts);

        if (user.failedLoginAttempts >= 5) {
          // lock account for 15 minutes
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await user.save();

        clearAuthCookies(res);

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          res.status(423).json({ message: 'Tài khoản đã bị khóa do quá nhiều lần đăng nhập thất bại.', lockedUntil: user.lockedUntil.toISOString() });
          return;
        }

        res.status(401).json({ message: 'Sai tài khoản/email hoặc mật khẩu.', failedAttempts: user.failedLoginAttempts, remainingAttempts: remaining });
        return;
      }

      // successful login: reset counters
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

  router.post('/refresh', requireAuth, (_req, res) => {
    res.json(toAuthResponse({
      user: res.locals.authUser,
      accessToken: res.locals.accessToken,
    }));
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  });

  return router;
}
