import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import pdf from 'pdf-parse'
import Busboy from 'busboy'
import { marked } from 'marked'
import { embedTextFromFile } from '../ai/embed'
import { OllamaEmbeddings } from '@langchain/ollama'
import { OpenAIEmbeddings } from '@langchain/openai'
import { convertPdfFirstPageToImage, cleanupTempImage } from './pdfToImage'
import { extractTextFromImage } from '../ocr/geminiVision'

const str = path.join(process.cwd(), 'storage', 'uploads')
if (!fs.existsSync(str)) fs.mkdirSync(str, { recursive: true })

export type UpFile = { path: string; filename: string; mimeType: string }

export function parseMultipart(req: any): Promise<{ q: string; chatId?: string; files: UpFile[]; fastMode?: boolean }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers })
    let q = ''
    let chatId = ''
    let fastMode = false
    const files: UpFile[] = []
    let pending = 0
    let ended = false
    let failed = false
    const done = () => { if (!failed && ended && pending === 0) resolve({ q, chatId: chatId || undefined, files, fastMode }) }

    bb.on('field', (n, v) => {
      if (n === 'q') q = v
      if (n === 'chatId') chatId = v
      if (n === 'fastMode') fastMode = v === 'true' || v === '1'
    })
    bb.on('file', (_n, file, info: any) => {
      pending++
      const filename = info?.filename || 'file'
      const mimeType = info?.mimeType || info?.mime || 'application/octet-stream'
      const fp = path.join(str, `${Date.now()}-${filename}`)
      const ws = fs.createWriteStream(fp)
      file.on('error', e => { failed = true; reject(e) })
      ws.on('error', e => { failed = true; reject(e) })
      ws.on('finish', () => { files.push({ path: fp, filename, mimeType }); pending--; done() })
      file.pipe(ws)
    })
    bb.on('error', e => { failed = true; reject(e) })
    bb.on('finish', () => { ended = true; done() })
    req.pipe(bb)
  })
}

export async function handleUpload(a: { filePath: string; filename?: string; contentType?: string; namespace?: string }): Promise<{ stored: string }> {
  const fp = a.filePath
  const mime = a.contentType || ''
  const ns = a.namespace || 'pagelm'
  let txt = ''
  try {
    txt = await extractText(fp, mime, a.filename)
  } catch (err: any) {
    console.error(`[handleUpload] Extraction failed for ${a.filename}:`, err.message)
    txt = `[Error extracting text from ${a.filename}: ${err.message}]`
  }

  if (!txt?.trim()) {
    console.warn(`[handleUpload] No content extracted from ${a.filename}`)
    txt = `[The file "${a.filename || 'uploaded file'}" was processed but no readable text could be extracted. It might be a scanned image or an unsupported format.]`
  }
  const out = `${fp}.txt`
  fs.writeFileSync(out, txt)
  const isO = process.env.LLM_PROVIDER === 'ollama'
  const _emb = isO
    ? new OllamaEmbeddings({ model: process.env.OLLAMA_MODEL || 'llama3' })
    : new OpenAIEmbeddings({ model: 'text-embedding-3-small', openAIApiKey: process.env.OPENROUTER_API_KEY, configuration: { baseURL: 'https://openrouter.ai/api/v1' } })
  await embedTextFromFile(out, ns)
  return { stored: out }
}

async function extractText(filePath: string, mime: string, filename?: string) {
  const raw = fs.readFileSync(filePath)
  if (!raw || raw.length === 0) return ''

  const m = (mime || '').toLowerCase()
  const ext = filename ? path.extname(filename).toLowerCase() : ''

  // Handle PDF files
  if (m.includes('pdf') || ext === '.pdf') {
    try {
      const data = await pdf(raw)
      const t = data.text || ''

      // If text extraction successful, return it
      if (t.trim()) {
        console.log(`[extractText] PDF text extraction successful: ${t.length} chars`)
        return t
      }

      // Scanned PDF detected - try OCR fallback
      if (data.numpages > 0) {
        console.log(`[extractText] Scanned PDF detected (${data.numpages} pages), attempting OCR fallback...`)

        // Convert first page to image
        const imagePath = await convertPdfFirstPageToImage(filePath)
        if (imagePath) {
          try {
            // Perform OCR using Gemini Vision
            const ocrText = await extractTextFromImage(imagePath)
            if (ocrText && ocrText.trim()) {
              console.log(`[extractText] OCR successful: ${ocrText.length} chars extracted`)
              return ocrText
            } else {
              console.warn('[extractText] OCR returned empty text')
            }
          } finally {
            // Always cleanup temp image
            cleanupTempImage(imagePath)
          }
        } else {
          console.warn('[extractText] PDF to image conversion failed')
        }

        return `[PDF file "${filename}" has ${data.numpages} page(s) but OCR could not extract readable text. Please try uploading a clearer image or a text-based PDF.]`
      }

      return ''
    } catch (e: any) {
      console.error(`[extractText] PDF parsing error: ${e.message}`)
      return `[Error parsing PDF: ${e.message}]`
    }
  }

  // Handle image files - direct OCR
  if (m.includes('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)) {
    console.log(`[extractText] Image file detected, performing OCR...`)
    try {
      const ocrText = await extractTextFromImage(filePath)
      if (ocrText && ocrText.trim()) {
        console.log(`[extractText] Image OCR successful: ${ocrText.length} chars`)
        return ocrText
      }
    } catch (e: any) {
      console.error(`[extractText] Image OCR error: ${e.message}`)
    }
    return ''
  }

  if (m.includes('markdown') || ext === '.md') {
    return marked.parse(raw.toString())
  }
  if (m.includes('plain') || ext === '.txt') {
    return raw.toString()
  }
  if (m.includes('wordprocessingml') || m.includes('msword') || m.includes('vnd.oasis.opendocument.text') || ext === '.docx' || ext === '.doc') {
    try {
      const r = await mammoth.extractRawText({ buffer: raw })
      return r.value
    } catch (e: any) {
      return `[Error parsing Word document: ${e.message}]`
    }
  }
  return ''
}
