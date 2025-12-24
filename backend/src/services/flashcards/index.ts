import { query, queryOne } from '../../utils/database/mysql'
import crypto from 'crypto'

export interface Flashcard {
    id: string
    userId: string
    question: string
    answer: string
    tag: string
    createdAt: Date
    updatedAt: Date
}

export async function createFlashcard(userId: string, question: string, answer: string, tag: string): Promise<Flashcard> {
    const id = crypto.randomUUID()

    await query(
        'INSERT INTO flashcards (id, user_id, question, answer, tag) VALUES (?, ?, ?, ?, ?)',
        [id, userId, question, answer, tag]
    )

    return {
        id,
        userId,
        question,
        answer,
        tag,
        createdAt: new Date(),
        updatedAt: new Date()
    }
}

export async function listFlashcards(userId: string, tag?: string): Promise<Flashcard[]> {
    if (tag) {
        return query<Flashcard>(
            'SELECT id, user_id as userId, question, answer, tag, created_at as createdAt, updated_at as updatedAt FROM flashcards WHERE user_id = ? AND tag = ? ORDER BY created_at DESC',
            [userId, tag]
        )
    }

    return query<Flashcard>(
        'SELECT id, user_id as userId, question, answer, tag, created_at as createdAt, updated_at as updatedAt FROM flashcards WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
    )
}

export async function getFlashcard(id: string): Promise<Flashcard | null> {
    return queryOne<Flashcard>(
        'SELECT id, user_id as userId, question, answer, tag, created_at as createdAt, updated_at as updatedAt FROM flashcards WHERE id = ?',
        [id]
    )
}

export async function deleteFlashcard(id: string): Promise<void> {
    await query('DELETE FROM flashcards WHERE id = ?', [id])
}

export async function updateFlashcard(id: string, updates: Partial<Pick<Flashcard, 'question' | 'answer' | 'tag'>>): Promise<Flashcard | null> {
    const fields: string[] = []
    const values: any[] = []

    if (updates.question !== undefined) {
        fields.push('question = ?')
        values.push(updates.question)
    }

    if (updates.answer !== undefined) {
        fields.push('answer = ?')
        values.push(updates.answer)
    }

    if (updates.tag !== undefined) {
        fields.push('tag = ?')
        values.push(updates.tag)
    }

    if (fields.length > 0) {
        values.push(id)
        await query(
            `UPDATE flashcards SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        )
    }

    return getFlashcard(id)
}
