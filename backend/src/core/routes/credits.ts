import { authMiddleware, AuthRequest } from "../../middleware/auth"
import { query } from "../../utils/database/mysql"

type RawUsageRow = {
  id: string | number
  task_type?: string | null
  credits_used?: number | string | null
  input_tokens?: number | string | null
  output_tokens?: number | string | null
  meta?: any
  created_at?: any
  model?: string | null
}

type CreditHistoryEntry = {
  id: string
  taskType: string
  creditsUsed: number
  inputTokens: number
  outputTokens: number
  model: string | null
  createdAt: number
  meta: any | null
}

function parseMeta(raw: any): any | null {
  if (!raw) return null
  if (typeof raw === "object") return raw
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export function creditRoutes(app: any) {
  // Return recent credit usage history for the authenticated user
  app.get("/credits/history", authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      if (!req.userId) {
        return res.status(401).send({ ok: false, error: "UNAUTHORIZED" })
      }

      const limit = Math.max(1, Math.min(200, Number(req.query?.limit) || 50))
      const limitClause = `LIMIT ${limit}`

      const rows = await query<RawUsageRow>(
        `SELECT au.id,
                au.task_type,
                au.credits_used,
                au.input_tokens,
                au.output_tokens,
                au.meta,
                au.created_at,
                m.name AS model
         FROM ai_usages au
         LEFT JOIN ai_models m ON m.id = au.ai_model_id
         WHERE au.user_id = ?
         ORDER BY au.created_at DESC
         ${limitClause}`,
        [req.userId]
      )

      const entries: CreditHistoryEntry[] = rows.map((r) => ({
        id: String(r.id),
        taskType: (r.task_type || "other").toString(),
        creditsUsed: Number(r.credits_used ?? 0),
        inputTokens: Number(r.input_tokens ?? 0),
        outputTokens: Number(r.output_tokens ?? 0),
        model: r.model || null,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        meta: parseMeta(r.meta),
      }))

      res.send({ ok: true, entries })
    } catch (e: unknown) {
      const error = e as Error
      console.error("[credits] failed to load history:", error)
      res.status(500).send({ ok: false, error: error?.message || "failed" })
    }
  })
}
