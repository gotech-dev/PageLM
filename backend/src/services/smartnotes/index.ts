import fs from "fs"
import path from "path"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import llm from "../../utils/llm/llm"
import { normalizeTopic } from "../../utils/text/normalize"

export type SmartNotesOptions = { topic?: any; notes?: string; filePath?: string }
export type SmartNotesResult = { ok: boolean; file: string }

function sanitizeText(s: string) {
  if (!s) return ""
  return s
    .replace(/\u2192/g, "->")
    .replace(/\u00b2/g, "^2")
    .replace(/\u00b3/g, "^3")
}

function wrap(s: string, max = 90) {
  return s
    .split("\n")
    .map(line => {
      const out: string[] = []
      let cur = ""
      for (const w of line.split(/\s+/)) {
        if ((cur + " " + w).trim().length > max) {
          out.push(cur)
          cur = w
        } else {
          cur = (cur ? cur + " " : "") + w
        }
      }
      if (cur) out.push(cur)
      return out.join("\n")
    })
    .join("\n")
}

async function readInput(opts: SmartNotesOptions) {
  if (opts.notes) return opts.notes
  if (opts.filePath) return await fs.promises.readFile(opts.filePath, "utf8")
  if (opts.topic) return `Generate detailed Cornell notes on: ${normalizeTopic(opts.topic)}`
  throw new Error("No input")
}

function extractFirstJsonObject(s: string) {
  let depth = 0, start = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "{") { if (depth === 0) start = i; depth++ }
    else if (ch === "}") { depth--; if (depth === 0 && start !== -1) return s.slice(start, i + 1) }
  }
  return ""
}

function safeParse<T = any>(raw: string): T | null {
  try { return JSON.parse(raw) as T } catch { return null }
}

async function generateNotes(text: string) {
  const prompt = `
ROLE
You are a note generator producing Cornell-style notes.

OBJECTIVE
Generate maximum detailed study notes from the input. 
Respond in the SAME language as the input text (e.g. if input is Vietnamese, response must be Vietnamese).

OUTPUT
Return ONLY a valid JSON object, no markdown, no prose.

SCHEMA
{
  "title": string,
  "notes": string,
  "summary": string,
  "questions": string[],
  "answers": string[]
}

RULES
- Do not wrap with code fences.
- Do not add commentary.
- Use plain text only.
- If a field has no content, return "" or [].
- For each question, the corresponding answer must be in the same index in answers.
`.trim()

  const r1 = await llm.invoke([{ role: "user", content: prompt + "\n\nINPUT:\n" + text }] as any)
  const raw1 = typeof r1 === "string" ? r1 : String((r1 as any)?.content ?? "")
  const parsed1 = safeParse<any>(extractFirstJsonObject(raw1) || raw1)
  if (parsed1 && typeof parsed1 === "object" && parsed1.title) return parsed1

  const retrySys = `Return only a JSON object matching the schema. No markdown. No extra text. Ensure values are in the same language as the input.`
  const r2 = await llm.invoke([
    { role: "system", content: retrySys },
    { role: "user", content: prompt + "\n\nINPUT:\n" + text }
  ] as any)
  const raw2 = typeof r2 === "string" ? r2 : String((r2 as any)?.content ?? "")
  const parsed2 = safeParse<any>(extractFirstJsonObject(raw2) || raw2)
  if (parsed2 && typeof parsed2 === "object" && parsed2.title) return parsed2

  const fallback = {
    title: "Notes",
    notes: sanitizeText(text).slice(0, 4000),
    summary: "",
    questions: [],
    answers: []
  }
  return fallback
}

// Utility to find the correct base directory for assets and storage
function getProjectRoot() {
  const cwd = process.cwd()
  // if we are in backend dir, root is parent
  if (cwd.endsWith("/backend") || cwd.endsWith("\\backend")) {
    return path.join(cwd, "..")
  }
  return cwd
}

