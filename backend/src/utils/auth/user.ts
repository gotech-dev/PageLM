import jwt from "jsonwebtoken"

export function extractUserId(req: any): string | null {
  try {
    const authHeader = req.headers?.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null
    const token = authHeader.substring(7)
    if (!process.env.JWT_SECRET) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any
    return decoded.sub || decoded.userId || decoded.id || null
  } catch {
    return null
  }
}
