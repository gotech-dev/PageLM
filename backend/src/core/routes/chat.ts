import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { BASE_SYSTEM_PROMPT, FAST_SYSTEM_PROMPT, buildAskContext, handleAsk } from "../../lib/ai/ask";
import { parseMultipart, handleUpload } from "../../lib/parser/upload";
import {
  mkChat,
  getChat,
  addMsg,
  listChats,
  getMsgs,
} from "../../utils/chat/chat";
import { emitToAll } from "../../utils/chat/ws";
import { calculateCredits, checkCredits, consumeCredits, getDefaultModelName } from "../../services/credits";
import type { CreditCheck } from "../../services/credits";
import { extractUserId } from "../../utils/auth/user";

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
const JWT_SECRET: string = process.env.JWT_SECRET

function getUserId(req: any): string {
  try {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return decoded.sub || decoded.userId || decoded.id || "default-user";
    }
  } catch (e) {
    // ignore invalid tokens
  }
  return "default-user";
}

type UpFile = { path: string; filename: string; mimeType: string };

const chatSockets = new Map<string, Set<any>>();

function normalizeHistoryForPrompt(history: any[]): Array<{ role: string; content: any }> {
  return (history || [])
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
    .slice(-6)
    .map((msg) => ({ role: msg.role, content: msg.content }));
}

