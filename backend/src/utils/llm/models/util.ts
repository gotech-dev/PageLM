import type { Msg } from './types'

export const wrapChat = (m: any) => ({
  invoke: (ms: Msg[]) => m.invoke(ms),
  call: (ms: Msg[]) => m.invoke(ms),
  stream: async (ms: Msg[], onChunk: (c: string) => void) => {
    const s = await m.stream(ms)
    let full = ""
    for await (const chunk of s) {
      const txt = typeof chunk === 'string' ? chunk : (chunk?.content || "")
      full += txt
      if (txt) onChunk(txt)
    }
    return full
  }
})