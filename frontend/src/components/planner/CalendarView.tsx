import { useState, useMemo } from "react";
import type { PlannerTask } from "../../lib/api";

type Props = {
    tasks: PlannerTask[];
    onPlan: (id: string) => void;
};

export default function CalendarView({ tasks, onPlan }: Props) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const firstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const calendarGrid = useMemo(() => {
        const days = [];
        const totalDays = daysInMonth(currentDate);
        const startDay = firstDayOfMonth(currentDate);

        // Padding for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        // Days of current month
        for (let i = 1; i <= totalDays; i++) {
            days.push(i);
        }

        return days;
    }, [currentDate]);

    const tasksByDate = useMemo(() => {
        const map: Record<number, PlannerTask[]> = {};
        tasks.forEach(task => {
            if (task.dueAt) {
                const due = new Date(task.dueAt);
                if (due.getMonth() === currentDate.getMonth() && due.getFullYear() === currentDate.getFullYear()) {
                    const day = due.getDate();
                    if (!map[day]) map[day] = [];
                    map[day].push(task);
                }
            }
        });
        return map;
    }, [tasks, currentDate]);

    return (
        <div className="h-full flex flex-col bg-stone-950 rounded-xl border border-zinc-800">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-stone-200">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <div className="flex gap-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-zinc-800 rounded text-stone-400 hover:text-stone-200">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={nextMonth} className="p-1 hover:bg-zinc-800 rounded text-stone-400 hover:text-stone-200">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Done</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Doing</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-stone-600"></div> Todo</div>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/30">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-medium text-stone-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                {calendarGrid.map((day, index) => (
                    <div key={index} className={`min-h-[100px] border-b border-r border-zinc-800/50 p-2 relative group ${!day ? 'bg-zinc-900/20' : 'hover:bg-zinc-900/30 transition-colors'}`}>
                        {day && (
                            <>
                                <span className={`text-sm font-medium ${day === new Date().getDate() &&
                                        currentDate.getMonth() === new Date().getMonth() &&
                                        currentDate.getFullYear() === new Date().getFullYear()
                                        ? 'text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full'
                                        : 'text-stone-400'
                                    }`}>
                                    {day}
                                </span>

                                <div className="mt-2 space-y-1">
                                    {tasksByDate[day]?.map(task => (
                                        <div
                                            key={task.id}
                                            className={`text-[10px] truncate px-1.5 py-0.5 rounded border border-transparent hover:border-zinc-700 cursor-pointer ${task.status === 'done' ? 'text-stone-500 bg-zinc-900 line-through' :
                                                    task.status === 'doing' ? 'text-amber-200 bg-amber-900/30' :
                                                        'text-stone-300 bg-zinc-800'
                                                }`}
                                            title={`${task.title} (${task.estMins}m)`}
                                            onClick={() => onPlan(task.id)}
                                        >
                                            {task.title}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
