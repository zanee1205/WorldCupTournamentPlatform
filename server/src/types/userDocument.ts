export interface UserDocument {
    account: string;
    email: string;
    passwordHash: string;
    avatar?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}
