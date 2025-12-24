import { query, queryOne } from "../../utils/database/mysql"
import crypto from "crypto"
import { Task, TaskFile, Slot, PlanPolicy } from "./types"

// Convert ISO datetime to MySQL datetime format (with default fallback)
function toMySQLDateTime(isoDate: string | null | undefined): string {
    // Default to 7 days from now if no date provided
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    if (!isoDate) {
        return defaultDate.toISOString().slice(0, 19).replace('T', ' ')
    }
    try {
        const date = new Date(isoDate)
        if (isNaN(date.getTime())) {
            return defaultDate.toISOString().slice(0, 19).replace('T', ' ')
        }
        return date.toISOString().slice(0, 19).replace('T', ' ')
    } catch {
        return defaultDate.toISOString().slice(0, 19).replace('T', ' ')
    }
}

// Valid ENUM values for type column
const VALID_TASK_TYPES = ['homework', 'project', 'lab', 'essay', 'exam'] as const
type ValidTaskType = typeof VALID_TASK_TYPES[number]

function validateTaskType(type: string | undefined): ValidTaskType | null {
    if (!type) return null
    const normalized = type.toLowerCase().trim()
    return (VALID_TASK_TYPES as readonly string[]).includes(normalized)
        ? normalized as ValidTaskType
        : 'homework'
}

export async function createTask(userId: string, t: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
    const id = crypto.randomUUID()

    await query(
        `INSERT INTO planner_tasks 
     (id, user_id, course, title, type, notes, due_at, est_mins, priority, status, steps, tags, rubric, source_kind, source_ref, source_page)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, userId, t.course || null, t.title, validateTaskType(t.type), t.notes || null,
            toMySQLDateTime(t.dueAt), t.estMins, t.priority, t.status || 'todo',
            JSON.stringify(t.steps || []), JSON.stringify(t.tags || []),
            t.rubric || null, t.source?.kind || null, t.source?.ref || null, t.source?.page || null
        ]
    )

    const task = await getTask(id)
    return task!
}

export async function getTask(id: string): Promise<Task | null> {
    const row = await queryOne<any>(
        'SELECT * FROM planner_tasks WHERE id = ?',
        [id]
    )

    if (!row) return null

    // Get slots
    const slots = await query<any>(
        'SELECT id, task_id as taskId, start_time as start, end_time as end, kind, done FROM planner_slots WHERE task_id = ? ORDER BY start_time ASC',
        [id]
    )

    // Get files
    const files = await getTaskFiles(id)

    // Get metrics
    const metrics = await queryOne<any>(
        'SELECT sessions, minutes_spent as minutesSpent, quiz_avg as quizAvg FROM planner_metrics WHERE task_id = ?',
        [id]
    )

    // Get user policy
    const policy = await getUserPolicy(row.user_id)

    // Safe JSON parse helper
    const safeJSONParse = (str: string, fallback: any = []) => {
        try {
            return JSON.parse(str || JSON.stringify(fallback))
        } catch {
            return fallback
        }
    }

    return {
        id: row.id,
        course: row.course,
        title: row.title,
        type: row.type,
        notes: row.notes,
        dueAt: row.due_at,
        estMins: row.est_mins,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        steps: safeJSONParse(row.steps, []),
        tags: safeJSONParse(row.tags, []),
        rubric: row.rubric,
        source: row.source_kind ? {
            kind: row.source_kind,
            ref: row.source_ref,
            page: row.source_page
        } : undefined,
        plan: slots.length > 0 ? {
            slots,
            policy,
            lastPlannedAt: row.updated_at
        } : undefined,
        metrics: metrics || undefined,
        files
    }
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | null> {
    const fields: string[] = []
    const values: any[] = []

    if (patch.title !== undefined) { fields.push('title = ?'); values.push(patch.title) }
    if (patch.course !== undefined) { fields.push('course = ?'); values.push(patch.course) }
    if (patch.type !== undefined) { fields.push('type = ?'); values.push(validateTaskType(patch.type)) }
    if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes) }
    if (patch.dueAt !== undefined) { fields.push('due_at = ?'); values.push(toMySQLDateTime(patch.dueAt)) }
    if (patch.estMins !== undefined) { fields.push('est_mins = ?'); values.push(patch.estMins) }
    if (patch.priority !== undefined) { fields.push('priority = ?'); values.push(patch.priority) }
    if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status) }
    if (patch.steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(patch.steps)) }
    if (patch.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(patch.tags)) }
    if (patch.rubric !== undefined) { fields.push('rubric = ?'); values.push(patch.rubric) }

    if (fields.length > 0) {
        values.push(id)
        await query(
            `UPDATE planner_tasks SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        )
    }

    // Update slots if provided
    if (patch.plan?.slots) {
        await query('DELETE FROM planner_slots WHERE task_id = ?', [id])

        for (const slot of patch.plan.slots) {
            await query(
                'INSERT INTO planner_slots (id, task_id, start_time, end_time, kind, done) VALUES (?, ?, ?, ?, ?, ?)',
                [slot.id, id, toMySQLDateTime(slot.start), toMySQLDateTime(slot.end), slot.kind, slot.done || false]
            )
        }
    }

    return getTask(id)
}

