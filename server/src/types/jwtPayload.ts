export type AuthTokenType = 'access' | 'refresh';

export interface JwtPayload {
    sub: string;
    account: string;
    email: string;
    tokenType: AuthTokenType;
    iat: number;
    exp: number;
}