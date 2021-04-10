import mongoose, { Schema } from 'mongoose';
import { v4 as UUID } from 'uuid';

import Status from '../enums/Status';
import IService from '../interfaces/Service';

export const ServiceSchema = new Schema(
    {
        id: {
            type: String,
            default: UUID()
        },
        name: {
            type: String
        },
        enabled: {
            type: Boolean
        },
        status: {
            type: Status
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model<IService>('Service', ServiceSchema);
