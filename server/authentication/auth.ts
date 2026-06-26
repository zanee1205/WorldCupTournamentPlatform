import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';

import type { AuthLoginInput, AuthRegisterInput, AuthSessionResponse, AuthUser } from '../../src/types/auth.js';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 10 * 60;
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = 'sha512';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET?.trim() || process.env.JWT_SECRET?.trim() || 'dev-refresh-secret';

type AuthTokenType = 'access' | 'refresh';

interface JwtPayload {
  sub: string;
  account: string;
  email: string;
  tokenType: AuthTokenType;
  iat: number;
  exp: number;
}

interface UserDocument {
  account: string;
  email: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type AuthResult = {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: string;
};

const userSchema = new mongoose.Schema<UserDocument>(
  {
    account: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
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

function sanitizeUser(user: UserDocument & { _id: unknown }): AuthUser {
  return {
    id: String(user._id),
    account: user.account,
    email: user.email,
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
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
  };
}

function toAuthResponse(result: AuthResult): AuthSessionResponse {
  return {
    user: result.user,
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
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
    throw new Error('Tai khoan hoac email da ton tai.');
  }

  const created = await UserModel.create({
    account,
    email,
    passwordHash: hashPassword(password),
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
      accessTokenExpiresAt: new Date(accessPayload.exp * 1000).toISOString(),
    };
  }

  const tokens = issueAuthTokens(authUser);
  res.cookie(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));

  return {
    user: authUser,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  };
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  void (async () => {
    const auth = await authenticateWithRefresh(req, res);
    if (!auth) {
      res.status(401).json({ message: 'Phien dang nhap da het han. Vui long dang nhap lai.' });
      return;
    }

    res.locals.authUser = auth.user;
    res.locals.accessToken = auth.accessToken;
    res.locals.accessTokenExpiresAt = auth.accessTokenExpiresAt;
    next();
  })().catch((error) => {
    console.error('[auth] middleware error', error);
    clearAuthCookies(res);
    res.status(500).json({ message: 'Khong the xac thuc nguoi dung.' });
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
        res.status(400).json({ message: 'Thieu thong tin dang nhap.' });
        return;
      }

      const user = await findUserByIdentifier(identifier);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        clearAuthCookies(res);
        res.status(401).json({ message: 'Sai tai khoan/email hoac mat khau.' });
        return;
      }

      const authUser = sanitizeUser(user);
      const tokens = issueAuthTokens(authUser);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      res.json(toAuthResponse({ user: authUser, ...tokens }));
    } catch {
      clearAuthCookies(res);
      res.status(500).json({ message: 'Khong the dang nhap.' });
    }
  });

  router.get('/me', requireAuth, (_req, res) => {
    res.json(toAuthResponse({
      user: res.locals.authUser,
      accessToken: res.locals.accessToken,
      accessTokenExpiresAt: res.locals.accessTokenExpiresAt,
    }));
  });

  router.post('/refresh', requireAuth, (_req, res) => {
    res.json(toAuthResponse({
      user: res.locals.authUser,
      accessToken: res.locals.accessToken,
      accessTokenExpiresAt: res.locals.accessTokenExpiresAt,
    }));
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  });

  return router;
}
