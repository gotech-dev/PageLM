import { Task, Slot, PlanPolicy, CreateTaskRequest, UpdateTaskRequest, PlannerGenerateRequest, MaterialsRequest } from "./types"
import { createTask, getTask, updateTask, deleteTask, listTasks } from "./store"
import { parseTask, generateSteps, makeSlots, replan, calculateUrgencyScore } from "./ai"
import { planTask, planTasks, weeklyPlan, defaultPolicy } from "./scheduler"
import { handleAsk } from "../../lib/ai/ask"
import crypto from "crypto"

export class PlannerService {
    private policy: PlanPolicy

    constructor(policy?: PlanPolicy) {
        this.policy = policy || defaultPolicy()
    }

    async createTaskFromRequest(userId: string, req: CreateTaskRequest): Promise<Task> {
        let taskData: Partial<Task>

        if (req.text) {
            // Quick heuristic parsing (no AI)
            const heuristic = this.quickParseText(req.text)

            taskData = {
                title: req.title || heuristic.title || req.text,
                course: req.course || heuristic.course,
                type: req.type || heuristic.type,
                notes: req.notes || heuristic.notes,
                dueAt: req.dueAt || heuristic.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                estMins: req.estMins || heuristic.estMins || 60,
                priority: req.priority || heuristic.priority || 3,
                steps: []
            }
        } else {
            taskData = {
                title: req.title || "Untitled Task",
                course: req.course,
                type: req.type,
                notes: req.notes,
                dueAt: req.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                estMins: req.estMins || 60,
                priority: req.priority || 3,
                steps: []
            }
        }

        // Create task immediately with basic data
        const task = await createTask(userId, {
            title: taskData.title || "Untitled Task",
            course: taskData.course,
            type: taskData.type,
            notes: taskData.notes,
            dueAt: taskData.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            estMins: taskData.estMins || 60,
            priority: taskData.priority || 3,
            status: 'todo',
            steps: taskData.steps || []
        })

        // Add files if provided
        if (req.files && req.files.length > 0) {
            await this.addFilesToTask(task.id, req.files)
        }

        // Enhance with AI in background (don't await)
        if (req.text) {
            this.enhanceTaskWithAI(task.id, req.text).catch(err => {
                console.error('[PlannerService] AI enhancement failed for task', task.id, err)
            })
        }

        return task
    }

    // Quick heuristic parsing without AI
    private quickParseText(text: string): Partial<Task> {
        const result: Partial<Task> = {
            title: text.trim(),
            estMins: 60,
            priority: 3
        }

        // Extract time estimates (e.g., "2h", "30min", "1 giờ")
        const timeMatch = text.match(/(\d+)\s*(h|hour|giờ|phút|min|minute)/i)
        if (timeMatch) {
            const num = parseInt(timeMatch[1])
            const unit = timeMatch[2].toLowerCase()
            result.estMins = (unit.startsWith('h') || unit === 'giờ') ? num * 60 : num
        }

        // Extract course/subject (simple pattern matching)
        const courseMatch = text.match(/(toán|văn|anh|lý|hóa|sinh|sử|địa|math|english|physics|chemistry)/i)
        if (courseMatch) {
            result.course = courseMatch[1]
        }

        return result
    }

    // Background AI enhancement
    private async enhanceTaskWithAI(taskId: string, originalText: string): Promise<void> {
        try {
            console.log('[PlannerService] Starting AI enhancement for task:', taskId)

            // Parse with AI
            const aiData = await parseTask(originalText)

            // Generate steps
            const tempTask = { ...aiData, id: taskId } as Task
            const steps = await generateSteps(tempTask)

            // Update task with AI-enhanced data
            await updateTask(taskId, {
                title: aiData.title,
                course: aiData.course,
                type: aiData.type,
                notes: aiData.notes,
                dueAt: aiData.dueAt,
                estMins: aiData.estMins,
                priority: aiData.priority,
                steps
            })

            console.log('[PlannerService] AI enhancement completed for task:', taskId)
        } catch (error) {
            console.error('[PlannerService] AI enhancement error:', error)
            // Task already created, so this is non-critical
        }
    }

    async getTask(id: string): Promise<Task | null> {
        return getTask(id)
    }

    async updateTask(id: string, req: UpdateTaskRequest): Promise<Task | null> {
        const existing = await getTask(id)
        if (!existing) return null

        let steps = existing.steps
        if (req.title || req.type || req.notes) {
            const updatedTask = { ...existing, ...req }
            steps = await generateSteps(updatedTask)
        }

        return updateTask(id, { ...req, steps })
    }

    async deleteTask(id: string): Promise<boolean> {
        return deleteTask(id)
    }

    async listTasks(userId: string, filter?: { status?: string; dueBefore?: string; course?: string }): Promise<Task[]> {
        return listTasks(userId, filter)
    }

