import { queryOne } from "../../utils/database/mysql"
import pool from "../../utils/database/mysql"
import type { PoolConnection } from "mysql2/promise"
import crypto from "crypto"
import { config } from "../../config/env"

type ModelRow = {
  name: string
  pricing_type: string | null
  cost_input: number | null
  cost_cached_input: number | null
  cost_output: number | null
  cost_per_unit: number | null
  unit: string | null
}

type ModelPricing = {
  buffer: { input: number; output: number }
  multiplier: number
  costInputPerMTok: number
  costOutputPerMTok: number
}

function resolveDefaultModel(): string {
  switch ((config.provider || "").toLowerCase()) {
    case "openai":
      return process.env.OPENAI_MODEL || config.openai_model || "gpt-4o-mini"
    case "claude":
      return config.claude_model || "claude-3-5-sonnet-latest"
    case "grok":
      return config.grok_model || "grok-2-latest"
    case "gemini":
      return config.gemini_model || "gemini-1.5-flash"
    case "ollama":
      return config.ollama?.model || "llama3"
    case "openrouter":
      return config.openrouter_model || config.openai_model || "gpt-4o-mini"
    default:
      return process.env.OPENAI_MODEL || config.openai_model || "gpt-4o-mini"
  }
}

const DEFAULT_MODEL = resolveDefaultModel()
// Currency: default 1 credit = 1 VND; usd->vnd rate from env (AI_CURRENCY_RATE)
const USD_TO_VND = Number(process.env.AI_CURRENCY_RATE || 27000)
const VND_PER_CREDIT = Number(process.env.CREDIT_VND_VALUE || 1)
const DEFAULT_BUFFER = { input: 1.05, output: 1.1 }
const DEFAULT_MULTIPLIER = 1.2
const DEFAULT_COST_INPUT = 1
const DEFAULT_COST_OUTPUT = 2
const SURCHARGE_RATE = Number(process.env.SURCHARGE_RATE || 0.3)

const modelCache = new Map<string, ModelRow>()
const modelIdCache = new Map<string, number>()

type AiUsageLog = {
  adminId?: string | null
  aiModelId?: number
  aiModel?: string
  taskType?: string
  inputTokens?: number
  outputTokens?: number
  inputHash?: string | null
  meta?: Record<string, unknown> | null
}

export type EstimateOptions = {
  inputText?: string
  outputRatio?: number
  inputTokens?: number
  outputTokens?: number
  model?: string
  minOutputTokens?: number
  contextText?: string
  systemPrompt?: string
  historyMessages?: Array<{ role?: string; content?: any }>
  extraPromptTexts?: string[]
  additionalPromptTokens?: number
}

export type CreditEstimate = {
  inputTokens: number
  outputTokens: number
  credits: number
  usd: number
  vnd: number
  model: string
}

function isVietnamese(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(text)
}

export function estimateTokens(text: string, model = DEFAULT_MODEL): number {
  const normalized = (text || "").trim()
  if (!normalized) return 0

  if (model.toLowerCase().includes("claude") || model.toLowerCase().includes("sonnet")) {
    const wordCount = normalized.split(/\s+/).length
    return isVietnamese(normalized)
      ? Math.ceil(wordCount * 1.2)
      : Math.ceil(normalized.length / 4)
  }

  if (isVietnamese(normalized)) {
    const wordCount = normalized.split(/\s+/).length
    return Math.ceil(wordCount * 1.2)
  }

  return Math.ceil(normalized.length / 4)
}

function toPlainText(content: any): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (typeof content === "object") {
    const candidate = (content as any).answer ?? (content as any).content
    if (typeof candidate === "string" && candidate.trim()) return candidate
    try {
      return JSON.stringify(content)
    } catch {
      return String(content)
    }
  }
  return String(content)
}

function estimatePromptTokens(opts: EstimateOptions, model: string): number {
  const texts: string[] = []

  if (opts.systemPrompt) texts.push(opts.systemPrompt)
  if (opts.contextText && opts.contextText.trim().toUpperCase() !== "NO_CONTEXT") texts.push(opts.contextText)
  if (Array.isArray(opts.extraPromptTexts)) {
    for (const t of opts.extraPromptTexts) {
      if (typeof t === "string" && t.trim()) texts.push(t)
    }
  }
  if (Array.isArray(opts.historyMessages)) {
    for (const msg of opts.historyMessages) {
      const txt = toPlainText(msg?.content)
      if (txt.trim()) texts.push(txt)
    }
  }

  const promptTokens = texts.reduce((sum, t) => sum + estimateTokens(t, model), 0)
  const extra = Math.max(0, opts.additionalPromptTokens || 0)
  return promptTokens + extra
}

