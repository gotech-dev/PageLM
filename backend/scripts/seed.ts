import { query } from '../src/utils/database/mysql'
import { randomUUID } from 'crypto'

async function seedUsers() {
    console.log('[Seeder] Creating users...')

    const users = [
        {
            id: randomUUID(),
            email: 'gotechjsc@gmail.com',
            password: '123456',
            name: 'Go Tech JSC'
        },
        {
            id: randomUUID(),
            email: 'test@pagelm.com',
            password: 'password123',
            name: 'Test User'
        }
    ]

    for (const user of users) {
        try {
            // Check if user exists
            const existing = await query(
                'SELECT id FROM users WHERE email = ?',
                [user.email]
            )

            if (existing.length > 0) {
                console.log(`[Seeder] User ${user.email} already exists, skipping...`)
                continue
            }

            // Insert user
            await query(
                'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
                [user.id, user.email, user.name]
            )

            console.log(`[Seeder] ✅ Created user: ${user.email}`)
            console.log(`   ID: ${user.id}`)
            console.log(`   Password: ${user.password}`)
        } catch (error) {
            console.error(`[Seeder] ❌ Failed to create user ${user.email}:`, error)
        }
    }
}

async function main() {
    try {
        console.log('='.repeat(60))
        console.log('[Seeder] 🌱 Starting database seeding...')
        console.log('='.repeat(60))

        await seedUsers()

        console.log('='.repeat(60))
        console.log('[Seeder] ✅ Seeding completed!')
        console.log('='.repeat(60))
        console.log('')
        console.log('Test accounts created:')
        console.log('  1. gotechjsc@gmail.com / 123456')
        console.log('  2. test@pagelm.com / password123')
        console.log('')

        process.exit(0)
    } catch (error) {
        console.error('='.repeat(60))
        console.error('[Seeder] ❌ Seeding failed:', error)
        console.error('='.repeat(60))
        process.exit(1)
    }
}

main()
