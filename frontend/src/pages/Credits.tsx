import { useEffect, useMemo, useState } from "react"
import { CreditHistoryEntry, getCreditHistory } from "../lib/api"
import { useLanguage } from "../lib/LanguageContext"

export default function Credits() {
  const { t, language } = useLanguage()
  const [entries, setEntries] = useState<CreditHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getCreditHistory(50)
      .then((res) => {
        if (!alive) return
        setEntries(res?.entries || [])
      })
      .catch((err) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const totalSpent = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.creditsUsed || 0), 0),
    [entries]
  )

  const mostRecent = entries[0]
  const locale = language === "vi" ? "vi-VN" : "en-US"

  const renderRow = (entry: CreditHistoryEntry) => (
    <div key={entry.id} className="px-4">
      <div className="hidden md:grid grid-cols-5 gap-4 items-start px-2 py-4 rounded-xl hover:bg-white/5 transition-colors duration-200">
        <div className="flex flex-col">
          <span className="text-white font-medium">{new Date(entry.createdAt).toLocaleString(locale)}</span>
          <span className="text-xs text-stone-500">{entry.taskType || t.credits.unknownTask}</span>
        </div>
        <div className="text-sm text-stone-200">{entry.model || t.credits.unknownModel}</div>
        <div className="text-sm text-stone-200 tabular-nums">{entry.inputTokens.toLocaleString(locale)} / {entry.outputTokens.toLocaleString(locale)}</div>
        <div className="text-sm text-white font-semibold tabular-nums">{entry.creditsUsed.toLocaleString(locale)}</div>
        <div className="text-xs text-stone-500 break-words max-w-[16rem]">
          {entry.meta ? JSON.stringify(entry.meta) : "—"}
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-2 bg-stone-900/70 rounded-2xl px-3 py-3 border border-stone-800">
        <div className="flex items-center justify-between">
          <div className="text-xs text-stone-500">{new Date(entry.createdAt).toLocaleString(locale)}</div>
          <div className="text-white font-semibold">{entry.creditsUsed.toLocaleString(locale)} {t.credits.creditUnit}</div>
        </div>
        <div className="text-sm text-white">{entry.taskType || t.credits.unknownTask}</div>
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>{entry.model || t.credits.unknownModel}</span>
          <span className="tabular-nums">{entry.inputTokens.toLocaleString(locale)} / {entry.outputTokens.toLocaleString(locale)}</span>
        </div>
        {entry.meta && (
          <div className="text-xs text-stone-500 break-words">
            {JSON.stringify(entry.meta)}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen w-full px-4 lg:pl-28 lg:pr-4 py-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-stone-500 uppercase tracking-[0.25em]">{t.credits.quickGlance}</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">{t.credits.title}</h1>
            <p className="text-stone-400 mt-1">{t.credits.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-xs uppercase tracking-widest text-stone-500">{t.credits.totalSpent}</p>
              <p className="text-2xl font-semibold text-white">{totalSpent.toLocaleString(locale)}</p>
            </div>
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl px-4 py-3 shadow-lg shadow-black/40">
              <p className="text-xs uppercase tracking-widest text-stone-500">{t.credits.lastUsage}</p>
              <p className="text-sm font-semibold text-white">
                {mostRecent ? new Date(mostRecent.createdAt).toLocaleString(locale) : t.credits.noData}
              </p>
              {mostRecent && (
                <p className="text-xs text-stone-500 mt-0.5">{mostRecent.taskType || t.credits.unknownTask}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-stone-950 border border-stone-900 rounded-3xl shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-stone-900">
            <div>
              <h2 className="text-xl font-semibold text-white">{t.credits.recentActivity}</h2>
              <p className="text-sm text-stone-500">{t.credits.limitNote}</p>
            </div>
            <div className="text-xs text-stone-400 bg-stone-900/60 px-3 py-1 rounded-full border border-stone-800">
              {entries.length} {t.credits.entriesLabel}
            </div>
          </div>

          {loading && (
            <div className="px-4 sm:px-6 py-6 text-sm text-stone-400">
              {t.common.loading}
            </div>
          )}

          {error && !loading && (
            <div className="px-4 sm:px-6 py-6 text-sm text-red-400">
              {t.credits.failed} {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="px-4 sm:px-6 py-10 text-center text-stone-400">
              {t.credits.empty}
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="divide-y divide-stone-900">
              <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-3 text-xs uppercase tracking-wide text-stone-500">
                <span>{t.credits.columns.time}</span>
                <span>{t.credits.columns.model}</span>
                <span>{t.credits.columns.tokens}</span>
                <span>{t.credits.columns.credits}</span>
                <span>{t.credits.columns.meta}</span>
              </div>
              {entries.map(renderRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