export function chatRoutes(app: any) {
  app.ws("/ws/chat", (ws: any, req: any) => {
    const url = new URL(req.url, "http://localhost");
    const chatId = url.searchParams.get("chatId");
    if (!chatId) {
      return ws.close(1008, "chatId required");
    }

    let set = chatSockets.get(chatId);
    if (!set) {
      set = new Set();
      chatSockets.set(chatId, set);
    }
    set.add(ws);

    ws.on("close", (code: number, reason: string) => {
      set!.delete(ws);
      if (set!.size === 0) chatSockets.delete(chatId);
    });

    ws.send(JSON.stringify({ type: "ready", chatId }));
  });

  app.post("/chat", async (req: any, res: any, next: any) => {
    const t0 = Date.now();
    try {
      const ct = String(req.headers["content-type"] || "");
      const isMp = ct.includes("multipart/form-data");

      // Extract User ID
      const userId = getUserId(req);

      let q = "";
      let chatId: string | undefined;
      let files: UpFile[] = [];
      let fastMode = false;
      let remainingCredits: number | undefined;
      let creditCheck: CreditCheck | null = null;
      const uid = extractUserId(req);
      const model = getDefaultModelName();

      if (isMp) {
        const tMp = Date.now();
        const { q: mq, chatId: mcid, files: mf, fastMode: mfm } = await parseMultipart(req);
        q = mq;
        chatId = mcid;
        files = mf || [];
        fastMode = !!mfm;
        if (!q)
          return res.status(400).send({ error: "q required for file uploads" });
      } else {
        q = req.body?.q || "";
        chatId = req.body?.chatId;
        fastMode = !!req.body?.fastMode;
        if (!q) return res.status(400).send({ error: "q required" });
      }

      let chat = chatId ? await getChat(chatId) : undefined;
      // FIX: pass userId and q (title) to mkChat
      if (!chat) chat = await mkChat(userId, q);
      const id = chat.id;
      const ns = `chat:${id}`;
      const inputHash = q ? crypto.createHash('sha256').update(q).digest('hex') : null;
      const systemPrompt = fastMode ? FAST_SYSTEM_PROMPT : BASE_SYSTEM_PROMPT;

      let historyForEstimate: Array<{ role: string; content: any }> = [];
      try {
        historyForEstimate = normalizeHistoryForPrompt(await getMsgs(id));
      } catch (err: any) {
        console.error("[chat] failed to load history for estimate:", err?.message || err);
      }

      let askContext = "NO_CONTEXT";
      try {
        const ctxRes = await buildAskContext(q, ns, fastMode, 6);
        askContext = ctxRes.context;
      } catch (err: any) {
        console.error("[chat] failed to build context for estimate:", err?.message || err);
      }

      // Check credits first; only consume after successful generation
      try {
        if (uid) {
          const check = await checkCredits(uid, {
            inputText: q,
            outputRatio: 1.6,
            model,
            contextText: askContext,
            systemPrompt,
            historyMessages: historyForEstimate,
          });
          creditCheck = check;
          if (!check.sufficient) {
            return res.status(402).send({ ok: false, error: "INSUFFICIENT_CREDITS" });
          }
        }
      } catch (err: any) {
        const msg = err?.message || "credit_error";
        console.error("[chat] credit check failed:", msg);
      }

      res
        .status(202)
        .send({ ok: true, chatId: id, stream: `/ws/chat?chatId=${id}` });
      (async () => {
        try {
          if (isMp) {
            emitToAll(chatSockets.get(id), {
              type: "phase",
              value: "upload_start",
            });
            const tUp = Date.now();
            for (const f of files) {
              emitToAll(chatSockets.get(id), {
                type: "file",
                filename: f.filename,
                mime: f.mimeType,
              });
              await handleUpload({
                filePath: f.path,
                filename: f.filename,
                contentType: f.mimeType,
                namespace: ns,
              });
            }
            emitToAll(chatSockets.get(id), {
              type: "phase",
              value: "upload_done",
            });
          }

          const tUser = Date.now();
          await addMsg(id, { role: "user", content: q, createdAt: new Date() });
          emitToAll(chatSockets.get(id), {
            type: "phase",
            value: "generating",
          });

          let answer: any = "";

          const askResult = await handleAsk({
            q,
            namespace: ns,
            history: historyForEstimate,
            fastMode,
            context: askContext,
          });
          answer = askResult.answer;

          await addMsg(id, {
            role: "assistant",
            content: answer,
            createdAt: new Date(),
          });
          emitToAll(chatSockets.get(id), { type: "answer", answer });
          if (uid && creditCheck) {
            try {
              const usage = askResult.usage;
              let creditsToConsume = creditCheck.credits;
              let logInputTokens = creditCheck.inputTokens;
              let logOutputTokens = creditCheck.outputTokens;
              if (usage && (usage.inputTokens !== undefined || usage.outputTokens !== undefined || usage.totalTokens !== undefined)) {
                const rawInput = usage.inputTokens ?? (usage.totalTokens !== undefined && usage.outputTokens !== undefined
                  ? usage.totalTokens - usage.outputTokens
                  : undefined);
                const rawOutput = usage.outputTokens ?? (usage.totalTokens !== undefined && usage.inputTokens !== undefined
                  ? usage.totalTokens - usage.inputTokens
                  : undefined);

                const inputTokens = rawInput !== undefined ? Math.max(0, rawInput) : undefined;
                const outputTokens = rawOutput !== undefined ? Math.max(0, rawOutput) : undefined;

                const hasInput = typeof inputTokens === "number" && Number.isFinite(inputTokens) && inputTokens > 0;
                const hasOutput = typeof outputTokens === "number" && Number.isFinite(outputTokens) && outputTokens > 0;

                if (hasInput && hasOutput) {
                  const actual = await calculateCredits(inputTokens!, outputTokens!, model);
                  creditsToConsume = actual.credits;
                  logInputTokens = inputTokens!;
                  logOutputTokens = outputTokens!;
                }
              }

              const meta = {
                chatId: id,
                fastMode,
                questionPreview: q.slice(0, 200),
                files: files?.map((f) => ({ filename: f.filename, mimeType: f.mimeType })) || [],
              };
              const remaining = await consumeCredits(uid, creditsToConsume, {
                aiModel: model,
                taskType: "chat",
                inputTokens: logInputTokens,
                outputTokens: logOutputTokens,
                inputHash,
                meta,
              });
              remainingCredits = remaining;
              emitToAll(chatSockets.get(id), { type: "credits", credits: remaining });
            } catch (err: any) {
              const msg = err?.message || "credit_consume_failed";
              console.error("[chat] credit consume failed:", msg);
              emitToAll(chatSockets.get(id), { type: "credits_error", error: msg });
            }
          }
          emitToAll(chatSockets.get(id), { type: "done" });
        } catch (err: any) {
          const msg = err?.message || "failed";
          const stack = err?.stack || String(err);
          console.error("[chat] err inner", { chatId: id, msg, stack });
          emitToAll(chatSockets.get(id), { type: "error", error: msg });
        }
      })().catch((e: any) => {
        console.error("[chat] err runner", e?.message || e);
      });
    } catch (e: any) {
      console.error("[chat] err outer", e?.message || e);
      next(e);
    }
  });

  app.get("/chats", async (req: any, res: any) => {
    try {
      const t = Date.now();
      // FIX: pass userId to listChats
      const userId = getUserId(req);
      const chats = await listChats(userId);
      res.send({ ok: true, chats });
    } catch (e: any) {
      console.error("GET /chats error:", e);
      res.status(500).send({ error: e.message });
    }
  });

  app.get("/chats/:id", async (req: any, res: any) => {
    const t = Date.now();
    const id = req.params.id;
    const chat = await getChat(id);
    if (!chat) {
      return res.status(404).send({ error: "not found" });
    }
    const messages = await getMsgs(id);
    res.send({ ok: true, chat, messages });
  });
}