async function getModelPricing(model: string): Promise<ModelPricing> {
  const cached = modelCache.get(model)
  let row: ModelRow | null = cached || null

  if (!row) {
    row = await queryOne<ModelRow>(
      "SELECT name, pricing_type, cost_input, cost_cached_input, cost_output, cost_per_unit, unit FROM ai_models WHERE name = ? LIMIT 1",
      [model]
    )
    if (row) modelCache.set(model, row)
  }

  if (!row) {
    return {
      buffer: DEFAULT_BUFFER,
      multiplier: DEFAULT_MULTIPLIER,
      costInputPerMTok: DEFAULT_COST_INPUT,
      costOutputPerMTok: DEFAULT_COST_OUTPUT,
    }
  }

  const isTokenBased = (row.pricing_type || "token_based") === "token_based"
  const costInputPerMTok = isTokenBased
    ? Number(row.cost_input ?? row.cost_per_unit ?? DEFAULT_COST_INPUT)
    : Number(row.cost_per_unit ?? DEFAULT_COST_INPUT)
  const costOutputPerMTok = isTokenBased
    ? Number(row.cost_output ?? row.cost_per_unit ?? DEFAULT_COST_OUTPUT)
    : Number(row.cost_per_unit ?? DEFAULT_COST_OUTPUT)

  return {
    buffer: DEFAULT_BUFFER,
    multiplier: DEFAULT_MULTIPLIER,
    costInputPerMTok,
    costOutputPerMTok,
  }
}

function applyBuffer(tokens: number, type: "input" | "output", pricing: ModelPricing): number {
  const rate = pricing.buffer[type] ?? 1.1
  return Math.ceil(tokens * rate)
}

async function ensureAiModelId(modelName: string, conn?: PoolConnection): Promise<number> {
  const name = modelName || DEFAULT_MODEL
  const cached = modelIdCache.get(name)
  if (cached) return cached

  const executor = conn ?? pool
  const [existing] = await executor.execute("SELECT id FROM ai_models WHERE name = ? LIMIT 1", [name])
  const found = (existing as any[])[0]?.id
  if (found) {
    modelIdCache.set(name, found)
    return found
  }

  const [inserted] = await executor.execute(
    "INSERT INTO ai_models (name, type, pricing_type, created_at, updated_at) VALUES (?, 'text', 'token_based', NOW(), NOW())",
    [name]
  )
  const newId = Number((inserted as any).insertId)
  modelIdCache.set(name, newId)
  return newId
}

function hashInput(input?: string | null): string | null {
  const text = (input || "").trim()
  if (!text) return null
  return crypto.createHash("sha256").update(text).digest("hex")
}

export async function calculateCredits(inputTokens: number, outputTokens: number, model = DEFAULT_MODEL): Promise<CreditEstimate> {
  const pricing = await getModelPricing(model)

  const bufferedInput = applyBuffer(Math.max(0, inputTokens), "input", pricing)
  const bufferedOutput = applyBuffer(Math.max(0, outputTokens), "output", pricing)

  const inputUsd = (bufferedInput / 1_000_000) * pricing.costInputPerMTok
  const outputUsd = (bufferedOutput / 1_000_000) * pricing.costOutputPerMTok
  const baseUsd = (inputUsd + outputUsd) * pricing.multiplier
  const usd = baseUsd * (1 + SURCHARGE_RATE)
  const vnd = usd * USD_TO_VND
  const credits = Math.ceil(vnd / VND_PER_CREDIT)

  return {
    inputTokens: bufferedInput,
    outputTokens: bufferedOutput,
    credits,
    usd,
    vnd,
    model,
  }
}

export async function estimateCost(opts: EstimateOptions): Promise<CreditEstimate> {
  const model = opts.model || DEFAULT_MODEL
  const baseInputTokens = Math.max(0, opts.inputTokens ?? estimateTokens(opts.inputText || "", model))
  const promptTokens = estimatePromptTokens(opts, model)
  const totalInputTokens = baseInputTokens + promptTokens
  const ratio = opts.outputRatio ?? 1
  const minOut = opts.minOutputTokens ?? 0
  const outputTokens = opts.outputTokens ?? Math.max(Math.ceil(baseInputTokens * ratio), minOut)

  return calculateCredits(totalInputTokens, outputTokens, model)
}

export type CreditCheck = CreditEstimate & {
  sufficient: boolean
  currentCredits: number
  neededCredits: number
  message: string
}

