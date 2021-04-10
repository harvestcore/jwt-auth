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
        const exp = new Date();
        exp.setMinutes(exp.getMinutes() + 5);
        config.exp = exp;
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
    const blocked_until = new Date();
    blocked_until.setMinutes(blocked_until.getMinutes() + 5);
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
