import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

import configManager from './config/configManager';
import MongoEngine from './db/MongoEngine';
import { TFA } from './interfaces/TFA';
import { createUser, getUser } from './models/User';
import {
    createTFA,
    getTFA,
    increaseTFARetry,
    blockTFA,
    removeTFA
} from './models/TFA';

const SERVER_EMAIL_SERVICE = configManager.get('SERVER_EMAIL_SERVICE');
const SERVER_EMAIL = configManager.get('SERVER_EMAIL');
const SERVER_EMAIL_PASS = configManager.get('SERVER_EMAIL_PASS');
const MAX_LOGIN_RETRIES = configManager.get('MAX_LOGIN_RETRIES');
const JWT_ENC_KEY = configManager.get('JWT_ENC_KEY');

class AuthManager {
    private mongoEngine: MongoEngine;
    private emailer: any;

    constructor() {
        this.mongoEngine = new MongoEngine();
        this.emailer = nodemailer.createTransport({
            service: SERVER_EMAIL_SERVICE,
            auth: {
                user: SERVER_EMAIL,
                pass: SERVER_EMAIL_PASS
            }
        });
    }

    private sendEmail(to: string, code: string): void {
        const mailOptions = {
            from: SERVER_EMAIL,
            to,
            subject: '[JWTAUTH] - 2FA Code',
            text: `Here is your code: ${code}`
        };

        this.emailer.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }

    async login(username: string, password: string): Promise<string> {
        // Get the user that matches the username and password.
        const user = await getUser(username, password);

        // If the user exists.
        if (user) {
            // Get the TFA object if existant that matches
            // the public_id of the user.
            const currentTFAforUser = await getTFA(user.public_id);

            // If the TFA exists.
            if (currentTFAforUser) {
                const retries = currentTFAforUser.retries.valueOf() + 1;

                if (retries > MAX_LOGIN_RETRIES) {
                    await removeTFA(user.public_id);

                    return 'max retries';
                } else {
                    await increaseTFARetry(user.public_id, retries);
                }

                return 'please try again';
            } else {
                const twoFactor: TFA = {
                    public_id: user.public_id,
                    code: Math.random()
                        .toString(36)
                        .substring(1)
                        .replace('.', ''),
                    blocked_until: null,
                    retries: 1,
                    exp: null
                };

                const newTFA = await createTFA(twoFactor);

                if (newTFA) {
                    this.sendEmail(user.email, newTFA.code);

                    return 'email sent';
                }

                return 'no tfa';
            }
        }

        return 'no user';
    }

    async validate(
        username: string,
        password: string,
        code: string
    ): Promise<string> {
        // Get the user that matches the username and password.
        const user = await getUser(username, password);

        // If the user exists.
        if (user) {
            // Get the TFA object if existant that matches
            // the public_id of the user.
            const currentTFAforUser = await getTFA(user.public_id);

            // If the TFA exists.
            if (currentTFAforUser) {
                // And the code is the same.
                if (currentTFAforUser.code === code) {
                    // Generate the JWT token and return it.
                    const token = jwt.sign({ foo: 'bar' }, JWT_ENC_KEY);
                    return token;
                }

                // The code does not match. Resolve promise.
                return Promise.resolve('');
            }

            // There is no TFA. Resolve promise.
            return Promise.resolve('');
        }

        // There is no user. Resolve promise.
        return Promise.resolve('');
    }
}

export default new AuthManager();
