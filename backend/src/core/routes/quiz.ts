import { handleQuiz } from "../../services/quiz";
import { emitToAll } from "../../utils/chat/ws";
import { withTimeout } from "../../utils/quiz/promise";
import crypto from "crypto";
import { extractUserId } from "../../utils/auth/user";
import { calculateCredits, checkCredits, consumeCredits, estimateTokens, getDefaultModelName } from "../../services/credits";

const qs = new Map<string, Set<any>>();
const qlog = (...a: any) => console.log("[quiz]", ...a);

export function quizRoutes(app: any) {
  app.ws("/ws/quiz", (ws: any, req: any) => {
    const u = new URL(req.url, "http://localhost");
    const id = u.searchParams.get("quizId");
    if (!id) return ws.close(1008, "quizId required");

    let s = qs.get(id);
    if (!s) {
      s = new Set();
      qs.set(id, s);
    }
    s.add(ws);

    qlog("ws open", id, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", quizId: id }));

    ws.on("error", (e: any) => qlog("ws err", id, e?.message || e));
    ws.on("close", () => {
      s!.delete(ws);
      if (s!.size === 0) qs.delete(id);
      qlog("ws close", id, "left:", s!.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  app.post("/quiz", async (req: any, res: any) => {
    try {
      const topic = String(req.body?.topic || "").trim();
      if (!topic)
        return res.status(400).send({ ok: false, error: "topic required" });

      const model = getDefaultModelName();
      const quizId = crypto.randomUUID();
      const uid = extractUserId(req);
      let remainingCredits: number | undefined;
      let creditCheck: Awaited<ReturnType<typeof checkCredits>> | null = null
      // Pre-check credits only; consume after generation succeeds
      try {
        if (uid) {
          const check = await checkCredits(uid, { inputText: topic, outputRatio: 2.5, model });
          creditCheck = check;
          remainingCredits = check.currentCredits;
          if (!check.sufficient) {
            return res.status(402).send({ ok: false, error: "INSUFFICIENT_CREDITS" });
          }
        }
      } catch (err: any) {
        if (err?.message === "INSUFFICIENT_CREDITS") {
          return res.status(402).send({ ok: false, error: "INSUFFICIENT_CREDITS" });
        }
        qlog("credit check failed", err?.message || err);
      }

      qlog("start", quizId, "topic:", topic);

      res
        .status(202)
        .send({ ok: true, quizId, stream: `/ws/quiz?quizId=${quizId}`, credits: remainingCredits });

      setImmediate(async () => {
        try {
          emitToAll(qs.get(quizId), { type: "phase", value: "generating" });
          const qz = await withTimeout(handleQuiz(topic), 60000, "handleQuiz");
          qlog("generated", quizId, Array.isArray(qz) ? qz.length : "n/a");
          emitToAll(qs.get(quizId), { type: "quiz", quiz: qz });
          if (uid && creditCheck) {
            try {
              const inputTokens = estimateTokens(topic, model);
              const outputTokens = estimateTokens(JSON.stringify(qz), model);
              const actual = await calculateCredits(inputTokens, outputTokens, model);
              const remaining = await consumeCredits(uid, actual.credits, {
                aiModel: model,
                taskType: "quiz_generate",
                inputTokens: actual.inputTokens,
                outputTokens: actual.outputTokens,
                inputHash: crypto.createHash("sha256").update(topic).digest("hex"),
                meta: { quizId, topicPreview: topic.slice(0, 200) },
              });
              emitToAll(qs.get(quizId), {
                type: "credits",
                credits: remaining,
                spent: actual.credits,
                inputTokens: actual.inputTokens,
                outputTokens: actual.outputTokens,
              });
            } catch (err: any) {
              qlog("credit consume failed", err?.message || err);
              emitToAll(qs.get(quizId), { type: "credits_error", error: err?.message || "credit_consume_failed" });
            }
          }
          emitToAll(qs.get(quizId), { type: "done" });
          qlog("done", quizId);
        } catch (e: any) {
          qlog("error", quizId, e?.message || e);
          emitToAll(qs.get(quizId), {
            type: "error",
            error: e?.message || "failed",
          });
        }
      });
    } catch (e: any) {
      qlog("500 route err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });
}
