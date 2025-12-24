
import { useState, useEffect } from "react"
import { plannerGetSuggestions, Suggestion } from "../../lib/api"
import { useLanguage } from "../../lib/LanguageContext"

export default function Suggestions({ onAdd }: { onAdd: (text: string) => void }) {
    const { t } = useLanguage()
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const res = await plannerGetSuggestions()
            if (res.ok) setSuggestions(res.suggestions)
        } finally {
            setLoading(false)
        }
    }

    // Load on mount
    useEffect(() => { load() }, [])

    if (!suggestions.length && !loading) return null

    return (
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                    ✨ {t.planner.suggestions.title}
                    {loading && <span className="animate-spin">⌛</span>}
                </h3>
                <span className="text-zinc-500 text-xs">{expanded ? '▼' : '▶'}</span>
            </div>

            {expanded && (
                <div className="space-y-3 animate-in slide-in-from-top-2">
                    {suggestions.map(s => (
                        <div key={s.id} className="group p-3 rounded bg-zinc-900/50 border border-zinc-800/50 hover:border-emerald-500/30 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <div className="text-sm text-stone-300 font-medium mb-1">{s.title}</div>
                                    <div className="text-xs text-stone-500 line-clamp-2">{s.description}</div>
                                </div>
                                <button
                                    onClick={() => onAdd(s.title)}
                                    className="p-1.5 rounded bg-zinc-800 hover:bg-emerald-600 text-stone-400 hover:text-white transition-colors"
                                    title={t.planner.suggestions.add}
                                >
                                    +
                                </button>
                            </div>
                            <div className="mt-2 flex gap-2">
                                {s.type === 'weakness' && <span className="text-[10px] uppercase font-bold text-amber-500/80 bg-amber-950/30 px-1.5 py-0.5 rounded">{t.planner.suggestions.weakness}</span>}
                                {s.type === 'recommendation' && <span className="text-[10px] uppercase font-bold text-blue-500/80 bg-blue-950/30 px-1.5 py-0.5 rounded">{t.planner.suggestions.recommendation}</span>}
                                {s.priority === 'high' && <span className="text-[10px] uppercase font-bold text-red-500/80 bg-red-950/30 px-1.5 py-0.5 rounded">High Prio</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
