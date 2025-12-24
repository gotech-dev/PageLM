import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

// Get JWT_SECRET at runtime (when function is called), not at module load time
function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET environment variable is required')
    return secret
}

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
    console.log('[Auth] Starting auth check for:', req.method, req.url)
    try {
        const authHeader = req.headers.authorization
        console.log('[Auth] Header:', authHeader ? 'Present' : 'Missing', authHeader?.substring(0, 30))

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[Auth] No token provided')
            return res.status(401).json({ error: 'No token provided' })
        }

        const token = authHeader.substring(7)
        console.log('[Auth] Token length:', token.length)

        const decoded = jwt.verify(token, getJwtSecret()) as any
        console.log('[Auth] Decoded:', decoded?.sub, decoded?.email)

        req.userId = decoded.sub || decoded.userId || decoded.id
        req.user = {
            id: req.userId,
            email: decoded.email,
            name: decoded.name
        }

        console.log('[Auth] Success, userId:', req.userId)
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
            const decoded = jwt.verify(token, getJwtSecret()) as any

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
