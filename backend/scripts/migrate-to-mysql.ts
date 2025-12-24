// NOTE: Make sure to set environment variables before running:
// export DB_HOST=127.0.0.1
// export DB_PORT=3306
// export DB_USERNAME=root
// export DB_PASSWORD=your_password
// export DB_DATABASE=pagelm
// Or run from backend directory where .env is loaded by the app

import db from '../src/utils/database/keyv'
import { pool, query } from '../src/utils/database/mysql'
import { randomUUID } from 'crypto'

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || randomUUID()

async function migrateChats() {
    console.log('[Migration] Starting chat migration...')

    const chatIndex = (await db.get('chat:index')) as string[] || []
    let migrated = 0
    let errors = 0

    for (const chatId of chatIndex) {
        try {
            const chat = await db.get(`chat:${chatId}`) as any
            const messages = await db.get(`msgs:${chatId}`) as any[] || []

            if (!chat) {
                console.log(`[Migration] Chat ${chatId} not found, skipping`)
                continue
            }

            // Insert chat
            await query(
                'INSERT INTO chats (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))',
                [chatId, DEFAULT_USER_ID, chat.title, chat.at / 1000, chat.at / 1000]
            )

            // Insert messages
            for (const msg of messages) {
                await query(
                    'INSERT INTO chat_messages (chat_id, role, content, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
                    [chatId, msg.role, JSON.stringify(msg.content), msg.at / 1000]
                )
            }

            migrated++
            if (migrated % 10 === 0) {
                console.log(`[Migration] Migrated ${migrated} chats...`)
            }
        } catch (error) {
            console.error(`[Migration] Failed to migrate chat ${chatId}:`, error)
            errors++
        }
    }

    console.log(`[Migration] ✅ Migrated ${migrated} chats (${errors} errors)`)
}

async function migrateDebates() {
    console.log('[Migration] Starting debate migration...')

    const debateList = (await db.get('debate:sessions')) as { id: string }[] || []
    let migrated = 0
    let errors = 0

    for (const item of debateList) {
        try {
            const session = await db.get(`debate:session:${item.id}`) as any
            if (!session) {
                console.log(`[Migration] Debate ${item.id} not found, skipping`)
                continue
            }

            // Insert session
            await query(
                `INSERT INTO debate_sessions (id, user_id, topic, position, status, winner, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
                [
                    session.id,
                    DEFAULT_USER_ID,
                    session.topic,
                    session.position,
                    session.status || 'active',
                    session.winner || null,
                    session.createdAt / 1000
                ]
            )

            // Insert messages
            for (const msg of session.messages || []) {
                await query(
                    'INSERT INTO debate_messages (session_id, role, content, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))',
                    [session.id, msg.role, msg.content, msg.timestamp / 1000]
                )
            }

            migrated++
            if (migrated % 10 === 0) {
                console.log(`[Migration] Migrated ${migrated} debates...`)
            }
        } catch (error) {
            console.error(`[Migration] Failed to migrate debate ${item.id}:`, error)
            errors++
        }
    }

    console.log(`[Migration] ✅ Migrated ${migrated} debates (${errors} errors)`)
}

async function migrateFlashcards() {
    console.log('[Migration] Starting flashcard migration...')

    const flashcards = (await db.get('flashcards')) as any[] || []
    let migrated = 0
    let errors = 0

    for (const card of flashcards) {
        try {
            await query(
                'INSERT INTO flashcards (id, user_id, question, answer, tag, created_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
                [card.id, DEFAULT_USER_ID, card.question, card.answer, card.tag, card.created / 1000]
            )
            migrated++
        } catch (error) {
            console.error(`[Migration] Failed to migrate flashcard ${card.id}:`, error)
            errors++
        }
    }

    console.log(`[Migration] ✅ Migrated ${migrated} flashcards (${errors} errors)`)
}

async function migratePlanner() {
    console.log('[Migration] Starting planner migration...')

    const taskList = (await db.get('planner:tasks')) as { id: string }[] || []
    let migrated = 0
    let errors = 0

    for (const item of taskList) {
        try {
            const task = await db.get(`planner:task:${item.id}`) as any
            if (!task) {
                console.log(`[Migration] Task ${item.id} not found, skipping`)
                continue
            }

            await query(
                `INSERT INTO planner_tasks 
         (id, user_id, course, title, type, notes, due_at, est_mins, priority, status, steps, tags, rubric, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    task.id,
                    DEFAULT_USER_ID,
                    task.course || null,
                    task.title,
                    task.type || null,
                    task.notes || null,
                    task.dueAt,
                    task.estMins,
                    task.priority,
                    task.status,
                    JSON.stringify(task.steps || []),
                    JSON.stringify(task.tags || []),
                    task.rubric || null,
                    task.createdAt,
                    task.updatedAt
                ]
            )

            // Migrate slots
            if (task.plan?.slots) {
                for (const slot of task.plan.slots) {
                    await query(
                        'INSERT INTO planner_slots (id, task_id, start_time, end_time, kind, done) VALUES (?, ?, ?, ?, ?, ?)',
                        [slot.id, task.id, slot.start, slot.end, slot.kind, slot.done || false]
                    )
                }
            }

            migrated++
            if (migrated % 10 === 0) {
                console.log(`[Migration] Migrated ${migrated} tasks...`)
            }
        } catch (error) {
            console.error(`[Migration] Failed to migrate task ${item.id}:`, error)
            errors++
        }
    }

    console.log(`[Migration] ✅ Migrated ${migrated} tasks (${errors} errors)`)
}

async function main() {
    try {
        console.log('='.repeat(60))
        console.log('[Migration] 🚀 Starting full migration to MySQL...')
        console.log('[Migration] Default user ID:', DEFAULT_USER_ID)
        console.log('='.repeat(60))

        // Create default user
        console.log('[Migration] Creating default user...')
        await query(
            'INSERT IGNORE INTO users (id, email, name) VALUES (?, ?, ?)',
            [DEFAULT_USER_ID, 'default@pagelm.local', 'Default User']
        )
        console.log('[Migration] ✅ Default user created')

        // Run migrations
        await migrateChats()
        await migrateDebates()
        await migrateFlashcards()
        await migratePlanner()

        console.log('='.repeat(60))
        console.log('[Migration] ✅ Migration completed successfully!')
        console.log('[Migration] 📝 Next steps:')
        console.log('[Migration]   1. Backup SQLite database: cp storage/database.sqlite storage/database.sqlite.backup')
        console.log('[Migration]   2. Test the application with MySQL')
        console.log('[Migration]   3. If everything works, you can remove SQLite dependency')
        console.log('='.repeat(60))

        await pool.end()
        process.exit(0)
    } catch (error) {
        console.error('='.repeat(60))
        console.error('[Migration] ❌ Migration failed:', error)
        console.error('='.repeat(60))
        await pool.end()
        process.exit(1)
    }
}

main()
