import { connect, Connection, connection, disconnect } from 'mongoose';

const URI = 'mongodb://localhost:27017/auth';

class MongoEngine {
    private database: Connection;

    constructor() {
        connect(URI, {
            useNewUrlParser: true,
            useFindAndModify: true,
            useUnifiedTopology: true,
            useCreateIndex: true
        })

        this.database = connection;

        this.database.on('open', async () => {
            console.log('Connected to database.');
        });

        this.database.on('error', e => {
            console.error(e);
        });
    }

    disconnect() {
        if (!this.database) {
            return;
        }

        disconnect();
    }
}

export default new MongoEngine();

