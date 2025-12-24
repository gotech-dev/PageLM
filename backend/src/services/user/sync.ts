import { query, queryOne } from '../../utils/database/mysql'

export interface User {
    id: string
    email: string
    name?: string
}

export async function ensureUserExists(user: User): Promise<void> {
    const existing = await queryOne(
        'SELECT id FROM users WHERE email = ?',
        [user.email]
    )

    if (!existing) {
        await query(
            'INSERT IGNORE INTO users (id, email, name) VALUES (?, ?, ?)',
            [user.id, user.email, user.name || null]
        )
        console.log('[UserSync] Created user:', user.email)
    }
}

export async function getUser(userId: string): Promise<User | null> {
    return queryOne<User>(
        'SELECT id, email, name FROM users WHERE id = ?',
        [userId]
    )
}
