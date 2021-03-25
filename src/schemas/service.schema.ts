import { Schema } from 'mongoose';
import UUID from 'uuid';

import Status from '../enums/Status';

const Service = new Schema({
    id: {
        type: UUID,
        default: new UUID()
    },
    name: String,
    enabled: Boolean,
    status: Status,
    lastUpdate: {
        type: Date,
        default: new Date()
    }
});

export default Service;