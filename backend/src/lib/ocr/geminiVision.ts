import fs from 'fs'
import path from 'path'

/**
 * Gemini Vision OCR Service
 * Uses Gemini Vision API to extract text from images (especially scanned PDFs with math content)
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Extract text from an image using Gemini Vision API
 * Optimized for math content and Vietnamese text
 */
export async function extractTextFromImage(imagePath: string): Promise<string> {
    const apiKey = process.env.gemini || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY

    if (!apiKey) {
        console.error('[geminiVision] No Gemini API key configured')
        return ''
    }

    if (!fs.existsSync(imagePath)) {
        console.error(`[geminiVision] Image file not found: ${imagePath}`)
        return ''
    }

    try {
        // Read and encode image
        const imageBuffer = fs.readFileSync(imagePath)
        const base64Image = imageBuffer.toString('base64')
        const mimeType = getMimeType(imagePath)

        console.log(`[geminiVision] Processing image: ${imagePath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`)

        // Build request
        const url = `${GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Image
                            }
                        },
                        {
                            text: `Bạn là hệ thống OCR chuyên trích xuất văn bản từ ảnh.

NHIỆM VỤ: Trích xuất CHÍNH XÁC toàn bộ văn bản trong ảnh này.

QUY TẮC:
- Giữ nguyên cấu trúc văn bản (dòng, đoạn)
- Đối với công thức toán học: sử dụng ký hiệu LaTeX 
- Giữ nguyên số thứ tự câu hỏi (Câu 1, Câu 2, Bài 1, v.v.)
- Không thêm giải thích, chỉ trả về văn bản được trích xuất
- Nếu có nhiều câu hỏi, liệt kê tất cả

CHỈ TRẢ VỀ VĂN BẢN ĐƯỢC TRÍCH XUẤT, KHÔNG CÓ GIẢI THÍCH GÌ THÊM.`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1, // Low temperature for accurate extraction
                maxOutputTokens: 8192,
                topP: 0.95,
                topK: 40
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
            ]
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[geminiVision] API error ${response.status}: ${errorText}`)
            return ''
        }

        const data = await response.json() as any

        // Extract text from response
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (text) {
            console.log(`[geminiVision] OCR successful, extracted ${text.length} characters`)
            // Log token usage if available
            if (data?.usageMetadata) {
                console.log(`[geminiVision] Tokens: prompt=${data.usageMetadata.promptTokenCount}, response=${data.usageMetadata.candidatesTokenCount}`)
            }
        } else {
            console.warn('[geminiVision] No text extracted from response')
        }

        return text

    } catch (e: any) {
        console.error(`[geminiVision] OCR failed: ${e.message}`)
        return ''
    }
}

/**
 * Get MIME type for image file
 */
function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.heic': 'image/heic',
        '.heif': 'image/heif'
    }
    return mimeTypes[ext] || 'image/png'
}

/**
 * Check if Gemini Vision OCR is available
 */
export function isGeminiVisionAvailable(): boolean {
    const apiKey = process.env.gemini || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    return !!apiKey
}
