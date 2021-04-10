import { Document } from 'mongoose';

import Rol from '../enums/Rol';

export interface User {
    public_id?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    telnumber?: string;
    username: string;
    password: string;
    rol?: Rol;
    services?: [string?];
}

export interface IUser extends User, Document {}
