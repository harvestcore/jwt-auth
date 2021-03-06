import bcrypt from 'bcrypt';
import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

import configManager from './config/configManager';
import logging from './config/logging';
import MongoEngine from './db/MongoEngine';
import { Response } from './interfaces/Response';
import { TFA } from './interfaces/TFA';
import { User } from './interfaces/User';
import {
    blockTFA,
    createTFA,
    getTFA,
    getTFAbyCode,
    increaseTFARetry,
    removeExpiredTFA,
    removeTFA
} from './models/TFA';
import {
    changePassword,
    createUser,
    enableUser,
    getUser,
    getUserByFields,
    removeDisabledUsers,
    removeUser,
    validUsername,
    validPassword
} from './models/User';

const CRYPTO_ENC_KEY = configManager.get('CRYPTO_ENC_KEY');
const JWT_ENC_KEY = configManager.get('JWT_ENC_KEY');
const MAX_LOGIN_RETRIES = configManager.get('MAX_LOGIN_RETRIES');
const MAX_VALIDATE_RETRIES = configManager.get('MAX_VALIDATE_RETRIES');
const SALT_ROUNDS = configManager.get('SALT_ROUNDS');
const SERVER_EMAIL = configManager.get('SERVER_EMAIL');
const SERVER_EMAIL_PASS = configManager.get('SERVER_EMAIL_PASS');
const SERVER_EMAIL_SERVICE = configManager.get('SERVER_EMAIL_SERVICE');

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
            removeDisabledUsers();
            removeExpiredTFA();
        }, 300000);
    }

    private encrypt(value: string): string {
        return CryptoJS.AES.encrypt(value, CRYPTO_ENC_KEY).toString();
    }

    private decrypt(value: string): string {
        return CryptoJS.AES.decrypt(value, CRYPTO_ENC_KEY).toString(
            CryptoJS.enc.Utf8
        );
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
        if (validUsername(username) && validPassword(password)) {
            // Get the user that matches the username.
            const user = await getUser(username);

            // If the user exists and the password matches.
            if (user) {
                // Check the password.
                const passwordMatch = await bcrypt.compareSync(
                    password,
                    this.decrypt(user.password)
                );

                // Get the TFA object if existant that matches
                // the public_id of the user.
                const currentTFAforUser = await getTFA(user.public_id);
                const public_id = user.public_id;

                if (passwordMatch) {
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
                            currentTFAforUser.blocked_until.getTime() >
                                currentDate
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
                } else {
                    if (currentTFAforUser) {
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
                    }
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
        if (validUsername(username) && validPassword(password) && code) {
            // Get the user that matches the username.
            const user = await getUser(username);

            // If the user exists and the password matches.
            if (user) {
                // Check the password.
                const passwordMatch = await bcrypt.compareSync(
                    password,
                    this.decrypt(user.password)
                );

                // Get the TFA object if existant that matches
                // the public_id of the user.
                const currentTFAforUser = await getTFA(user.public_id);
                const public_id = user.public_id;

                if (passwordMatch) {
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
                        } else {
                            const retries =
                                currentTFAforUser.retries.valueOf() + 1;

                            // Check TFA retries.
                            if (retries > MAX_VALIDATE_RETRIES) {
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
                        }
                    }
                } else {
                    if (currentTFAforUser) {
                        const retries = currentTFAforUser.retries.valueOf() + 1;

                        // Check TFA retries.
                        if (retries > MAX_VALIDATE_RETRIES) {
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
                    }
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
        if (validUsername(user.username) && validPassword(user.password)) {
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
            let newUser = null;
            try {
                newUser = await createUser({
                    ...user,
                    password: this.encrypt(hash)
                });
            } catch (e) {
                return {
                    status: false,
                    message: 'Registration process failed.',
                    metadata: {}
                };
            }

            // If the user has been created.
            if (newUser) {
                // Generate the code that will be sent via email.
                const code = generateCode();

                // Store this user in the map.
                this.newUsersByCode.set(code, newUser);

                console.log(this.newUsersByCode);

                // Send the email.
                this.sendEmail(user.email, code);

                return {
                    status: true,
                    message: 'User created. Email sent.',
                    metadata: {}
                };
            }
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
        if (validUsername(username) && validPassword(password) && code) {
            // Get the user from the new added users.
            const disabled = this.newUsersByCode.get(code);

            if (disabled) {
                const passwordMatch = await bcrypt.compareSync(
                    password,
                    this.decrypt(disabled.password)
                );

                console.log(passwordMatch);

                // If existant.
                if (
                    disabled.username === username.toLowerCase() &&
                    passwordMatch
                ) {
                    // Enable this user and remove it from the map.
                    await enableUser(disabled.public_id);
                    this.newUsersByCode.delete(code);

                    return {
                        status: false,
                        message: 'User verified and enabled.',
                        metadata: {}
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

    async requestResetPassword(username: string): Promise<Response> {
        if (validUsername(username)) {
            const user = await getUser(username);

            // If existant.
            if (user) {
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
                            message: 'Reset expired, please try again.',
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
                            message: 'Reset blocked.',
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
                                'Maximum retries exceded. Reset blocked for 5 minutes.',
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
                            message: 'Reset code sent to email.',
                            metadata: {}
                        };
                    }
                }
            }
        }

        return {
            status: false,
            message: 'Reset failed.',
            metadata: {}
        };
    }

    async resetPassword(code: string, newPassword: string): Promise<Response> {
        if (validPassword(newPassword) && code) {
            const currentTFAforUser = await getTFAbyCode(code);

            // If the TFA exists.
            if (currentTFAforUser) {
                const public_id = currentTFAforUser.public_id;
                const currentDate = Date.now();

                // Check if the TFA has expired.
                if (currentTFAforUser.exp.getTime() < currentDate) {
                    await removeTFA(public_id);
                    return {
                        status: false,
                        message: 'Reset expired, please try again.',
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
                        message: 'Reset blocked.',
                        metadata: {}
                    };
                }

                // Create hashed password.
                const salt = await bcrypt.genSalt(Number(SALT_ROUNDS));
                const hash = await bcrypt.hash(newPassword, salt);

                const result = await changePassword(
                    public_id,
                    this.encrypt(hash)
                );

                if (result.nModified === 1) {
                    removeTFA(public_id);
                    return {
                        status: false,
                        message: 'Password updated.',
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
                            'Maximum retries exceded. Reset blocked for 5 minutes.',
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
            }
        }

        return {
            status: false,
            message: 'Reset failed.',
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
