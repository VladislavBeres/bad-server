import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

// Расширяем тип Request для TypeScript
declare module 'express-serve-static-core' {
    interface Request {
        csrfToken?: () => string
    }
}

// Middleware для генерации CSRF токена и cookie
export function generateCsrf(req: Request, res: Response, next: NextFunction) {
    let token = req.cookies['XSRF-TOKEN']
    if (!token) {
        token = crypto.randomBytes(24).toString('hex')
        res.cookie('XSRF-TOKEN', token, { httpOnly: false, sameSite: 'strict' })
    }
    req.csrfToken = () => token
    next()
}

// Middleware для проверки CSRF токена на критических маршрутах
export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
    const tokenFromHeader = req.headers['x-csrf-token']
    const tokenFromCookie = req.cookies['XSRF-TOKEN']

    if (!tokenFromHeader || tokenFromHeader !== tokenFromCookie) {
        return res.status(403).json({ message: 'Invalid CSRF token' })
    }
    next()
}
