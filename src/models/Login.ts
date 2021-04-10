import mongoose, { Schema } from 'mongoose';
import JWT from 'jsonwebtoken';

import { ILogin } from '../interfaces/Login';

export const LoginSchema: Schema = new Schema(
    {
        token: {
            type: JWT
        },
        username: {
            type: String
        },
        public_id: {
            type: String
        },
        exp: {
            type: Date,
            default: new Date()
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model<ILogin>('Login', LoginSchema);
