export interface AuthUser {
  id: string;
  account: string;
  email: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface AuthLoginInput {
  identifier: string;
  password: string;
}

export interface AuthRegisterInput {
  account: string;
  email: string;
  password: string;
}
