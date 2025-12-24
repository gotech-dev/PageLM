export default function AnalyticsView() {
    // Mock data for visualization
    const hours = [3, 4.5, 2, 6, 4, 5, 2];
    const maxHour = Math.max(...hours);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
            {/* Study Hours Chart */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-stone-950">
                <h3 className="text-stone-200 font-medium mb-6">Study Hours (This Week)</h3>
                <div className="flex items-end justify-between h-64 gap-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                            <div
                                className="w-full bg-zinc-800 rounded-t-sm hover:bg-emerald-500/80 transition-colors relative"
                                style={{ height: `${(hours[i] / maxHour) * 100}%` }}
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-stone-200 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {hours[i]} hrs
                                </div>
                            </div>
                            <span className="text-xs text-stone-500">{d}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Task Completion Status */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-stone-950 flex flex-col justify-center">
                <h3 className="text-stone-200 font-medium mb-6">Task Status Distribution</h3>
                <div className="flex items-center justify-center gap-8">
                    <div className="relative w-48 h-48 rounded-full border-8 border-zinc-800 flex items-center justify-center">
                        {/* Simple pie chart representation via conic-gradient */}
                        <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(#10b981 0% 60%, #f59e0b 60% 80%, #3f3f46 80% 100%)', opacity: 0.8 }}></div>
                        <div className="absolute inset-2 bg-stone-950 rounded-full flex flex-col items-center justify-center z-10">
                            <div className="text-3xl font-bold text-stone-200">24</div>
                            <div className="text-xs text-stone-500">Total Tasks</div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-stone-300">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span>Done (60%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-stone-300">
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <span>In Progress (20%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-stone-300">
                            <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
                            <span>Todo (20%)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Heatmap Mockup */}
            <div className="col-span-1 lg:col-span-2 p-6 rounded-xl border border-zinc-800 bg-stone-950">
                <h3 className="text-stone-200 font-medium mb-4">Activity Heatmap</h3>
                <div className="flex gap-1 overflow-x-auto pb-2">
                    {Array.from({ length: 12 }).map((_, w) => (
                        <div key={w} className="grid grid-rows-7 gap-1">
                            {Array.from({ length: 7 }).map((_, d) => {
                                const intensity = Math.random();
                                return (
                                    <div
                                        key={d}
                                        className={`w-3 h-3 rounded-sm ${intensity > 0.8 ? 'bg-emerald-500' :
                                                intensity > 0.5 ? 'bg-emerald-700' :
                                                    intensity > 0.2 ? 'bg-emerald-900/40' : 'bg-zinc-900'
                                            }`}
                                    />
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
