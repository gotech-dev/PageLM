import { randomUUID } from "crypto"
import { query, queryOne } from "../database/mysql"

export type ChatMeta = { id: string; title: string; userId: string; createdAt: Date; updatedAt: Date }
export type ChatMsg = { role: "user" | "assistant"; content: any; createdAt: Date }

export async function mkChat(userId: string, title: string): Promise<ChatMeta> {
  const id = randomUUID()

  await query(
    'INSERT INTO chats (id, user_id, title) VALUES (?, ?, ?)',
    [id, userId, title.slice(0, 60)]
  )

  return {
    id,
    title: title.slice(0, 60),
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export async function getChat(id: string): Promise<ChatMeta | null> {
  return queryOne<ChatMeta>(
    'SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt FROM chats WHERE id = ?',
    [id]
  )
}

export async function addMsg(chatId: string, msg: ChatMsg): Promise<void> {
  await query(
    'INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
    [chatId, msg.role, JSON.stringify(msg.content)]
  )

  // Update chat's updated_at
  await query(
    'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [chatId]
  )
}

export async function listChats(userId: string, limit = 50): Promise<ChatMeta[]> {
  return query<ChatMeta>(
    `SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt 
     FROM chats 
     WHERE user_id = ? 
     ORDER BY updated_at DESC 
     LIMIT ?`,
    [userId, limit]
  )
}

export async function getMsgs(chatId: string): Promise<ChatMsg[]> {
  const rows = await query<any>(
    'SELECT role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
    [chatId]
  )

  return rows.map(row => ({
    role: row.role,
    content: JSON.parse(row.content),
    createdAt: row.createdAt
  }))
}

export async function deleteChat(chatId: string): Promise<void> {
  await query('DELETE FROM chats WHERE id = ?', [chatId])
}
