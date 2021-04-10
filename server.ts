import express, { NextFunction, Request, Response } from 'express';

import { createUser } from './src/models/User';
import authManager from './src/authManager';
import logging from './src/config/logging';
import configManager from './src/config/configManager';

const NAMESPACE = 'Server';
const SERVER_PORT = configManager.get('SERVER_PORT');

const app = express();

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
    logging.info(
        NAMESPACE,
        `METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}]`
    );

    res.on('finish', () => {
        logging.info(
            NAMESPACE,
            `METHOD: [${req.method}] - URL: [${req.url}] - STATUS: [${res.statusCode}] - IP: [${req.socket.remoteAddress}]`
        );
    });

    next();
});

app.get('/', (req: Request, res: Response) => {
    res.send('lol');
});

app.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    const login = await authManager.login(username, password);

    return res.status(201).json({
        login
    });
});

app.post('/validate', async (req: Request, res: Response) => {
    const { username, password, code } = req.body;

    const response = await authManager.validate(username, password, code);

    return res.status(201).json(response);
});

app.post('/', (req: Request, res: Response) => {
    console.log(req.body);

    const {
        username,
        password,
        firstName,
        lastName,
        email,
        telnumber,
        rol,
        services
    } = req.body;

    return createUser({
        firstName,
        lastName,
        email,
        telnumber,
        username,
        password,
        services: services || [],
        rol
    })
        .then(user => {
            return res.status(201).json({
                user
            });
        })
        .catch(error => {
            return res.status(422).json({
                error
            });
        });
});

app.listen(SERVER_PORT, () =>
    logging.info(NAMESPACE, `Running on port ${SERVER_PORT}`)
);