    async planSingleTask(taskId: string): Promise<Task | null> {
        const task = await getTask(taskId)
        if (!task) return null

        const plannedTask = planTask(task, this.policy)
        await updateTask(taskId, { plan: plannedTask.plan })

        return plannedTask
    }

    async generateWeeklyPlan(userId: string, req?: PlannerGenerateRequest): Promise<{ tasks: Task[]; plan: any }> {
        const policy = { ...this.policy, ...req?.policy }

        const tasks = await listTasks(userId, { status: 'todo' })

        const plannedTasks = planTasks(tasks, policy)

        for (const task of plannedTasks) {
            await updateTask(task.id, { plan: task.plan })
        }

        const plan = weeklyPlan(plannedTasks, policy)

        return { tasks: plannedTasks, plan }
    }

    async getTodaySessions(userId: string): Promise<{ task: Task; slots: Slot[] }[]> {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

        const tasks = await listTasks(userId, { status: 'todo' })
        const todaySessions: { task: Task; slots: Slot[] }[] = []

        for (const task of tasks) {
            if (!task.plan?.slots) continue

            const todaySlots = task.plan.slots.filter(slot => {
                const slotDate = new Date(slot.start)
                return slotDate >= today && slotDate < tomorrow
            })

            if (todaySlots.length > 0) {
                todaySessions.push({ task, slots: todaySlots })
            }
        }

        return todaySessions.sort((a, b) => {
            const aStart = new Date(a.slots[0].start).getTime()
            const bStart = new Date(b.slots[0].start).getTime()
            return aStart - bStart
        })
    }

    async updateSlot(taskId: string, slotId: string, updates: { done?: boolean; skip?: boolean }): Promise<Task | null> {
        const task = await getTask(taskId)
        if (!task?.plan?.slots) return null

        const slotIndex = task.plan.slots.findIndex(s => s.id === slotId)
        if (slotIndex === -1) return null

        const updatedSlots = [...task.plan.slots]
        updatedSlots[slotIndex] = {
            ...updatedSlots[slotIndex],
            done: updates.done
        }

        if (updates.skip) {
            await this.replanTask(taskId)
            return getTask(taskId)
        }

        const updatedPlan = { ...task.plan, slots: updatedSlots }
        return updateTask(taskId, { plan: updatedPlan })
    }

    async replanTask(taskId: string): Promise<Task | null> {
        const task = await getTask(taskId)
        if (!task?.plan) return null

        const now = new Date()
        const missedSlots = task.plan.slots.filter(s => new Date(s.end) < now && !s.done)
        const remainingSlots = task.plan.slots.filter(s => new Date(s.start) >= now)

        // Extract userId from task
        const userId = (task as any).userId || 'default'
        const allTasks = await listTasks(userId, { status: 'todo' })

        const newSlots = replan(missedSlots, remainingSlots, allTasks, task.plan.policy)
        const taskSlots = newSlots.filter(s => s.taskId === taskId)

        const updatedPlan = {
            ...task.plan,
            slots: taskSlots,
            lastPlannedAt: new Date().toISOString()
        }

        return updateTask(taskId, { plan: updatedPlan })
    }

    async generateMaterials(taskId: string, req: MaterialsRequest, onChunk?: (chunk: string) => void): Promise<any> {
        const task = await getTask(taskId)
        if (!task) throw new Error('Task not found')

        const content = `${task.title}\n${task.notes || ''}\nSteps: ${task.steps?.join(', ') || ''}`

        let result: any
        switch (req.type) {
            case 'summary':
                result = await this.generateSummary(content, onChunk)
                break
            case 'studyGuide':
                result = await this.generateStudyGuide(content, task)
                break
            case 'flashcards':
                result = await this.generateFlashcards(content, task)
                break
            case 'quiz':
                result = await this.generateQuiz(content, task)
                break
            default:
                throw new Error('Invalid material type')
        }

        // Persist the result
        const materials = task.materials || {}
        materials[req.type] = result
        await updateTask(taskId, { materials })
        return result
    }

    private async generateSummary(content: string, onChunk?: (chunk: string) => void): Promise<string> {
        const prompt = `Create a clear, concise summary of this study material.
        Use professional GitHub-Flavored Markdown with headings, bold text, and lists.
        For math, use LaTeX: $...$ for inline, $$...$$ for blocks.`

        const response = await handleAsk({
            q: prompt + '\n\n' + content,
            jsonMode: false,
            onChunk
        })
        return response.answer
    }

    private async generateStudyGuide(content: string, task: Task): Promise<string> {
        const prompt = `Create a comprehensive study guide for this ${task.type || 'assignment'}. Include:
        - Key concepts and definitions
        - Important formulas or principles
        - Practice questions
        - Study tips specific to this topic

        Format as a structured guide with clear sections:`

        const response = await handleAsk(prompt + '\n\n' + content)
        return response.answer
    }

