export interface UserDocument {
    account: string;
    email: string;
    passwordHash: string;
    avatar?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    role: 'user' | 'admin';
    createdAt?: Date;
    updatedAt?: Date;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
}
