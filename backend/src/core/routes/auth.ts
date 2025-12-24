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
    }>('SELECT id, email, name, password FROM users WHERE email = ?', [email])

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

    return { id: user.id, email: user.email, name: user.name }
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
                    name: user.name
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
                    name
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

            res.json({
                ok: true,
                user: {
                    id: decoded.sub || decoded.userId || decoded.id,
                    email: decoded.email,
                    name: decoded.name
                }
            })
        } catch (e: unknown) {
            const error = e as Error
            res.status(401).json({ error: error?.message || 'Invalid token' })
        }
    })
}