    private async generateFlashcards(content: string, task: Task): Promise<Array<{ front: string; back: string }>> {
        const prompt = `Create 10-15 flashcards for this ${task.type || 'assignment'}. 
        Return as JSON array with "front" and "back" properties.
        Focus on key concepts, definitions, formulas, and important facts.
        
        Example format:
        [
          {"front": "What is the derivative of x^2?", "back": "2x"},
          {"front": "Define photosynthesis", "back": "The process by which plants convert light energy into chemical energy"}
        ]`

        try {
            const response = await handleAsk(prompt + '\n\n' + content)
            return JSON.parse(response.answer)
        } catch (error) {
            console.warn('Failed to parse flashcards JSON, returning default')
            return [
                { front: `Key concept from ${task.title}`, back: 'Review the main material' }
            ]
        }
    }

    private async generateQuiz(content: string, task: Task): Promise<any> {
        const prompt = `Create a 5-question quiz for this ${task.type || 'assignment'}.
        Include multiple choice and short answer questions.
        Focus on testing understanding of key concepts.`

        const response = await handleAsk(prompt + '\n\n' + content)
        return response.answer
    }

    async getUpcomingDeadlines(userId: string): Promise<{ urgent: Task[]; atRisk: Task[]; upcoming: Task[] }> {
        const tasks = await listTasks(userId, { status: 'todo' })
        const now = new Date()

        const urgent: Task[] = []
        const atRisk: Task[] = []
        const upcoming: Task[] = []

        for (const task of tasks) {
            const deadline = new Date(task.dueAt)
            const hoursToDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

            const hasScheduledWork = task.plan?.slots?.some(s => new Date(s.start) >= now)

            if (hoursToDeadline < 24) {
                urgent.push(task)
            } else if (hoursToDeadline < 72 && !hasScheduledWork) {
                atRisk.push(task)
            } else if (hoursToDeadline < 168) {
                upcoming.push(task)
            }
        }

        return { urgent, atRisk, upcoming }
    }

    async getUserStats(userId: string): Promise<any> {
        const allTasks = await listTasks(userId)
        const completedTasks = allTasks.filter(t => t.status === 'done')

        const totalPlannedMinutes = allTasks.reduce((sum, task) => {
            return sum + (task.plan?.slots?.length || 0) * this.policy.pomodoroMins
        }, 0)

        const completedMinutes = completedTasks.reduce((sum, task) => {
            const completedSlots = task.plan?.slots?.filter(s => s.done) || []
            return sum + completedSlots.length * this.policy.pomodoroMins
        }, 0)

        const onTimeCompletions = completedTasks.filter(task => {
            return new Date(task.updatedAt) <= new Date(task.dueAt)
        }).length

        return {
            totalTasks: allTasks.length,
            completedTasks: completedTasks.length,
            totalPlannedMinutes,
            completedMinutes,
            onTimeRatio: completedTasks.length > 0 ? onTimeCompletions / completedTasks.length : 0,
            averageEstimateAccuracy: this.calculateEstimateAccuracy(completedTasks)
        }
    }

    async addFilesToTask(taskId: string, files: any[]): Promise<any[]> {
        const task = await getTask(taskId)
        if (!task) throw new Error("Task not found")

        const { saveTaskFile } = await import("./store")
        const uploadedFiles: any[] = []

        for (const file of files) {
            const taskFile = {
                id: crypto.randomUUID(),
                taskId,
                filename: file.filename,
                originalName: file.filename,
                mimeType: file.mimeType,
                size: require('fs').statSync(file.path).size,
                uploadedAt: new Date().toISOString()
            }

            await saveTaskFile(taskFile)
            uploadedFiles.push(taskFile)
        }

        return uploadedFiles
    }

    async removeFileFromTask(taskId: string, fileId: string): Promise<boolean> {
        const task = await getTask(taskId)
        if (!task) return false

        const { deleteTaskFile } = await import("./store")
        try {
            await deleteTaskFile(fileId)
            return true
        } catch {
            return false
        }
    }

    private calculateEstimateAccuracy(completedTasks: Task[]): number {
        if (completedTasks.length === 0) return 1.0

        let totalAccuracy = 0
        let validTasks = 0

        for (const task of completedTasks) {
            if (task.metrics?.minutesSpent && task.estMins > 0) {
                const accuracy = Math.min(task.estMins / task.metrics.minutesSpent, 2)
                totalAccuracy += accuracy
                validTasks++
            }
        }

        return validTasks > 0 ? totalAccuracy / validTasks : 1.0
    }
}

export const plannerService = new PlannerService()