export async function deleteTask(id: string): Promise<boolean> {
    await query('DELETE FROM planner_tasks WHERE id = ?', [id])
    return true
}

export async function listTasks(userId: string, filter?: { status?: string; dueBefore?: string; course?: string }): Promise<Task[]> {
    let sql = 'SELECT id FROM planner_tasks WHERE user_id = ?'
    const params: any[] = [userId]

    if (filter?.status) {
        sql += ' AND status = ?'
        params.push(filter.status)
    }

    if (filter?.dueBefore) {
        sql += ' AND due_at < ?'
        params.push(filter.dueBefore)
    }

    if (filter?.course) {
        sql += ' AND course = ?'
        params.push(filter.course)
    }

    sql += ' ORDER BY due_at ASC'

    const rows = await query<{ id: string }>(sql, params)
    const tasks = await Promise.all(rows.map(r => getTask(r.id)))

    return tasks.filter(t => t !== null) as Task[]
}

async function getUserPolicy(userId: string): Promise<PlanPolicy> {
    const policy = await queryOne<any>(
        'SELECT pomodoro_mins, break_mins, max_daily_mins, cram_mode FROM planner_policies WHERE user_id = ?',
        [userId]
    )

    if (policy) {
        return {
            pomodoroMins: policy.pomodoro_mins,
            breakMins: policy.break_mins,
            maxDailyMins: policy.max_daily_mins,
            cram: policy.cram_mode
        }
    }

    return { pomodoroMins: 25, breakMins: 5, maxDailyMins: 240, cram: false }
}

async function getTaskFiles(taskId: string): Promise<TaskFile[]> {
    return query<TaskFile>(
        `SELECT id, task_id as taskId, filename, original_name as originalName, 
     mime_type as mimeType, size_bytes as size, uploaded_at as uploadedAt 
     FROM planner_task_files WHERE task_id = ?`,
        [taskId]
    )
}

export async function saveTaskFile(file: TaskFile): Promise<void> {
    await query(
        'INSERT INTO planner_task_files (id, task_id, filename, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)',
        [file.id, file.taskId, file.filename, file.originalName, file.mimeType, file.size]
    )
}

export async function deleteTaskFile(id: string): Promise<void> {
    await query('DELETE FROM planner_task_files WHERE id = ?', [id])
}

export async function deleteTaskFiles(taskId: string): Promise<void> {
    await query('DELETE FROM planner_task_files WHERE task_id = ?', [taskId])
}

export async function saveUserPolicy(userId: string, policy: PlanPolicy): Promise<void> {
    await query(
        `INSERT INTO planner_policies (user_id, pomodoro_mins, break_mins, max_daily_mins, cram_mode)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     pomodoro_mins = VALUES(pomodoro_mins),
     break_mins = VALUES(break_mins),
     max_daily_mins = VALUES(max_daily_mins),
     cram_mode = VALUES(cram_mode)`,
        [userId, policy.pomodoroMins, policy.breakMins, policy.maxDailyMins || 240, policy.cram || false]
    )
}