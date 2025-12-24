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
        wsRef.current = connectPlannerStream(sid, (ev: PlannerEvent) => {
            if (ev.type === "plan.update") {
                setTasks(t => t.map(x => x.id === ev.taskId ? { ...x, plan: { ...(x as any).plan, slots: ev.slots } } as any : x))
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
            if (ev.type === "materials.chunk") {
                setMaterials(m => ({ ...m, _chunks: [...(m._chunks || []), ev] }))
            }
        })
        return () => { try { wsRef.current?.close() } catch { } }
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
        const res = await plannerList()
        setTasks(res.tasks)
        const wp = await plannerWeekly(false)
        setPlan(wp.plan)
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
        try {
            const { data } = await plannerMaterials(id, kind)
            setMaterials(m => ({ ...m, [id]: { ...(m[id] || {}), [kind]: data } }))
        } finally {
            setLoadingStates(prev => ({ ...prev, [id]: { ...prev[id], [kind]: false } }))
        }
    }

    const onUpload = async (id: string, file: File) => {
        try {
            await plannerUploadFiles(id, [file])
        } catch (e) {
            addNotification("error", "Failed to upload file")
        }
    }

    const deleteFile = async (taskId: string, fileId: string) => {
        try {
            await plannerDeleteFile(taskId, fileId)
        } catch (e) {
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        {/* Main Dashboard Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <FocusTimer />

                            <TodayFocus
                                tasks={tasks}
                                onStartSession={startNow}
                                onCompleteTask={(id) => mark(id, "done")}
                            />

                            {/* Detailed Task List */}
                            <div className="mt-8">
                                <h3 className="text-sm font-medium text-stone-400 mb-4">{t.planner.tasks.all}</h3>
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
                                                    {tsk.files && tsk.files.length > 0 && <span>· {tsk.files.length} {t.planner.tasks.files}</span>}
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
                                                {materials[tsk.id]?.summary && (
                                                    <div className="ml-4 mt-2 text-xs text-zinc-400 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                                        <div className="font-semibold text-violet-400 mb-1">{t.planner.aiSummary}:</div>
                                                        {materials[tsk.id].summary.answer || materials[tsk.id].summary}
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
