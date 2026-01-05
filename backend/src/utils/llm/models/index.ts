import * as ollama from './ollama'
import * as gemini from './gemini'
import * as openai from './openai'
import * as grok from './grok'
import * as claude from './claude'
import * as openrouter from './openrouter'
import { config } from '../../../config/env'
import type { EmbeddingsLike, LLM } from './types'

type Pair = { llm: LLM; embeddings: EmbeddingsLike }

function pick(p: string) {
  switch (p) {
    case 'ollama': return ollama
    case 'gemini': return gemini
    case 'openai': return openai
    case 'grok': return grok
    case 'claude': return claude
    case 'openrouter': return openrouter
    default: return gemini
  }
}

export function makeModels(): Pair {
  const mod = pick(config.provider)
  const llm = mod.makeLLM(config)

  // Choose embeddings provider independently (fall back to LLM provider, then openai)
  const embProvider = config.embeddings_provider || config.provider
  const embMod = pick(embProvider)

  let embeddings: EmbeddingsLike
  try {
    embeddings = embMod.makeEmbeddings(config)
  } catch (err) {
    console.warn('[llm] embeddings init failed, falling back to openai:', err?.message || err)
    const d = pick('openai')
    embeddings = d.makeEmbeddings(config)
  }

  return { llm, embeddings }
}
