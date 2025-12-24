import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || ''

export interface AuthRequest extends Request {
    userId?: string
    user?: {
        id: string
        email: string
        name?: string
    }
    body: any
    query: any
    params: any
    headers: any
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' })
        }

        const token = authHeader.substring(7)

        const decoded = jwt.verify(token, JWT_SECRET) as any

        req.userId = decoded.sub || decoded.userId || decoded.id
        req.user = {
            id: req.userId,
            email: decoded.email,
            name: decoded.name
        }

        next()
    } catch (error) {
        console.error('[Auth] Token verification failed:', error)
        return res.status(401).json({ error: 'Invalid token' })
    }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7)
            const decoded = jwt.verify(token, JWT_SECRET) as any

            req.userId = decoded.sub || decoded.userId || decoded.id
            req.user = {
                id: req.userId,
                email: decoded.email,
                name: decoded.name
            }
        }

        next()
    } catch (error) {
        // Ignore auth errors for optional auth
        next()
    }
}
