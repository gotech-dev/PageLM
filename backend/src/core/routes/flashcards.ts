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
}