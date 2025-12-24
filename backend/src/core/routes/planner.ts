import { authMiddleware, AuthRequest } from "../../middleware/auth"
import { ensureUserExists } from "../../services/user/sync"
import { plannerService } from "../../services/planner/service"
import { CreateTaskRequest, UpdateTaskRequest, PlannerGenerateRequest, MaterialsRequest } from "../../services/planner/types"
import { emitToAll, emitLarge } from "../../utils/chat/ws"
import { parseMultipart } from "../../lib/parser/upload"
import crypto from "crypto"
import { mockGetWeaknesses, mockGetRecommendations } from "../../lib/external_mock"

const rooms = new Map<string, Set<any>>()
const log = (...a: any[]) => console.log("[planner]", ...a)

export function plannerRoutes(app: any) {
    // WebSocket endpoint
    app.ws("/ws/planner", (ws: any, req: any) => {
        const u = new URL(req.url, "http://localhost")
        const sid = u.searchParams.get("sid") || "default"
        let set = rooms.get(sid)
        if (!set) { set = new Set(); rooms.set(sid, set) }
        set.add(ws)
        ws.send(JSON.stringify({ type: "ready", sid }))
        ws.on("close", () => { set!.delete(ws); if (set!.size === 0) rooms.delete(sid) })
    })

    // Create task
    app.post("/tasks", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            await ensureUserExists(req.user!)
            const userId = req.userId!

            const ct = req.headers['content-type'] || ''
            const isMultipart = ct.includes("multipart/form-data")

            if (isMultipart) {
                const { q: text, files } = await parseMultipart(req)
                const request: CreateTaskRequest = { text, files }
                const task = await plannerService.createTaskFromRequest(userId, request)
                res.send({ ok: true, task })
                emitToAll(rooms.get(userId), { type: "task.created", task })
            } else {
                const request: CreateTaskRequest = req.body
                const task = await plannerService.createTaskFromRequest(userId, request)
                res.send({ ok: true, task })
                emitToAll(rooms.get(userId), { type: "task.created", task })
            }
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Ingest task from text
    app.post("/tasks/ingest", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            log("ingest: starting, userId:", req.userId)
            await ensureUserExists(req.user!)
            const userId = req.userId!
            log("ingest: user exists, parsing text")

            const text = String(req.body?.text || "").trim()
            if (!text) return res.status(400).send({ ok: false, error: "text required" })

            log("ingest: creating task from text:", text)
            const task = await plannerService.createTaskFromRequest(userId, { text })
            log("ingest: task created:", task.id)
            res.send({ ok: true, task })
            emitToAll(rooms.get(userId), { type: "task.created", task })
        } catch (e: unknown) {
            const error = e as Error
            log("ingest: ERROR:", error.message, error.stack)
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Get task by ID
    app.get("/tasks/:id", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const task = await plannerService.getTask(req.params.id)
            if (!task) return res.status(404).send({ ok: false, error: "Task not found" })
            res.send({ ok: true, task })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Replan task
    app.post("/tasks/:id/replan", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const task = await plannerService.replanTask(req.params.id)
            if (!task) return res.status(404).send({ ok: false, error: "Task not found" })
            res.send({ ok: true, task })
            emitToAll(rooms.get(req.userId!), { type: "plan.update", taskId: task.id, slots: task.plan?.slots || [] })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Plan single task
    app.post("/tasks/:id/plan", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const task = await plannerService.planSingleTask(req.params.id)
            if (!task) return res.status(404).send({ ok: false, error: "Task not found" })
            res.send({ ok: true, task })
            emitToAll(rooms.get(req.userId!), { type: "plan.update", taskId: task.id, slots: task.plan?.slots || [] })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Generate weekly plan
    app.post("/planner/weekly", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const request: PlannerGenerateRequest = req.body
            const result = await plannerService.generateWeeklyPlan(req.userId!, request)
            res.send({ ok: true, ...result })
            emitToAll(rooms.get(req.userId!), { type: "weekly.update", plan: result.plan })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Get today's sessions
    app.get("/planner/today", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const sessions = await plannerService.getTodaySessions(req.userId!)
            res.send({ ok: true, sessions })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Get upcoming deadlines
    app.get("/planner/deadlines", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const deadlines = await plannerService.getUpcomingDeadlines(req.userId!)
            res.send({ ok: true, ...deadlines })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Get suggestions
    app.get("/planner/suggestions", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const [weaknesses, recommendations] = await Promise.all([
                mockGetWeaknesses(),
                mockGetRecommendations()
            ])

            const suggestions = [
                ...weaknesses.map(w => ({
                    id: `w-${w.id}`,
                    type: 'weakness',
                    title: `Review Weakness: ${w.topic}`,
                    description: `Score: ${w.score}. Source: ${w.source}`,
                    priority: w.severity === 'high' ? 'high' : 'medium',
                    original: w
                })),
                ...recommendations.map(r => ({
                    id: `r-${r.id}`,
                    type: 'recommendation',
                    title: r.title,
                    description: r.description,
                    priority: 'medium',
                    original: r
                }))
            ]

            res.send({ ok: true, suggestions })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Get user stats
    app.get("/planner/stats", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const stats = await plannerService.getUserStats(req.userId!)
            res.send({ ok: true, stats })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Generate materials
    app.post("/tasks/:id/materials", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const id = req.params.id
            const request: MaterialsRequest = { type: req.body?.type || "summary" }
            // emitToAll(rooms.get(req.userId!), { type: "phase", value: "assist" })
            const materials = await plannerService.generateMaterials(id, request)

            // await emitLarge(rooms.get(req.userId!), "materials", { taskId: id, type: request.type, data: materials }, { gzip: true }) 
            // emitToAll(rooms.get(req.userId!), { type: "done", taskId: id })

            res.send({ ok: true, data: materials })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Update slot
    app.patch("/slots/:taskId/:slotId", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const { taskId, slotId } = req.params
            const { done, skip } = req.body
            const task = await plannerService.updateSlot(taskId, slotId, { done, skip })
            if (!task) return res.status(404).send({ ok: false, error: "Task or slot not found" })
            res.send({ ok: true, task })
            emitToAll(rooms.get(req.userId!), { type: "slot.update", taskId, slotId, done, skip })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // List tasks
    app.get("/tasks", authMiddleware, async (req: AuthRequest, res: any) => {
        log("GET /tasks: starting, userId:", req.userId)
        try {
            const { status, dueBefore, course } = req.query
            const filter: any = {}
            if (status) filter.status = status as string
            if (dueBefore) filter.dueBefore = dueBefore as string
            if (course) filter.course = course as string

            log("GET /tasks: calling listTasks")
            const tasks = await plannerService.listTasks(req.userId!, filter)
            log("GET /tasks: got tasks:", tasks.length)
            res.send({ ok: true, tasks })
        } catch (e: unknown) {
            const error = e as Error
            log("GET /tasks: ERROR:", error.message)
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Update task
    app.patch("/tasks/:id", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const updates: UpdateTaskRequest = req.body
            const task = await plannerService.updateTask(req.params.id, updates)
            if (!task) return res.status(404).send({ ok: false, error: "Task not found" })
            res.send({ ok: true, task })
            emitToAll(rooms.get(req.userId!), { type: "task.updated", task })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Delete task
    app.delete("/tasks/:id", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const success = await plannerService.deleteTask(req.params.id)
            if (!success) return res.status(404).send({ ok: false, error: "Task not found" })
            res.send({ ok: true })
            emitToAll(rooms.get(req.userId!), { type: "task.deleted", taskId: req.params.id })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Upload files to task
    app.post("/tasks/:id/files", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const ct = req.headers['content-type'] || ''
            if (!ct.includes("multipart/form-data")) {
                return res.status(400).send({ ok: false, error: "multipart/form-data required" })
            }

            const { files } = await parseMultipart(req)
            if (!files || files.length === 0) {
                return res.status(400).send({ ok: false, error: "no files uploaded" })
            }

            const taskId = req.params.id
            const uploadedFiles = await plannerService.addFilesToTask(taskId, files)
            res.send({ ok: true, files: uploadedFiles })
            emitToAll(rooms.get(req.userId!), { type: "task.files.added", taskId, files: uploadedFiles })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Delete file from task
    app.delete("/tasks/:id/files/:fileId", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const success = await plannerService.removeFileFromTask(req.params.id, req.params.fileId)
            if (!success) return res.status(404).send({ ok: false, error: "File not found" })
            res.send({ ok: true })
            emitToAll(rooms.get(req.userId!), { type: "task.file.removed", taskId: req.params.id, fileId: req.params.fileId })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Start session
    app.post("/sessions/start", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const { taskId, slotId } = req.body
            if (!taskId) return res.status(400).send({ ok: false, error: "taskId required" })

            const session = {
                id: crypto.randomUUID(),
                taskId,
                slotId,
                startedAt: new Date().toISOString(),
                status: 'active'
            }

            res.send({ ok: true, session })
            emitToAll(rooms.get(req.userId!), { type: "session.started", session })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Stop session
    app.post("/sessions/:id/stop", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const sessionId = req.params.id
            const { minutesWorked, completed } = req.body

            const session = {
                id: sessionId,
                endedAt: new Date().toISOString(),
                minutesWorked: minutesWorked || 0,
                completed: completed || false,
                status: 'completed'
            }

            res.send({ ok: true, session })
            emitToAll(rooms.get(req.userId!), { type: "session.ended", session })
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Schedule reminder
    app.post("/reminders/schedule", authMiddleware, async (req: AuthRequest, res: any) => {
        try {
            const { text, scheduledFor, taskId } = req.body
            if (!text || !scheduledFor) {
                return res.status(400).send({ ok: false, error: "text and scheduledFor required" })
            }

            const reminder = {
                id: crypto.randomUUID(),
                text,
                taskId,
                scheduledFor,
                createdAt: new Date().toISOString()
            }

            res.send({ ok: true, reminder })

            const delayMs = new Date(scheduledFor).getTime() - Date.now()
            if (delayMs > 0) {
                setTimeout(() => {
                    emitToAll(rooms.get(req.userId!), {
                        type: "reminder",
                        id: reminder.id,
                        text: reminder.text,
                        taskId: reminder.taskId,
                        scheduledFor: reminder.scheduledFor
                    })
                }, delayMs)
            }
        } catch (e: unknown) {
            const error = e as Error
            res.status(500).send({ ok: false, error: error?.message || "failed" })
        }
    })

    // Test reminder
    app.post("/reminders/test", authMiddleware, async (req: AuthRequest, res: any) => {
        emitToAll(rooms.get(req.userId!), { type: "reminder", text: "Test reminder", at: Date.now() + 60000 })
        res.send({ ok: true })
    })
}
