import { Document } from 'mongoose';

import Status from '../enums/Status';

export interface Service extends Document {
    name: string;
    enabled: Boolean;
    status: Status;
}

export default interface IService extends Document, Service {}
