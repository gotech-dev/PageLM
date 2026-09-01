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

    // ========== SSO from BGTT ==========
    // Endpoint legacy - giữ lại để tránh breaking change nội bộ
    app.get('/auth/sso-legacy', async (req: any, res: any) => {
        try {
            const { token, redirect, platform_code = 'bgtt' } = req.query

            if (!token) {
                return res.status(400).json({ error: 'SSO token required' })
            }

            // Direct AES decryption for study_with_ai platform
            let payload: any;
            
            if (platform_code === 'study_with_ai') {
                const ssoSecret = process.env.STUDY_WITH_AI_SECRET_KEY || process.env.JWT_SECRET
                if (!ssoSecret) {
                    console.error('[SSO] SSO_SECRET not configured')
                    return res.status(500).json({ error: 'SSO not configured' })
                }

                // AES decryption for study_with_ai platform
                const crypto = require('crypto')
                
                try {
                    // Decode base64 token
                    const encryptedData = Buffer.from(token, 'base64')
                    
                    if (encryptedData.length < 16) {
                        return res.status(400).json({ error: 'Invalid token format: too short for AES' })
                    }
                    
                    // Extract IV and ciphertext
                    const iv = encryptedData.slice(0, 16)
                    const ciphertext = encryptedData.slice(16)
                    
                    console.log('[SSO] Token lengths - IV:', iv.length, 'Ciphertext:', ciphertext.length)
                    
                    // Try AES-256-CBC with full SHA256 hash first
                    let decrypted = null
                    const methods = [
                        {
                            name: 'AES-256-CBC',
                            key: Buffer.from(crypto.createHash('sha256').update(ssoSecret).digest('hex'), 'hex'),
                            algo: 'aes-256-cbc'
                        },
                        {
                            name: 'AES-128-CBC', 
                            key: Buffer.from(crypto.createHash('sha256').update(ssoSecret).digest('hex').substring(0, 32), 'hex'),
                            algo: 'aes-128-cbc'
                        },
                        {
                            name: 'AES-256-CBC-Slice32',
                            key: crypto.createHash('sha256').update(ssoSecret).digest().slice(0, 32),
                            algo: 'aes-256-cbc'
                        }
                    ]
                    
                    for (const method of methods) {
                        try {
                            console.log(`[SSO] Trying ${method.name}...`)
                            const decipher = crypto.createDecipheriv(method.algo, method.key, iv)
                            decipher.setAutoPadding(true)
                            
                            let decryptedData = decipher.update(ciphertext)
                            decryptedData = Buffer.concat([decryptedData, decipher.final()])
                            
                            const payloadJson = decryptedData.toString('utf8')
                            console.log(`[SSO] ${method.name} SUCCESS!`)
                            console.log('[SSO] Decrypted JSON:', payloadJson)
                            
                            payload = JSON.parse(payloadJson)
                            break
                        } catch (error: any) {
                            console.log(`[SSO] ${method.name} failed:`, error?.message || error)
                            continue
                        }
                    }
                    
                    if (!payload) {
                        return res.status(400).json({ error: 'Failed to decrypt token with any method' })
                    }
                    
                } catch (error) {
                    console.error('[SSO] AES decryption error:', error)
                    return res.status(400).json({ error: 'Token decryption failed' })
                }

                // Check expiration
                if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                    return res.status(401).json({ error: 'Token expired' })
                }
                
                console.log(`[SSO] Token verified successfully for: ${payload.email} (platform: ${platform_code})`);
            } else {
                return res.status(400).json({ error: 'Unsupported platform' });
            }

            const { email, name, user_id: bgttUserId, credits } = payload

            if (!email) {
                return res.status(400).json({ error: 'Email required in token' })
            }

            console.log('[SSO] Processing SSO for:', email)

            // Find or create user
            let users = await query<{
                id: string
                email: string
                name: string
                credits?: number
            }>('SELECT id, email, name, credits FROM users WHERE email = ?', [email])

            let userId: string
            let userName: string
            let userCredits: number = credits || 0

            if (users.length === 0) {
                // Create new user with credits and optional default password
                userId = randomUUID()
                userName = name || email.split('@')[0]

                // Generate a default password for SSO users (optional - allows local login)
                const defaultPassword = `sso_${randomUUID().substring(0, 8)}`
                const hashedPassword = await bcrypt.hash(defaultPassword, 10)

                await query(
                    'INSERT INTO users (id, email, name, password, credits, source_platform) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, email, userName, hashedPassword, userCredits, platform_code]
                )

                console.log('[SSO] Created new user:', userId, 'with credits:', userCredits)
            } else {
                userId = users[0].id
                userName = users[0].name
                userCredits = users[0].credits || 0
                
                // Check if user has a password, if not set one
                const userWithPassword = await query<{
                    password?: string
                }>('SELECT password FROM users WHERE id = ?', [userId])
                
                if (!userWithPassword[0].password) {
                    // Generate a default password for SSO users
                    const defaultPassword = `sso_${randomUUID().substring(0, 8)}`
                    const hashedPassword = await bcrypt.hash(defaultPassword, 10)
                    
                    await query(
                        'UPDATE users SET password = ?, source_platform = ? WHERE id = ?',
                        [hashedPassword, platform_code, userId]
                    )
                    console.log('[SSO] Set default password for existing user:', userId)
                }
                
                // Update credits if different from payload
                if (credits !== undefined && credits !== userCredits) {
                    await query(
                        'UPDATE users SET credits = ?, source_platform = ? WHERE id = ?',
                        [credits, platform_code, userId]
                    )
                    userCredits = credits
                    console.log('[SSO] Updated user credits:', userId, 'new credits:', userCredits)
                } else {
                    console.log('[SSO] Found existing user:', userId)
                }
            }

            // Generate JWT token
            const jwtToken = jwt.sign(
                {
                    sub: userId,
                    userId: userId,
                    id: userId,
                    email,
                    name: userName,
                    credits: userCredits,
                    iss: JWT_ISSUER,
                    sso: true,
                    source: platform_code
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            )

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5174'
            // Use the redirect parameter from the request, default to '/app' for SSO users
            const redirectPath = redirect === '/' ? '/' : (redirect || '/app')

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
