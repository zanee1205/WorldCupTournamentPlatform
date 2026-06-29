export interface AuthUser {
  id: string;
  account: string;
  email: string;
  avatar?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
}

export interface AuthLoginInput {
  identifier: string;
  password: string;
}

export interface AuthRegisterInput {
  account: string;
  email: string;
  password: string;
  avatar?: string;
  fullName?: string;
  phoneNumber?: string;
}

export interface AuthProfileUpdateInput {
  avatar?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
}
