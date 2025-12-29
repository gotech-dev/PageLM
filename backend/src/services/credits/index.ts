import { queryOne } from "../../utils/database/mysql"
import pool from "../../utils/database/mysql"
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
const CREDITS_PER_USD = Number(process.env.CREDITS_PER_USD || 100)
const DEFAULT_BUFFER = { input: 1.05, output: 1.1 }
const DEFAULT_MULTIPLIER = 1.2
const DEFAULT_COST_INPUT = 1
const DEFAULT_COST_OUTPUT = 2

const modelCache = new Map<string, ModelRow>()

export type EstimateOptions = {
  inputText?: string
  outputRatio?: number
  inputTokens?: number
  outputTokens?: number
  model?: string
  minOutputTokens?: number
}

export type CreditEstimate = {
  inputTokens: number
  outputTokens: number
  credits: number
  usd: number
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

export async function calculateCredits(inputTokens: number, outputTokens: number, model = DEFAULT_MODEL): Promise<CreditEstimate> {
  const pricing = await getModelPricing(model)

  const bufferedInput = applyBuffer(Math.max(0, inputTokens), "input", pricing)
  const bufferedOutput = applyBuffer(Math.max(0, outputTokens), "output", pricing)

  const inputUsd = (bufferedInput / 1_000_000) * pricing.costInputPerMTok
  const outputUsd = (bufferedOutput / 1_000_000) * pricing.costOutputPerMTok
  const usd = (inputUsd + outputUsd) * pricing.multiplier
  const credits = Math.ceil(usd * CREDITS_PER_USD)

  return {
    inputTokens: bufferedInput,
    outputTokens: bufferedOutput,
    credits,
    usd,
    model,
  }
}

export async function estimateCost(opts: EstimateOptions): Promise<CreditEstimate> {
  const model = opts.model || DEFAULT_MODEL
  const inputTokens = opts.inputTokens ?? estimateTokens(opts.inputText || "", model)
  const ratio = opts.outputRatio ?? 1
  const minOut = opts.minOutputTokens ?? 0
  const outputTokens = opts.outputTokens ?? Math.max(Math.ceil(inputTokens * ratio), minOut)

  return calculateCredits(inputTokens, outputTokens, model)
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

export async function consumeCredits(userId: string, credits: number): Promise<number> {
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
  const remaining = await consumeCredits(userId, estimate.credits)
  return { remaining, spent: estimate.credits, estimate }
}

// Convenience: charge credits based on input text and an expected output ratio
export async function chargeCreditsByText(userId: string, inputText: string, outputRatio = 1.5, model?: string) {
  const estimate = await estimateCost({ inputText, outputRatio, model: model || DEFAULT_MODEL })
  const remaining = await consumeCredits(userId, estimate.credits)
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
