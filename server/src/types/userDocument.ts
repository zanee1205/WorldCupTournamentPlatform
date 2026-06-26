export interface UserDocument {
    account: string;
    email: string;
    passwordHash: string;
    createdAt?: Date;
    updatedAt?: Date;
}