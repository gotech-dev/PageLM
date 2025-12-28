import mysql from 'mysql2/promise'

interface MySQLConfig {
    host: string
    port: number
    user: string
    password: string
    database: string
    connectionLimit: number
    waitForConnections: boolean
    queueLimit: number
    connectTimeout?: number
    acquireTimeout?: number
}

const config: MySQLConfig = {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
    user: process.env.DB_USERNAME || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'pagelm',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000,  // 10 seconds
    acquireTimeout: 10000   // 10 seconds
}

console.log('[MySQL] Config:', { host: config.host, port: config.port, user: config.user, database: config.database, hasPassword: !!config.password })

export const pool = mysql.createPool(config as any)

// Health check
export async function checkConnection() {
    try {
        const connection = await pool.getConnection()
        await connection.ping()
        connection.release()
        console.log('[MySQL] Connection healthy ✓')
        return true
    } catch (error) {
        console.error('[MySQL] Connection failed:', error)
        return false
    }
}

// Helper functions
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    console.log('[MySQL] Query:', sql.substring(0, 100))
    try {
        const [rows] = await pool.execute(sql, params)
        console.log('[MySQL] Query success, rows:', (rows as any[]).length)
        return rows as T[]
    } catch (error) {
        console.error('[MySQL] Query error:', error)
        throw error
    }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(sql, params)
    return rows[0] || null
}

export async function insert(sql: string, params?: any[]): Promise<number> {
    const [result] = await pool.execute(sql, params)
    return (result as any).insertId
}

export async function update(sql: string, params?: any[]): Promise<number> {
    const [result] = await pool.execute(sql, params)
    return (result as any).affectedRows
}

export default pool
