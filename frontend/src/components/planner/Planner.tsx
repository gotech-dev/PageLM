import { useEffect, useMemo, useRef, useState } from "react"
import PlannerMindmap from "./PlannerMindmap"
import TodayFocus from "./TodayFocus"
import QuickAdd from "./QuickAdd"
import Suggestions from "./Suggestions"
import FocusTimer from "./FocusTimer"
import CalendarView from "./CalendarView"
import AnalyticsView from "./AnalyticsView"
import { useLanguage } from "../../lib/LanguageContext"
import { connectPlannerStream, plannerDelete, plannerIngest, plannerList, plannerMaterials, plannerPlan, plannerUpdate, plannerWeekly, plannerCreateWithFiles, plannerUploadFiles, plannerDeleteFile, type PlannerEvent, type PlannerSlot, type PlannerTask, type WeeklyPlan } from "../../lib/api"

function fmtTime(ts: number) {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

import MarkdownView from "../Chat/MarkdownView"

export default function Planner() {
    const { t } = useLanguage()
    const [text, setText] = useState("")
    const [loading, setLoading] = useState(false)
    const [tasks, setTasks] = useState<PlannerTask[]>([])
    const [sid] = useState(() => Math.random().toString(36).slice(2, 10))
    const [plan, setPlan] = useState<WeeklyPlan | null>(null)
    const [materials, setMaterials] = useState<Record<string, any>>({})
    const [loadingStates, setLoadingStates] = useState<Record<string, { plan?: boolean; summary?: boolean; flashcards?: boolean }>>({})
    const wsRef = useRef<ReturnType<typeof connectPlannerStream> | null>(null)

    // Updated View State
    const [view, setView] = useState<"overview" | "calendar" | "mindmap" | "analytics">("overview")

    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message: string; at: number }>>([])

    const slotsByTask = useMemo(() => {
        const m: Record<string, PlannerSlot[]> = {}
        for (const d of plan?.days || []) for (const s of d.slots) (m[s.taskId] ||= []).push(s)
        for (const k of Object.keys(m)) m[k].sort((a, b) => a.start - b.start)
        return m
    }, [plan])

    // WebSocket & Notification logic
    useEffect(() => {
        const m: Record<string, any> = {}
        tasks.forEach(t => {
            if (t.materials) m[t.id] = { ...(m[t.id] || {}), ...t.materials }
        })
        setMaterials(prev => ({ ...prev, ...m }))
    }, [tasks])

    useEffect(() => {
        wsRef.current = connectPlannerStream(sid, (ev: PlannerEvent) => {
            if (ev.type === "ready") {
                console.log("[Planner] WebSocket Ready:", ev)
                plannerList().then(t => setTasks(t.tasks)).catch(() => { })
            }
            if (ev.type === "plan.update") {
                setTasks(t => t.map(x => x.id === ev.taskId ? { ...x, plan: { ...((x as PlannerTask).plan || {}), slots: ev.slots } } as PlannerTask : x))
                plannerWeekly(false).then(wp => setPlan(wp.plan)).catch(() => { })
            }
            if (ev.type === "task.created") {
                setTasks(t => [ev.task, ...t.filter(x => x.id !== ev.task.id)])
                addNotification("success", `Task "${ev.task.title}" created`)
            }
            if (ev.type === "task.updated") {
                setTasks(t => t.map(x => x.id === ev.task.id ? ev.task : x))
            }
            if (ev.type === "task.deleted") {
                setTasks(t => t.filter(x => x.id !== ev.taskId))
                addNotification("info", "Task deleted")
            }
            if (ev.type === "task.files.added") {
                setTasks(t => t.map(x => x.id === ev.taskId ? { ...x, files: [...(x.files || []), ...ev.files] } : x))
                addNotification("success", `${ev.files.length} file(s) uploaded`)
            }
            if (ev.type === "task.file.removed") {
                setTasks(t => t.map(x => x.id === ev.taskId ? { ...x, files: (x.files || []).filter(f => f.id !== ev.fileId) } : x))
            }
            if (ev.type === "daily.digest") {
                addNotification("info", ev.message)
            }
            if (ev.type === "reminder") {
                addNotification("reminder", ev.text)
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Homework Reminder', { body: ev.text })
                }
            }
            if (ev.type === "break.reminder") {
                addNotification("break", ev.text)
            }
            if (ev.type === "evening.review") {
                addNotification("info", ev.message)
            }
            if (ev.type === "session.started") {
                addNotification("success", "Study session started")
            }
            if (ev.type === "session.ended") {
                addNotification("success", `Session completed: ${ev.session.minutesWorked} minutes`)
            }
            if (ev.type === "phase" && ev.value === "preparing") {
                setLoadingStates(prev => ({ ...prev, [ev.taskId]: { ...prev[ev.taskId], summary: true } }))
                setMaterials(m => ({ ...m, [ev.taskId]: { ...(m[ev.taskId] || {}), summary: "" } }))
            }
            if (ev.type === "done") {
                setLoadingStates(prev => ({ ...prev, [ev.taskId]: { ...prev[ev.taskId], summary: false } }))
            }
            if (ev.type === "materials.chunk") {
                // ev.taskId, ev.kind (summary/studyGuide...), ev.data
                setMaterials(m => {
                    const taskMats = m[ev.taskId] || {}
                    const currentKindData = taskMats[ev.kind] || ""
                    const newData = typeof currentKindData === 'string'
                        ? currentKindData + ev.data
                        : ev.data

                    return {
                        ...m,
                        [ev.taskId]: {
                            ...taskMats,
                            [ev.kind]: newData
                        }
                    }
                })
            }
        })
        return () => { try { wsRef.current?.close() } catch { /* ignore */ } }
    }, [sid])

    const addNotification = (type: string, message: string) => {
        const id = Math.random().toString(36).slice(2)
        setNotifications(n => [{ id, type, message, at: Date.now() }, ...n.slice(0, 4)])
        setTimeout(() => {
            setNotifications(n => n.filter(x => x.id !== id))
        }, 5000)
    }

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    const reload = async () => {
        try {
            const res = await plannerList()
            setTasks(res.tasks)
            const wp = await plannerWeekly(false)
            setPlan(wp.plan)
        } catch (error) {
            console.error("Reload error:", error)
        }
    }

    useEffect(() => { reload() }, [])

    const add = async (data?: { text?: string; files?: File[] }) => {
        const taskText = data?.text || text
        const taskFiles = data?.files || selectedFiles

        if (!taskText.trim() && taskFiles.length === 0) return
        setLoading(true)
        try {
            console.log('[Planner] Adding task:', { taskText, filesCount: taskFiles.length })
            if (taskFiles.length > 0) {
                const result = await plannerCreateWithFiles({ text: taskText, files: taskFiles })
                console.log('[Planner] Result with files:', result)
                const { task } = result
                if (!data) {
                    setText("")
                    setSelectedFiles([])
                }
                setTasks(t => [task, ...t.filter(x => x.id !== task.id)])
                addNotification("success", `Task "${task.title}" created`)
            } else {
                const result = await plannerIngest(taskText)
                console.log('[Planner] Result from ingest:', result)
                const { task } = result
                if (!data) {
                    setText("")
                }
                setTasks(t => [task, ...t.filter(x => x.id !== task.id)])
                addNotification("success", `Task "${task.title}" created`)
            }
        } catch (error) {
            console.error('[Planner] Error adding task:', error)
            addNotification("error", `Failed to add task: ${(error as any)?.message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    const planTask = async (id: string) => {
        setLoadingStates(prev => ({ ...prev, [id]: { ...prev[id], plan: true } }))
        try {
            const result = await plannerPlan(id, false)
            const { task } = result
            setTasks(t => t.map(x => x.id === id ? task as any : x))
            const wp = await plannerWeekly(false)
            setPlan(wp.plan)
            addNotification("success", "Task planned successfully")
        } catch (error) {
            console.error('Plan task error:', error)
            addNotification("error", "Failed to plan task: " + (error as any)?.message)
        } finally {
            setLoadingStates(prev => ({ ...prev, [id]: { ...prev[id], plan: false } }))
        }
    }

    const gen = async (id: string, kind: "summary" | "studyGuide" | "flashcards" | "quiz") => {
        setLoadingStates(prev => ({ ...prev, [id]: { ...prev[id], [kind]: true } }))
        // Initialize with empty string so the UI container shows up immediately for streaming
        setMaterials(m => ({ ...m, [id]: { ...(m[id] || {}), [kind]: "" } }))
        try {
            console.log(`[Planner] Requesting ${kind} for ${id} (sid: ${sid})`)
            const res = await plannerMaterials(id, kind, sid)
            console.log(`[Planner] Received response for ${kind}:`, res)
            const { data } = res
            setMaterials(m => ({ ...m, [id]: { ...(m[id] || {}), [kind]: data } }))
        } catch (error) {
            console.error(`[Planner] gen error (${kind}):`, error)
            addNotification("error", `AI failed: ${(error as any)?.message || 'Unknown error'}`)
        } finally {
            setLoadingStates(prev => ({ ...prev, [id]: { ...prev[id], [kind]: false } }))
        }
    }


    const onUpload = async (id: string, file: File) => {
        try {
            await plannerUploadFiles(id, [file])
        } catch (_e) {
            addNotification("error", "Failed to upload file")
        }
    }

    const deleteFile = async (taskId: string, fileId: string) => {
        try {
            await plannerDeleteFile(taskId, fileId)
        } catch (_e) {
            addNotification("error", "Failed to delete file")
        }
    }

    const del = async (id: string) => {
        await plannerDelete(id)
        setTasks(t => t.filter(x => x.id !== id))
    }

    const mark = async (id: string, status: PlannerTask["status"]) => {
        const { task } = await plannerUpdate(id, { status })
        setTasks(t => t.map(x => x.id === id ? task : x))
    }

    const startNow = async (id: string) => {
        await mark(id, "doing")
        if (!slotsByTask[id]?.length) await planTask(id)
    }

    const updateNotes = async (id: string, notes: string) => {
        const { task } = await plannerUpdate(id, { notes })
        setTasks(t => t.map(x => x.id === id ? task : x))
    }

    const NavTab = ({ id, label }: { id: typeof view, label: string }) => (
        <button
            onClick={() => setView(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${view === id
                ? 'border-emerald-500 text-stone-100'
                : 'border-transparent text-stone-500 hover:text-stone-300'
                }`}
        >
            {label}
        </button>
    )

    return (
        <div className="rounded-2xl border border-zinc-800 bg-black min-h-[85vh] flex flex-col">
            {/* Header & Navigation */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-stone-100 tracking-tight">{t.planner.title}</h2>
                    <p className="text-xs text-stone-500">{t.planner.subtitle}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={reload} className="p-2 text-stone-500 hover:text-stone-300 transition-colors" title={t.planner.refresh}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Sub-Navigation */}
            <div className="px-6 border-b border-zinc-800 flex gap-2">
                <NavTab id="overview" label={t.planner.tabs.overview} />
                <NavTab id="calendar" label={t.planner.tabs.calendar} />
                <NavTab id="mindmap" label={t.planner.tabs.mindmap} />
                <NavTab id="analytics" label={t.planner.tabs.analytics} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 relative">
                {/* Notifications Toast */}
                {notifications.length > 0 && (
                    <div className="absolute top-4 right-4 z-50 space-y-2 pointer-events-none">
                        {notifications.map(n => (
                            <div key={n.id} className={`px-4 py-3 rounded-lg text-sm shadow-xl border backdrop-blur-md animate-in slide-in-from-right-8 pointer-events-auto ${n.type === 'error' ? 'bg-red-950/80 border-red-900 text-red-200' :
                                n.type === 'success' ? 'bg-emerald-950/80 border-emerald-900 text-emerald-200' :
                                    n.type === 'reminder' ? 'bg-amber-950/80 border-amber-900 text-amber-200' :
                                        'bg-zinc-900/90 border-zinc-800 text-stone-300'
                                }`}>
                                {n.message}
                            </div>
                        ))}
                    </div>
                )}

                {/* View Switch */}
                {view === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                        {/* Main Dashboard Column */}
                        <div className="lg:col-span-3 space-y-6">
                            <FocusTimer />

                            <TodayFocus
                                tasks={tasks}
                                onStartSession={startNow}
                                onCompleteTask={(id) => mark(id, "done")}
                            />

                            {/* Detailed Task List */}
                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-violet-400 uppercase tracking-widest">
                                        DANH SÁCH NHIỆM VỤ (AI-POWERED) 🚀
                                    </h3>
                                    <span className="text-[10px] text-stone-600 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 font-mono">
                                        SID: {sid}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {tasks.length === 0 && (
                                        <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-900/10 text-center space-y-6">
                                            <h4 className="text-lg font-medium text-stone-200">{t.planner.onboarding.title}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <div className="text-2xl">⚡</div>
                                                    <div className="font-medium text-stone-300">{t.planner.onboarding.step1.title}</div>
                                                    <div className="text-xs text-stone-500">{t.planner.onboarding.step1.desc}</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-2xl">📅</div>
                                                    <div className="font-medium text-stone-300">{t.planner.onboarding.step2.title}</div>
                                                    <div className="text-xs text-stone-500">{t.planner.onboarding.step2.desc}</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-2xl">🎯</div>
                                                    <div className="font-medium text-stone-300">{t.planner.onboarding.step3.title}</div>
                                                    <div className="text-xs text-stone-500">{t.planner.onboarding.step3.desc}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {tasks.sort((a, b) => a.dueAt - b.dueAt).map(tsk => (
                                        <div key={tsk.id} className="group flex flex-col sm:flex-row items-start justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/80 transition-all gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${tsk.status === 'done' ? 'bg-emerald-500' :
                                                        tsk.status === 'blocked' ? 'bg-red-500' :
                                                            tsk.status === 'doing' ? 'bg-amber-500' : 'bg-stone-600'
                                                        }`} />
                                                    <span className={`font-medium truncate ${tsk.status === 'done' ? 'text-stone-500 line-through' : 'text-stone-200'}`}>{tsk.title}</span>
                                                </div>
                                                <div className="text-xs text-stone-500 mt-1 ml-4 flex flex-wrap gap-2">
                                                    <span>{tsk.dueAt ? fmtTime(tsk.dueAt) : t.planner.tasks.noDue}</span>
                                                    <span>·</span>
                                                    <span>{tsk.estMins}{t.planner.tasks.mins}</span>
                                                    {tsk.files && tsk.files.length > 0 && <span>· {t.planner.tasks.files}</span>}
                                                </div>

                                                {/* Files Display */}
                                                {tsk.files && tsk.files.length > 0 && (
                                                    <div className="ml-4 mt-2 flex flex-wrap gap-2">
                                                        {tsk.files.map(file => (
                                                            <div key={file.id} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-300">
                                                                <span className="truncate max-w-24">{file.originalName}</span>
                                                                <button onClick={() => deleteFile(tsk.id, file.id)} className="hover:text-red-400">×</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* AI Materials Display */}
                                                {(materials[tsk.id]?.summary !== undefined || loadingStates[tsk.id]?.summary) && (
                                                    <div className="mt-8 w-[calc(100%+6rem)] -ml-12 -mr-12 animate-in fade-in slide-in-from-top-4 duration-700">
                                                        <div className="relative group/ai">
                                                            {/* Rainbow Border Gradient */}
                                                            <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 rounded-3xl blur-[2px] opacity-20 group-hover/ai:opacity-40 transition duration-1000 animate-pulse"></div>

                                                            <div className="relative bg-zinc-950/90 backdrop-blur-3xl p-10 rounded-3xl border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden">
                                                                {/* Decorative logic lights */}
                                                                <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 blur-[120px] rounded-full -mr-32 -mt-32"></div>
                                                                <div className="absolute bottom-0 left-0 w-80 h-80 bg-fuchsia-600/10 blur-[120px] rounded-full -ml-32 -mb-32"></div>

                                                                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
                                                                            <span className="text-white text-sm">🧠</span>
                                                                        </div>
                                                                        <div className="space-y-0.5">
                                                                            <h4 className="text-base font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-violet-200 to-stone-400">
                                                                                {t.planner.aiSummary}
                                                                            </h4>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                                                                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">PolyPi AI Core v2.0</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3">
                                                                        {loadingStates[tsk.id]?.summary && (
                                                                            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                                                                                <div className="flex gap-1.5">
                                                                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.3s]"></div>
                                                                                    <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.15s]"></div>
                                                                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-duration:0.8s]"></div>
                                                                                </div>
                                                                                <span className="text-[10px] text-white/70 font-black uppercase tracking-widest">Thinking</span>
                                                                            </div>
                                                                        )}
                                                                        <button className="p-2 rounded-xl bg-white/5 text-stone-400 hover:text-white transition-colors border border-white/5">
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed text-sm">
                                                                    {materials[tsk.id]?.summary || loadingStates[tsk.id]?.summary ? (
                                                                        <MarkdownView md={(() => {
                                                                            const data = materials[tsk.id]?.summary;
                                                                            if (!data) return "";
                                                                            if (typeof data === 'string') {
                                                                                if (data.trim().startsWith('{')) {
                                                                                    try {
                                                                                        const p = JSON.parse(data);
                                                                                        return p.answer || p.content || data;
                                                                                    } catch { return data; }
                                                                                }
                                                                                return data;
                                                                            }
                                                                            return data.answer || data.content || "";
                                                                        })()} />
                                                                    ) : (
                                                                        <div className="flex flex-col items-center py-20 text-stone-700 gap-6">
                                                                            <div className="relative">
                                                                                <div className="w-16 h-16 rounded-full border-2 border-stone-900"></div>
                                                                                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin"></div>
                                                                                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-fuchsia-500 animate-spin [animation-duration:1.5s]"></div>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-600 mb-1">Architecting Knowledge</p>
                                                                                <p className="italic text-[10px] text-stone-800">Hang tight, we're building something great...</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>

                                            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-center">
                                                {/* State Select */}
                                                <select
                                                    value={tsk.status}
                                                    onChange={e => mark(tsk.id, e.target.value as any)}
                                                    className="bg-zinc-900 border border-zinc-800 text-stone-400 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                >
                                                    <option value="todo">{t.planner.tasks.status.todo}</option>
                                                    <option value="doing">{t.planner.tasks.status.doing}</option>
                                                    <option value="done">{t.planner.tasks.status.done}</option>
                                                    <option value="blocked">{t.planner.tasks.status.blocked}</option>
                                                </select>

                                                <div className="flex gap-1">
                                                    <button onClick={() => planTask(tsk.id)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-stone-300" title="Plan">
                                                        {loadingStates[tsk.id]?.plan ? <span className="animate-spin">⌛</span> : '📅'}
                                                    </button>
                                                    <button onClick={() => gen(tsk.id, "summary")} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-stone-300" title="AI Summary">
                                                        {loadingStates[tsk.id]?.summary ? <span className="animate-spin">...</span> : '🤖'}
                                                    </button>
                                                    <button onClick={() => del(tsk.id)} className="p-1.5 rounded bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 text-stone-300" title="Delete">
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Column */}
                        <div className="space-y-6">
                            <QuickAdd onAdd={add} loading={loading} />
                            <Suggestions onAdd={(text) => add({ text })} />

                            {/* Upcoming from Week Plan */}
                            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
                                <h3 className="text-xs font-semibold text-stone-500 mb-3 uppercase tracking-wider">{t.planner.upcoming}</h3>
                                {plan ? (
                                    <div className="space-y-4">
                                        {plan.days.slice(0, 3).map(d => (
                                            <div key={d.date}>
                                                <div className="text-xs text-stone-400 mb-2 font-medium bg-zinc-900/50 inline-block px-1.5 rounded">{d.date}</div>
                                                {d.slots.length ? (
                                                    <div className="space-y-1">
                                                        {d.slots.map(s => (
                                                            <div key={s.id} className="text-xs text-stone-300 pl-3 border-l-2 border-zinc-700 py-0.5 hover:border-emerald-500 transition-colors">
                                                                <span className="text-stone-500 mr-2">{new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                {tasks.find(t => t.id === s.taskId)?.title || 'Task'}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <div className="text-xs text-stone-600 italic pl-2">{t.planner.noActivePlans}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-sm text-stone-500">{t.planner.noPlanGen}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'calendar' && (
                    <CalendarView tasks={tasks} onPlan={planTask} />
                )}

                {view === 'mindmap' && (
                    <div className="h-full rounded-xl border border-zinc-800 overflow-hidden relative group">
                        <PlannerMindmap
                            tasks={tasks}
                            plan={plan}
                            onPlan={planTask}
                            onAssist={(id, kind) => gen(id, kind)}
                            onUpdateStatus={mark}
                            onUpload={onUpload}
                            onDelete={del}
                            onStartNow={startNow}
                            onUpdateNotes={updateNotes}
                        />
                    </div>
                )}

                {view === 'analytics' && (
                    <AnalyticsView />
                )}
            </div>
        </div>
    )
}
