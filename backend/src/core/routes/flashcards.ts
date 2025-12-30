import { authMiddleware, AuthRequest } from '../../middleware/auth'
import * as flashcardService from '../../services/flashcards'

export function flashcardRoutes(app: any) {
  app.post('/flashcards', authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      const { question, answer, tag } = req.body
      if (!question || !answer || !tag) {
        return res.status(400).send({ error: 'question, answer, tag required' })
      }

      const card = await flashcardService.createFlashcard(req.userId!, question, answer, tag)
      res.send({ ok: true, flashcard: card })
    } catch (e: unknown) {
      const error = e as Error
      res.status(500).send({ ok: false, error: error?.message || 'failed' })
    }
  })

  app.get('/flashcards', authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      const tag = req.query.tag as string | undefined
      const flashcards = await flashcardService.listFlashcards(req.userId!, tag)
      res.send({ ok: true, flashcards })
    } catch (e: unknown) {
      const error = e as Error
      res.status(500).send({ ok: false, error: error?.message || 'failed' })
    }
  })

  app.delete('/flashcards/:id', authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      const id = req.params.id
      if (!id) return res.status(400).send({ error: 'id required' })

      await flashcardService.deleteFlashcard(id)
      res.send({ ok: true })
    } catch (e: unknown) {
      const error = e as Error
      res.status(500).send({ ok: false, error: error?.message || 'failed' })
    }
  })

  app.patch('/flashcards/:id', authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      const id = req.params.id
      const { question, answer, tag } = req.body

      const updated = await flashcardService.updateFlashcard(id, { question, answer, tag })
      res.send({ ok: true, flashcard: updated })
    } catch (e: unknown) {
      const error = e as Error
      res.status(500).send({ ok: false, error: error?.message || 'failed' })
    }
  })

  // ========== NEW: Auto-generate flashcards from topics ==========
  // Endpoint này được gọi khi user đến từ BGTT exam
  app.post('/flashcards/generate', authMiddleware, async (req: AuthRequest, res: any) => {
    try {
      const { topics, examName, wrongQuestions } = req.body

      if (!topics || !Array.isArray(topics) || topics.length === 0) {
        return res.status(400).send({ error: 'topics array required' })
      }

      console.log('[Flashcards/Generate] Generating for topics:', topics)
      console.log('[Flashcards/Generate] Exam name:', examName || 'N/A')
      console.log('[Flashcards/Generate] Wrong questions count:', wrongQuestions?.length || 0)

      // Import AI function
      const { handleAsk } = await import('../../lib/ai/ask')

      // Generate flashcards for each topic
      const allCards: any[] = []

      // Build context từ câu hỏi sai
      const wrongQuestionsContext = Array.isArray(wrongQuestions) && wrongQuestions.length > 0
        ? `\n\nVÍ DỤ CÁC CÂU HỌC SINH LÀM SAI:\n${wrongQuestions.slice(0, 3).map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}`
        : ''

      for (const topic of topics.slice(0, 3)) { // Limit to 3 topics to avoid timeout
        const prompt = `Tạo chính xác 5 flashcards về ${examName || 'Toán học'} để ôn tập kiến thức: "${topic}".

BỐI CẢNH: Học sinh làm bài thi ${examName || 'Toán học'} và bị yếu ở phần "${topic}".${wrongQuestionsContext}

YÊU CẦU BẮT BUỘC:
- Flashcards phải về KIẾN THỨC ${examName || 'TOÁN HỌC'} liên quan đến "${topic}"
- Trả về JSON với mảng "flashcards" chứa ĐÚNG 5 items
- Mỗi item có "q" (câu hỏi về công thức/khái niệm) và "a" (giải thích ngắn gọn)
- KHÔNG tạo flashcard về kỹ năng làm bài chung, chỉ tập trung vào KIẾN THỨC CỤ THỂ
- Câu hỏi phải giúp học sinh hiểu sâu về chủ đề

Ví dụ format:
{
  "topic": "${topic}",
  "answer": "...",
  "flashcards": [
    {"q": "Công thức tính ... là gì?", "a": "..."},
    {"q": "Giải thích khái niệm ...", "a": "..."},
    ...
  ]
}`

        try {
          console.log(`[Flashcards/Generate] Calling AI for topic: "${topic}"`)
          const result = await handleAsk(prompt, 'pagelm', 6, [], true) // fastMode=true

          console.log(`[Flashcards/Generate] AI result for "${topic}":`, {
            hasTopic: !!result.topic,
            hasAnswer: !!result.answer,
            flashcardsCount: result.flashcards?.length || 0
          })

          if (result.flashcards && result.flashcards.length > 0) {
            console.log(`[Flashcards/Generate] Found ${result.flashcards.length} flashcards for "${topic}"`)
            for (const card of result.flashcards) {
              // Save each flashcard to DB
              const saved = await flashcardService.createFlashcard(
                req.userId!,
                card.q,
                card.a,
                'flashcard'
              )
              allCards.push(saved)
            }
          } else {
            console.log(`[Flashcards/Generate] NO flashcards returned for "${topic}"`)
            console.log(`[Flashcards/Generate] Full result:`, JSON.stringify(result).slice(0, 500))
          }
        } catch (err) {
          console.error(`[Flashcards/Generate] Error for topic "${topic}":`, err)
        }
      }

      console.log(`[Flashcards/Generate] Created ${allCards.length} flashcards`)

      res.send({
        ok: true,
        flashcards: allCards,
        message: `Đã tạo ${allCards.length} flashcards cho ${topics.length} chủ đề`
      })

    } catch (e: unknown) {
      const error = e as Error
      console.error('[Flashcards/Generate] Error:', error)
      res.status(500).send({ ok: false, error: error?.message || 'Generation failed' })
    }
  })
}