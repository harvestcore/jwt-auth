import express, { NextFunction, Request, Response } from 'express';

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

app.get('/', (_: Request, res: Response) => {
    return res.status(200).json({
        status: true
    });
});

app.get('/check', (req: Request, res: Response) => {
    const authorization = req.headers.authorization || '';

    if (!authorization.includes('Bearer')) {
        return res.status(422).json({
            status: false,
            message: 'Missing authentication.',
            metadata: {}
        });
    }

    const token = authorization.replace('Bearer ', '');

    if (token) {
        const validation = authManager.validateToken(token);
        const statusCode = validation.status ? 200 : 400;
        return res.status(statusCode).json(validation);
    }

    return res.status(400).json({
        status: false,
        message: 'Missing token.',
        metadata: {}
    });
});

app.get('/login', async (req: Request, res: Response) => {
    const basicAuth = req.headers.authorization || '';

    if (!basicAuth.includes('Basic')) {
        return res.status(422).json({
            status: false,
            message: 'Missing authentication.',
            metadata: {}
        });
    }

    const hash = basicAuth.replace('Basic ', '');
    const credentials = Buffer.from(hash, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
        return res.status(422).json({
            status: false,
            message: 'Invalid authentication credentials.',
            metadata: {}
        });
    }

    const login = await authManager.login(username, password);

    return res.status(200).json(login);
});

app.post('/validate', async (req: Request, res: Response) => {
    const { code } = req.body;
    const basicAuth = req.headers.authorization || '';

    const hash = basicAuth.replace('Basic ', '');
    const credentials = Buffer.from(hash, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password || !code) {
        return res.status(422).json({
            status: false,
            message: 'Missing fields.',
            metadata: {}
        });
    }

    const response = await authManager.validate(username, password, code);

    return res.status(200).json(response);
});

app.post('/register', async (req: Request, res: Response) => {
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

    if (!username || !password || !email || !rol) {
        return res.status(422).json({
            status: false,
            message: 'Missing fields.',
            metadata: {}
        });
    }

    const response = await authManager.register({
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        telnumber: telnumber || '',
        username,
        password,
        services: services || [],
        rol
    });

    return res.status(200).json(response);
});

app.post('/validate-user', async (req: Request, res: Response) => {
    const { code } = req.body;
    const basicAuth = req.headers.authorization || '';

    const hash = basicAuth.replace('Basic ', '');
    const credentials = Buffer.from(hash, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password || !code) {
        return res.status(422).json({
            status: false,
            message: 'Missing fields.',
            metadata: {}
        });
    }

    const response = await authManager.validateUser(username, password, code);

    return res.status(200).json(response);
});

app.post('/request-password-reset', async (req: Request, res: Response) => {
    const { username } = req.body;

    if (!username) {
        return res.status(422).json({
            status: false,
            message: 'Missing fields.',
            metadata: {}
        });
    }

    const response = await authManager.requestResetPassword(username);
    const statusCode = response.status ? 200 : 400;

    return res.status(statusCode).json(response);
});

app.post('/reset-password', async (req: Request, res: Response) => {
    const { password, code } = req.body;

    if (!password || !code) {
        return res.status(422).json({
            status: false,
            message: 'Missing fields.',
            metadata: {}
        });
    }

    const response = await authManager.resetPassword(code, password);
    const statusCode = response.status ? 200 : 400;

    return res.status(statusCode).json(response);
});

app.listen(SERVER_PORT, () =>
    logging.info(NAMESPACE, `Running on port ${SERVER_PORT}`)
);
