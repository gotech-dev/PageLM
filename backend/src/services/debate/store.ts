import { query, queryOne } from '../../utils/database/mysql'
import { DebateSession, DebateMessage } from './index'

export async function createSession(userId: string, session: DebateSession): Promise<void> {
    await query(
        `INSERT INTO debate_sessions (id, user_id, topic, position, status, winner) 
     VALUES (?, ?, ?, ?, ?, ?)`,
        [session.id, userId, session.topic, session.position, session.status || 'active', session.winner || null]
    )
}

export async function getSession(sessionId: string): Promise<DebateSession | null> {
    const session = await queryOne<any>(
        'SELECT * FROM debate_sessions WHERE id = ?',
        [sessionId]
    )

    if (!session) return null

    const messages = await query<any>(
        'SELECT role, content, UNIX_TIMESTAMP(created_at) * 1000 as timestamp FROM debate_messages WHERE session_id = ? ORDER BY created_at ASC',
        [sessionId]
    )

    return {
        id: session.id,
        topic: session.topic,
        position: session.position,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
        })),
        createdAt: new Date(session.created_at).getTime(),
        status: session.status,
        winner: session.winner
    }
}

export async function addMessage(sessionId: string, message: DebateMessage): Promise<void> {
    await query(
        'INSERT INTO debate_messages (session_id, role, content) VALUES (?, ?, ?)',
        [sessionId, message.role, message.content]
    )

    await query(
        'UPDATE debate_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [sessionId]
    )
}

export async function updateSession(sessionId: string, updates: Partial<DebateSession>): Promise<void> {
    const fields: string[] = []
    const values: any[] = []

    if (updates.status) {
        fields.push('status = ?')
        values.push(updates.status)
    }

    if (updates.winner) {
        fields.push('winner = ?')
        values.push(updates.winner)
    }

    if (fields.length > 0) {
        values.push(sessionId)
        await query(
            `UPDATE debate_sessions SET ${fields.join(', ')} WHERE id = ?`,
            values
        )
    }
}

export async function listSessions(userId: string): Promise<DebateSession[]> {
    const sessions = await query<any>(
        'SELECT id FROM debate_sessions WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    )

    const results = await Promise.all(sessions.map(s => getSession(s.id)))
    return results.filter(s => s !== null) as DebateSession[]
}

export async function deleteSession(sessionId: string): Promise<void> {
    await query('DELETE FROM debate_sessions WHERE id = ?', [sessionId])
}
