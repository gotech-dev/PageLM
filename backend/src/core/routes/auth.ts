import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '../../utils/database/mysql'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
const JWT_SECRET: string = process.env.JWT_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER || 'pagelm'

// Helper to get user from MySQL by email and password
async function authenticateUser(email: string, password: string) {
    const users = await query<{
        id: string
        email: string
        name: string
        password?: string
        credits?: number
    }>('SELECT id, email, name, password, credits FROM users WHERE email = ?', [email])

    if (users.length === 0) {
        return null
    }

    const user = users[0]

    // If no password set (old users or SSO), we can't login with password
    if (!user.password) {
        return null
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
        return null
    }

    return { id: user.id, email: user.email, name: user.name, credits: user.credits ?? 0 }
}

export function authRoutes(app: any) {
    // Login endpoint
    app.post('/auth/login', async (req: any, res: any) => {
        try {
            const { email, password } = req.body

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password required' })
            }

            const user = await authenticateUser(email, password)

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' })
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    sub: user.id,
                    userId: user.id,
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    iss: JWT_ISSUER
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            )

            res.json({
                ok: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    credits: user.credits ?? 0
                }
            })
        } catch (e: unknown) {
            const error = e as Error
            console.error('[Auth] Login error:', error)
            res.status(500).json({ error: error?.message || 'Login failed' })
        }
    })

    // Register endpoint
    app.post('/auth/register', async (req: any, res: any) => {
        try {
            const { email, password, name } = req.body

            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Email, password, and name required' })
            }

            // Check if user exists in MySQL
            const existing = await query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            )

            if (existing.length > 0) {
                return res.status(400).json({ error: 'User already exists' })
            }

            const userId = randomUUID()
            const hashedPassword = await bcrypt.hash(password, 10)

            // Create user in MySQL
            await query(
                'INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)',
                [userId, email, name, hashedPassword]
            )

            // Generate JWT token
            const token = jwt.sign(
                {
                    sub: userId,
                    userId: userId,
                    id: userId,
                    email,
                    name,
                    iss: JWT_ISSUER
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            )

            res.json({
                ok: true,
                token,
                user: {
                    id: userId,
                    email,
                    name,
                    credits: 0
                }
            })
        } catch (e: unknown) {
            const error = e as Error
            console.error('[Auth] Register error:', error)
            res.status(500).json({ error: error?.message || 'Registration failed' })
        }
    })

    // Get current user
    app.get('/auth/me', async (req: any, res: any) => {
        try {
            const authHeader = req.headers.authorization

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token provided' })
            }

            const token = authHeader.substring(7)
            const decoded = jwt.verify(token, JWT_SECRET) as any

            const userId = decoded.sub || decoded.userId || decoded.id
            const users = await query<{ id: string; email: string; name: string; credits?: number }>(
                'SELECT id, email, name, credits FROM users WHERE id = ? LIMIT 1',
                [userId]
            )

            if (!users.length) {
                return res.status(404).json({ error: 'User not found' })
            }

            const u = users[0]

            res.json({
                ok: true,
                user: {
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    credits: u.credits ?? 0
                }
            })
        } catch (e: unknown) {
            const error = e as Error
            res.status(401).json({ error: error?.message || 'Invalid token' })
        }
    })

    // ========== SSO from BGTT ==========
    // Endpoint MỚI - nhận SSO token từ BGTT, tạo/login user, redirect với JWT
    app.get('/auth/sso', async (req: any, res: any) => {
        try {
            const { token, redirect } = req.query

            if (!token) {
                return res.status(400).json({ error: 'SSO token required' })
            }

            // Verify SSO token
            const ssoSecret = process.env.SSO_SECRET || process.env.JWT_SECRET
            if (!ssoSecret) {
                console.error('[SSO] SSO_SECRET not configured')
                return res.status(500).json({ error: 'SSO not configured' })
            }

            // Parse token: base64payload.signature
            const parts = token.split('.')
            if (parts.length !== 2) {
                return res.status(400).json({ error: 'Invalid token format' })
            }

            const [encodedPayload, signature] = parts

            // Verify signature
            const crypto = require('crypto')
            const expectedSignature = crypto.createHmac('sha256', ssoSecret)
                .update(encodedPayload)
                .digest('hex')

            if (signature !== expectedSignature) {
                console.error('[SSO] Invalid signature')
                return res.status(401).json({ error: 'Invalid token signature' })
            }

            // Decode payload
            const payloadJson = Buffer.from(encodedPayload, 'base64').toString('utf8')
            const payload = JSON.parse(payloadJson)

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return res.status(401).json({ error: 'Token expired' })
            }

            const { email, name, user_id: bgttUserId } = payload

            if (!email) {
                return res.status(400).json({ error: 'Email required in token' })
            }

            console.log('[SSO] Processing SSO for:', email)

            // Find or create user
            let users = await query<{
                id: string
                email: string
                name: string
            }>('SELECT id, email, name FROM users WHERE email = ?', [email])

            let userId: string
            let userName: string

            if (users.length === 0) {
                // Create new user
                userId = randomUUID()
                userName = name || email.split('@')[0]

                await query(
                    'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
                    [userId, email, userName]
                )

                console.log('[SSO] Created new user:', userId)
            } else {
                userId = users[0].id
                userName = users[0].name
                console.log('[SSO] Found existing user:', userId)
            }

            // Generate JWT token
            const jwtToken = jwt.sign(
                {
                    sub: userId,
                    userId: userId,
                    id: userId,
                    email,
                    name: userName,
                    iss: JWT_ISSUER,
                    sso: true,
                    source: 'bgtt'
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            )

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5174'
            const redirectPath = redirect || '/'

            // Build redirect URL with token in query
            const redirectUrl = `${frontendUrl}/sso-callback?token=${encodeURIComponent(jwtToken)}&redirect=${encodeURIComponent(redirectPath)}`

            console.log('[SSO] Redirecting to:', redirectUrl)

            // Manual redirect since res.redirect may not exist
            res.writeHead(302, { Location: redirectUrl })
            res.end()

        } catch (e: unknown) {
            const error = e as Error
            console.error('[SSO] Error:', error)
            res.status(500).json({ error: error?.message || 'SSO failed' })
        }
    })
}