async function fillTemplateFormPDF(data: any) {
  const root = getProjectRoot()
  const dir = path.join(root, "assets", "smartnotes")
  if (!fs.existsSync(dir)) {
    console.error("[smartnotes] assets dir not found at:", dir)
    return null
  }
  const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith(".pdf"))
  if (!files.length) return null

  const chosen = files[Math.floor(Math.random() * files.length)]
  const pdfBytes = await fs.promises.readFile(path.join(dir, chosen))
  const pdfDoc = await PDFDocument.load(pdfBytes)
  pdfDoc.registerFontkit(fontkit)

  const form = pdfDoc.getForm()
  let font: any = null
  try {
    const fontPath = path.join(root, "assets", "fonts", "Lexend.ttf")
    if (fs.existsSync(fontPath)) {
      const fontBytes = await fs.promises.readFile(fontPath)
      font = await pdfDoc.embedFont(fontBytes, { subset: true })
      try { form.updateFieldAppearances(font) } catch { }
    } else {
      console.warn("[smartnotes] font not found at:", fontPath)
    }
  } catch { }

  let filledAny = false
  const setField = (name: string, val: string) => {
    try {
      const field = form.getTextField(name)
      if (field) {
        field.setText(val)
        if (font) field.updateAppearances(font)
        filledAny = true
      }
    } catch { }
  }

  setField("topic", sanitizeText(data.title || ""))
  setField("notes", wrap(sanitizeText(data.notes || ""), 80))
  setField("summary", wrap(sanitizeText(data.summary || ""), 80))

  const qna = (data.questions || [])
    .map((q: string, i: number) => {
      const a = data.answers && data.answers[i] ? `\nAnswer: ${data.answers[i]}` : ""
      return `• ${q}${a}`
    })
    .join("\n\n")
  setField("questions", sanitizeText(qna))

  if (!filledAny) return null

  try { form.flatten() } catch { }

  const outDir = path.join(root, "storage", "smartnotes")
  await fs.promises.mkdir(outDir, { recursive: true })
  const safeTitle = sanitizeText(data.title || "notes").replace(/[^a-z0-9]/gi, "_").slice(0, 50)
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = path.join(outDir, `${safeTitle || "notes"}_${ts}.pdf`)
  const outBytes = await pdfDoc.save()
  await fs.promises.writeFile(outPath, outBytes)
  return outPath
}

async function createSimplePDF(data: any) {
  const root = getProjectRoot()
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  let font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica)
  try {
    const fontPath = path.join(root, "assets", "fonts", "Lexend.ttf")
    if (fs.existsSync(fontPath)) {
      const fontBytes = await fs.promises.readFile(fontPath)
      font = await pdfDoc.embedFont(fontBytes, { subset: true })
    }
  } catch (e) {
    console.error("[smartnotes] failed to embed custom font in simple pdf", e)
  }

  const page = pdfDoc.addPage([612, 792])
  const margin = 48
  const width = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const title = sanitizeText(data.title || "Notes")
  page.drawText(title, { x: margin, y, size: 20, font, color: rgb(0, 0, 0) })
  y -= 28

  const sections = [
    { h: "Notes", t: sanitizeText(data.notes || "") },
    { h: "Summary", t: sanitizeText(data.summary || "") },
    {
      h: "Questions",
      t: (data.questions || [])
        .map((q: string, i: number) => {
          const a = data.answers && data.answers[i] ? `\nAnswer: ${data.answers[i]}` : ""
          return `• ${q}${a}`
        })
        .join("\n\n")
    }
  ]

  for (const sec of sections) {
    if (!sec.t) continue
    page.drawText(sec.h, { x: margin, y, size: 14, font, color: rgb(0, 0, 0) })
    y -= 18

    const lines = wrap(sec.t, 90).split("\n")
    for (const line of lines) {
      if (y < margin + 24) {
        y = page.getHeight() - margin
        const p = pdfDoc.addPage([612, 792])
        p.drawText(title, { x: margin, y, size: 12, font, color: rgb(0, 0, 0) })
        y -= 20
      }
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) })
      y -= 14
    }
    y -= 12
  }

  const outDir = path.join(root, "storage", "smartnotes")
  await fs.promises.mkdir(outDir, { recursive: true })
  const safeTitle = sanitizeText(data.title || "notes").replace(/[^a-z0-9]/gi, "_").slice(0, 50)
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = path.join(outDir, `${safeTitle || "notes"}_${ts}.pdf`)
  const outBytes = await pdfDoc.save()
  await fs.promises.writeFile(outPath, outBytes)
  return outPath
}

export async function handleSmartNotes(opts: SmartNotesOptions): Promise<SmartNotesResult> {
  const input = await readInput(opts)
  const data = await generateNotes(input)

  const filled = await fillTemplateFormPDF(data)
  if (filled) return { ok: true, file: filled }

  const simple = await createSimplePDF(data)
  return { ok: true, file: simple }
}
