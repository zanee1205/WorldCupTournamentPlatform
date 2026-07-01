import mongoose from 'mongoose';
import type { UserDocument } from '../src/types/userDocument.js';
import { hashPassword } from './authHelpers.js';

const userSchema = new mongoose.Schema<UserDocument>(
    {
        account: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
        avatar: { type: String, default: null },
        fullName: { type: String, default: null },
        phoneNumber: { type: String, default: null },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
        failedLoginAttempts: { type: Number, default: 0 },
        lockedUntil: { type: Date, default: null },
    },
    {
        versionKey: false,
        timestamps: true,
    },
);

export const PERMANENT_LOCK_DATE = new Date('9999-12-31T23:59:59.999Z');

export const UserModel =
    (mongoose.models.TournamentUser as mongoose.Model<UserDocument> | undefined) ||
    mongoose.model<UserDocument>('TournamentUser', userSchema);

export async function ensureAdminUserModel() {
    if (mongoose.connection.readyState !== 1) return;

    try {
        await UserModel.updateMany(
            { $or: [{ role: { $exists: false } }, { role: null }] },
            { $set: { role: 'user' } },
        ).exec();
    } catch (error) {
        console.error('[authModel] ensureAdminUserModel failed', error);
    }
}
