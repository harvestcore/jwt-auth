import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

import configManager from './config/configManager';
import logging from './config/logging';
import MongoEngine from './db/MongoEngine';
import { User } from './interfaces/User';
import { Response } from './interfaces/Response';
import { TFA } from './interfaces/TFA';
import {
    createUser,
    enableUser,
    getUser,
    getUserByFields,
    removeUser
} from './models/User';
import {
    blockTFA,
    createTFA,
    getTFA,
    increaseTFARetry,
    removeTFA
} from './models/TFA';

const SERVER_EMAIL_SERVICE = configManager.get('SERVER_EMAIL_SERVICE');
const SERVER_EMAIL = configManager.get('SERVER_EMAIL');
const SERVER_EMAIL_PASS = configManager.get('SERVER_EMAIL_PASS');
const MAX_LOGIN_RETRIES = configManager.get('MAX_LOGIN_RETRIES');
const JWT_ENC_KEY = configManager.get('JWT_ENC_KEY');
const SALT_ROUNDS = configManager.get('SALT_ROUNDS');

const NAMESPACE = 'AuthManager';

function generateCode() {
    return Math.random().toString(36).substring(1).replace('.', '');
}

class AuthManager {
    private mongoEngine: MongoEngine;
    private emailer: any;
    private newUsersByCode: Map<string, User>;

    constructor() {
        this.mongoEngine = new MongoEngine();
        this.emailer = nodemailer.createTransport({
            service: SERVER_EMAIL_SERVICE,
            auth: {
                user: SERVER_EMAIL,
                pass: SERVER_EMAIL_PASS
            }
        });

        // Stores the users that have been created but are not enabled yet.
        this.newUsersByCode = new Map();

        // Cleanup not enabled users every 5 mins.
        setInterval(() => {
            this.newUsersByCode.forEach(value => removeUser(value));
        }, 300000);
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
                logging.error(NAMESPACE, 'Error when sending email.', error);
            } else {
                logging.info(NAMESPACE, 'Email sent.', info.response);
            }
        });
    }

    async login(username: string, password: string): Promise<Response> {
        // Get the user that matches the username.
        const user = await getUser(username);

        // Check the password.
        const passwordMatch = await bcrypt.compareSync(password, user.password);

        // If the user exists and the password matches.
        if (user && passwordMatch) {
            // Get the TFA object if existant that matches
            // the public_id of the user.
            const currentTFAforUser = await getTFA(user.public_id);
            const public_id = user.public_id;

            // If the TFA exists.
            if (currentTFAforUser) {
                const currentDate = Date.now();

                // Check if the TFA has expired.
                if (currentTFAforUser.exp.getTime() < currentDate) {
                    await removeTFA(user.public_id);
                    return {
                        status: false,
                        message: 'Login expired, please try again.',
                        metadata: {}
                    };
                }

                // Check if the TFA is blocked.
                if (
                    currentTFAforUser.blocked_until &&
                    currentTFAforUser.blocked_until.getTime() > currentDate
                ) {
                    return {
                        status: false,
                        message: 'Login blocked.',
                        metadata: {}
                    };
                }

                const retries = currentTFAforUser.retries.valueOf() + 1;

                // Check TFA retries.
                if (retries > MAX_LOGIN_RETRIES) {
                    blockTFA(public_id);
                    return {
                        status: false,
                        message:
                            'Maximum retries exceded. Login blocked for 5 minutes.',
                        metadata: {}
                    };
                } else {
                    // Increase retries on every login attempt.
                    await increaseTFARetry(public_id, retries);
                }

                return {
                    status: false,
                    message: 'Code already sent.',
                    metadata: {}
                };
            } else {
                const twoFactor: TFA = {
                    public_id: public_id,
                    code: generateCode(),
                    blocked_until: null,
                    retries: 1,
                    exp: null
                };

                // Create a new TFA.
                const newTFA = await createTFA(twoFactor);

                if (newTFA) {
                    this.sendEmail(user.email, newTFA.code);

                    return {
                        status: true,
                        message: '2FA. Email sent.',
                        metadata: {}
                    };
                }
            }
        }

        return {
            status: false,
            message: 'Login failed.',
            metadata: {}
        };
    }

    async validate(
        username: string,
        password: string,
        code: string
    ): Promise<Response> {
        // Get the user that matches the username.
        const user = await getUser(username);

        // Check the password.
        const passwordMatch = await bcrypt.compareSync(password, user.password);

        // If the user exists and the password matches.
        if (user && passwordMatch) {
            // Get the TFA object if existant that matches
            // the public_id of the user.
            const currentTFAforUser = await getTFA(user.public_id);
            const public_id = user.public_id;

            // If the TFA exists.
            if (currentTFAforUser) {
                // And the code is the same.
                if (currentTFAforUser.code === code) {
                    // Generate the JWT token and return it.
                    const token = jwt.sign(
                        {
                            metadata: {
                                public_id: user.public_id
                            }
                        },
                        JWT_ENC_KEY,
                        { expiresIn: '1h' }
                    );

                    // There is no need to still keep the TFA.
                    await removeTFA(public_id);

                    return {
                        status: true,
                        message: 'Login successful',
                        metadata: {
                            token
                        }
                    };
                }
            }
        }

        return {
            status: false,
            message: 'Validation failed.',
            metadata: {}
        };
    }

    async register(user: User): Promise<Response> {
        // Check if there is an existant user with similar credentials.
        const existantUser = await getUserByFields({
            username: user.username,
            email: user.email
        });

        // If so, return an error.
        if (existantUser) {
            return {
                status: false,
                message: 'Already existant user with the same credentials.',
                metadata: {}
            };
        }

        // Create hashed password.
        const salt = await bcrypt.genSalt(Number(SALT_ROUNDS));
        const hash = await bcrypt.hash(user.password, salt);

        // Else, create a new user.
        const newUser = await createUser({ ...user, password: hash });

        // If the user has been created.
        if (newUser) {
            // Generate the code that will be sent via email.
            const code = generateCode();

            // Store this user in the map.
            this.newUsersByCode.set(code, user);

            // Send the email.
            this.sendEmail(user.email, code);

            return {
                status: true,
                message: 'User created. Email sent.',
                metadata: {}
            };
        }

        return {
            status: false,
            message: 'Registration process failed.',
            metadata: {}
        };
    }

    async validateUser(
        username: string,
        password: string,
        code: string
    ): Promise<Response> {
        // Get the user from the new added users.
        const disabled = this.newUsersByCode.get(code);

        const passwordMatch = await bcrypt.compareSync(
            password,
            disabled.password
        );

        // If existant.
        if (disabled && disabled.username === username && passwordMatch) {
            // Enable this user and remove it from the map.
            await enableUser(disabled.public_id);
            this.newUsersByCode.delete(code);

            return {
                status: false,
                message: 'User verified and enabled.',
                metadata: {}
            };
        }

        return {
            status: false,
            message: 'Validation failed.',
            metadata: {}
        };
    }

    validateToken(token: string | string[]): Response {
        try {
            // Verify and decode the token.
            const decoded = jwt.verify(token, JWT_ENC_KEY);

            // Check if expired.
            if (decoded.exp < Math.floor(Date.now() / 1000)) {
                return {
                    status: false,
                    message: 'Token has expired.',
                    metadata: {}
                };
            }

            return {
                status: true,
                message: 'Token is valid.',
                metadata: decoded.metadata
            };
        } catch (error) {
            return {
                status: false,
                message: 'Unknown token.',
                metadata: {}
            };
        }
    }
}

export default new AuthManager();
