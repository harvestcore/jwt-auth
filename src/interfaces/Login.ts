import { Document } from 'mongoose';
import JWT from 'jsonwebtoken';

export interface Login {
    token: JWT;
    username: string;
    public_id: string;
    exp: Date;
}

export interface ILogin extends Document, Login {}
