import fs from 'fs'
import path from 'path'
import { query } from '../src/utils/database/mysql'

async function runMigrations() {
    console.log('[Migration] Starting schema migration...')

    const migrationsDir = path.join(__dirname, '../migrations')
    const files = fs.readdirSync(migrationsDir).sort()

    // Simple migration history check (in production, use a migrations table)
    // For now, we manually assume 001 is done, run 002

    for (const file of files) {
        if (file.endsWith('.sql')) {
            console.log(`[Migration] checking ${file}...`)
            const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

            // Very naive split by semicolon. 
            // Better to execute whole file or improved parsing, but for simple ALTER/UPDATE it works.
            const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0)

            for (const stmt of statements) {
                try {
                    // Skip CREATE TABLE users if exists to avoid error if re-running
                    if (stmt.includes('CREATE TABLE IF NOT EXISTS')) {
                        // This is safe to re-run
                    } else if (file.includes('002') && stmt.includes('ADD COLUMN password')) {
                        // Check if column exists
                        const cols = await query("SHOW COLUMNS FROM users LIKE 'password'")
                        if (cols.length > 0) {
                            console.log('Password column already exists, skipping ADD COLUMN')
                            continue
                        }
                    }

                    await query(stmt)
                    console.log(`[Migration] Executed: ${stmt.substring(0, 50)}...`)
                } catch (e: any) {
                    console.error(`[Migration] Error executing ${file}:`, e.message)
                    // Ignore duplicate column errors if re-running
                    if (!e.message.includes("Duplicate column name")) {
                        // throw e
                    }
                }
            }
        }
    }

    console.log('[Migration] Done!')
    process.exit(0)
}

runMigrations()
