import { connect, Connection, connection, disconnect } from 'mongoose';

import logging from '../config/logging';
import configManager from '../config/configManager';

const NAMESPACE = 'MongoEngine';

const MONGODB_URI = configManager.get('MONGODB_URI');

export default class MongoEngine {
    private database: Connection;

    constructor() {
        connect(MONGODB_URI, {
            useNewUrlParser: true,
            useFindAndModify: true,
            useUnifiedTopology: true,
            useCreateIndex: true
        });

        this.database = connection;

        this.database.on('open', async () => {
            logging.info(NAMESPACE, `Connected to database via ${MONGODB_URI}`);
        });

        this.database.on('error', e => {
            logging.error(
                NAMESPACE,
                `Connected to database failed via ${MONGODB_URI}`
            );
        });
    }

    disconnect() {
        if (!this.database) {
            return;
        }

        disconnect();
    }
}
