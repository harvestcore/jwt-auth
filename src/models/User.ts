import mongoose, { Schema } from 'mongoose';
import { v4 as UUID } from 'uuid';

import Rol from '../enums/Rol';
import { IUser, User } from '../interfaces/User';

export const UserSchema: Schema = new Schema(
    {
        public_id: {
            type: String,
            default: UUID(),
            unique: true
        },
        firstName: {
            type: String
        },
        lastName: {
            type: String
        },
        email: {
            type: String,
            unique: true
        },
        telnumber: {
            type: String
        },
        username: {
            type: String,
            unique: true,
            lowercase: true
        },
        password: {
            type: String
        },
        rol: {
            type: String,
            enum: Rol
        },
        services: {
            type: [String],
            default: []
        },
        enabled: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);

export function getUser(username: string, password?: string): Promise<User> {
    const config = { username };

    if (password) {
        config['password'] = password;
    }

    return UserModel.findOne(config, {
        _id: 0,
        createdAt: 0,
        updatedAt: 0,
        __v: 0
    }).exec();
}

export function getUserByFields(config: any): Promise<User> {
    return UserModel.findOne(
        { $or: [config] },
        {
            _id: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0
        }
    ).exec();
}

export function createUser(user: User) {
    return new UserModel(user).save();
}

export function removeUser(user: User) {
    return new UserModel(user).save();
}

export function enableUser(public_id: string) {
    return UserModel.updateOne(
        { public_id },
        {
            $set: { enabled: true }
        }
    ).exec();
}

export function changePassword(public_id: string, password: string) {
    return UserModel.updateOne(
        { public_id },
        {
            $set: { password }
        }
    ).exec();
}

export async function removeDisabledUsers() {
    const users = await UserModel.find({ enabled: false }).exec();
    users.forEach(user => user.remove());
}

export function validUsername(username: string) {
    return /^[a-zA-Z0-9]{8,16}$/g.test(username);
}

export function validPassword(password: string) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,64}$/g.test(
        password
    );
}
