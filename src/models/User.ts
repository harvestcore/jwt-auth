import mongoose, { Schema } from 'mongoose';
import { v4 as UUID } from 'uuid';

import Rol from '../enums/Rol';
import { User } from '../interfaces/User';
import { IUser } from '../interfaces/User';

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
            unique: true
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
            default: true
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
        enabled: 0,
        _id: 0,
        password: 0,
        createdAt: 0,
        updatedAt: 0,
        __v: 0
    }).exec();
}

export function createUser(user: User) {
    return new UserModel(user).save();
}