export async function checkCredits(userId: string, opts: EstimateOptions): Promise<CreditCheck> {
  const estimate = await estimateCost(opts)
  const user = await queryOne<{ credits: number }>(
    "SELECT credits FROM users WHERE id = ?",
    [userId]
  )

  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  const current = Math.max(0, Number(user.credits || 0))
  const needed = Math.max(0, estimate.credits)
  const sufficient = current >= needed

  return {
    ...estimate,
    sufficient,
    currentCredits: current,
    neededCredits: needed,
    message: sufficient
      ? "Bạn đủ credits để thực hiện tác vụ này."
      : "Bạn không đủ credit để thực hiện tác vụ này.",
  }
}

export async function consumeCredits(userId: string, credits: number, usage?: AiUsageLog): Promise<number> {
  if (credits <= 0) return await getBalance(userId)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.execute("SELECT credits FROM users WHERE id = ? FOR UPDATE", [userId])
    const current = Number((rows as any[])[0]?.credits ?? 0)

    if (!rows || (rows as any[]).length === 0) {
      throw new Error("USER_NOT_FOUND")
    }

    if (current < credits) {
      throw new Error("INSUFFICIENT_CREDITS")
    }

    const remaining = current - credits
    await conn.execute("UPDATE users SET credits = ? WHERE id = ?", [remaining, userId])
    if (usage) {
      const aiModelId = usage.aiModelId ?? (await ensureAiModelId(usage.aiModel || DEFAULT_MODEL, conn))
      // Avoid duplicate log rows for same user/task/input hash/model (e.g., front-end retry)
      if (usage.taskType && usage.inputHash) {
        const [existing] = await conn.execute(
          "SELECT id FROM ai_usages WHERE user_id = ? AND task_type = ? AND input_hash = ? AND ai_model_id = ? LIMIT 1",
          [userId, usage.taskType, usage.inputHash, aiModelId]
        )
        if ((existing as any[]).length > 0) {
          await conn.commit()
          return remaining
        }
      }
      const metaJson = usage.meta ? JSON.stringify(usage.meta) : null
      await conn.execute(
        `INSERT INTO ai_usages
         (admin_id, user_id, ai_model_id, input_tokens, output_tokens, credits_used, task_type, input_hash, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usage.adminId || null,
          userId,
          aiModelId,
          Math.max(0, usage.inputTokens ?? 0),
          Math.max(0, usage.outputTokens ?? 0),
          credits,
          usage.taskType || null,
          usage.inputHash || null,
          metaJson,
        ]
      )
    }
    await conn.commit()
    return remaining
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export async function checkAndConsumeCredits(userId: string, opts: EstimateOptions): Promise<{ remaining: number; spent: number; estimate: CreditEstimate }> {
  const estimate = await estimateCost(opts)
  const remaining = await consumeCredits(userId, estimate.credits, {
    aiModel: opts.model || DEFAULT_MODEL,
    taskType: "generic_charge",
    inputTokens: estimate.inputTokens,
    outputTokens: estimate.outputTokens,
    inputHash: hashInput(opts.inputText),
    meta: { source: "checkAndConsumeCredits" },
  })
  return { remaining, spent: estimate.credits, estimate }
}

// Convenience: charge credits based on input text and an expected output ratio
type ChargeOptions = {
  taskType?: string
  meta?: Record<string, unknown>
  inputTokens?: number
  outputTokens?: number
  inputHash?: string | null
}

export async function chargeCreditsByText(userId: string, inputText: string, outputRatio = 1.5, model?: string, opts?: ChargeOptions) {
  const estimate = await estimateCost({
    inputText,
    outputRatio,
    model: model || DEFAULT_MODEL,
    inputTokens: opts?.inputTokens,
    outputTokens: opts?.outputTokens,
  })
  const remaining = await consumeCredits(userId, estimate.credits, {
    aiModel: model || DEFAULT_MODEL,
    taskType: opts?.taskType || "text_charge",
    inputTokens: opts?.inputTokens ?? estimate.inputTokens,
    outputTokens: opts?.outputTokens ?? estimate.outputTokens,
    inputHash: opts?.inputHash ?? hashInput(inputText),
    meta: { outputRatio, ...(opts?.meta || {}) },
  })
  return { remaining, spent: estimate.credits, estimate }
}

export function getDefaultModelName() {
  return DEFAULT_MODEL
}

export async function getBalance(userId: string): Promise<number> {
  const user = await queryOne<{ credits: number }>(
    "SELECT credits FROM users WHERE id = ?",
    [userId]
  )
  if (!user) throw new Error("USER_NOT_FOUND")
  return Number(user.credits || 0)
}
