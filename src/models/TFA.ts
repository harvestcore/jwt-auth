import mongoose, { Schema } from 'mongoose';
import { ITFA, TFA } from '../interfaces/TFA';

export const TFASchema: Schema = new Schema(
    {
        public_id: {
            type: String
        },
        code: {
            type: String
        },
        blocked_until: {
            type: Date
        },
        retries: {
            type: Number
        },
        exp: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

export const TFAModel = mongoose.model<ITFA>('TFA', TFASchema);

export function createTFA(config: TFA): Promise<TFA> {
    if (!config.exp) {
        const now = Date.now();
        config.exp = new Date(now + 5 * 60000);
    }

    return new TFAModel(config).save();
}

export function getTFA(public_id: string): Promise<TFA> {
    return TFAModel.findOne({
        public_id
    }).exec();
}

export function increaseTFARetry(public_id: string, retries: number) {
    return TFAModel.updateOne(
        {
            public_id
        },
        { $set: { retries, blocked_until: null } }
    ).exec();
}

export function blockTFA(public_id: string) {
    const now = Date.now();
    const blocked_until = new Date(now + 5 * 60000);
    return TFAModel.updateOne(
        {
            public_id
        },
        { $set: { blocked_until, retries: 0 } }
    ).exec();
}

export function removeTFA(public_id: string) {
    return TFAModel.deleteOne({
        public_id
    }).exec();
}
