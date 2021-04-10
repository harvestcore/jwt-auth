import { Document } from 'mongoose';

export interface TFA {
    public_id: string;
    code: string;
    blocked_until: Date;
    retries: Number;
    exp: Date;
}

export interface ITFA extends Document, TFA {}
