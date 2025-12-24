import { useLanguage } from "../../lib/LanguageContext"
import { type PlannerTask } from "../../lib/api"

function fmtTime(ts: number) {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" })
}

interface TodayFocusProps {
    tasks: PlannerTask[]
    onStartSession: (taskId: string) => void
    onCompleteTask: (taskId: string) => void
}

export default function TodayFocus({ tasks, onStartSession, onCompleteTask }: TodayFocusProps) {
    const { t } = useLanguage()
    const today = new Date().toISOString().slice(0, 10)

    // Get today's tasks and upcoming urgent tasks
    const todayTasks = tasks.filter(task => {
        const taskDate = new Date(task.dueAt).toISOString().slice(0, 10)
        return taskDate === today && task.status !== 'done'
    })

    const urgentTasks = tasks.filter(task => {
        const hoursUntilDue = (task.dueAt - Date.now()) / (1000 * 60 * 60)
        return hoursUntilDue < 24 && hoursUntilDue > 0 && task.status !== 'done'
    }).slice(0, 3)

    const activeTasks = tasks.filter(task => task.status === 'doing')

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-zinc-200 font-medium mb-4 flex items-center gap-2">
                <span>🎯</span>
                {t.planner.todayFocus.title}
            </div>

            <div className="space-y-4">
                {/* Active Sessions */}
                {activeTasks.length > 0 && (
                    <div>
                        <div className="text-zinc-300 text-sm mb-2">{t.planner.todayFocus.workingOn}</div>
                        <div className="space-y-2">
                            {activeTasks.map(task => (
                                <div key={task.id} className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-blue-200 font-medium">{task.title}</div>
                                            <div className="text-blue-300 text-xs">
                                                {task.course} • {task.estMins} {t.planner.tasks.mins} • Due {fmtTime(task.dueAt)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onCompleteTask(task.id)}
                                            className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                                        >
                                            {t.planner.todayFocus.complete}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Due Today */}
                {todayTasks.length > 0 && (
                    <div>
                        <div className="text-zinc-300 text-sm mb-2">{t.planner.todayFocus.dueToday} ({todayTasks.length}):</div>
                        <div className="space-y-2">
                            {todayTasks.slice(0, 3).map(task => (
                                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-zinc-200 font-medium">{task.title}</div>
                                            <div className="text-zinc-400 text-xs">
                                                {task.course} • {task.estMins} {t.planner.tasks.mins} • P{task.priority}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onStartSession(task.id)}
                                            className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                                        >
                                            {t.planner.todayFocus.start}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {todayTasks.length > 3 && (
                                <div className="text-zinc-400 text-xs text-center">
                                    {t.planner.todayFocus.moreTasks.replace("{count}", (todayTasks.length - 3).toString())}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Urgent (Next 24h) */}
                {urgentTasks.length > 0 && (
                    <div>
                        <div className="text-zinc-300 text-sm mb-2">{t.planner.todayFocus.urgent}:</div>
                        <div className="space-y-2">
                            {urgentTasks.map(task => {
                                const hoursLeft = Math.max(0, (task.dueAt - Date.now()) / (1000 * 60 * 60))
                                return (
                                    <div key={task.id} className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-yellow-200 font-medium">{task.title}</div>
                                                <div className="text-yellow-300 text-xs">
                                                    {task.course} • Due in {Math.round(hoursLeft)}h • {task.estMins} {t.planner.tasks.mins}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onStartSession(task.id)}
                                                className="px-3 py-1 rounded bg-yellow-600 text-white text-xs hover:bg-yellow-700"
                                            >
                                                {t.planner.todayFocus.start}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {todayTasks.length === 0 && urgentTasks.length === 0 && activeTasks.length === 0 && (
                    <div className="text-center py-8 text-zinc-400">
                        <div className="text-2xl mb-2">🎉</div>
                        <div className="text-sm">{t.planner.todayFocus.empty}</div>
                        <div className="text-xs text-zinc-500">{t.planner.todayFocus.emptyDesc}</div>
                    </div>
                )}
            </div>
        </div>
    )
}