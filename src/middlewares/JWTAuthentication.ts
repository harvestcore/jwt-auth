import { NextFunction, Response, Request } from 'express';

export default function JWTAuthentication(
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.log('JWTAuthentication');

    next();
}
