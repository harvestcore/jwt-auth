import { Schema } from 'mongoose';
import UUID from 'uuid';

import Rol from '../enums/Rol';

import Service from './service.schema'

const User = new Schema({
    id: {
        type: UUID,
        default: new UUID()
    },
    firstName: String,
    lastName: String,
    email: String,
    telnumber: String,
    username: String,
    password: String,
    rol: Rol,
    services: {
        type: [Service],
        default: []
    },
    lastUpdate: {
        type: Date,
        default: new Date()
    }
});

export default User;