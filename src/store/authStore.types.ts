import type { AuthLoginInput, AuthProfileUpdateInput, AuthRegisterInput, AuthUser } from '../types/auth.ts';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthStoreState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  errorMessage: string | null;
}

export interface AuthStoreActions {
  bootstrap(): Promise<AuthUser | null>;
  login(payload: AuthLoginInput): Promise<AuthUser>;
  register(payload: AuthRegisterInput): Promise<AuthUser>;
  updateProfile(payload: AuthProfileUpdateInput): Promise<AuthUser>;
  logout(): Promise<void>;
  markUnauthenticated(reason?: unknown): void;
  isAuthenticated(): boolean;
}

export interface AuthStoreContract extends AuthStoreState, AuthStoreActions {}
