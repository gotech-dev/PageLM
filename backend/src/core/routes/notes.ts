import fs from "fs";
import { handleSmartNotes } from "../../services/smartnotes";
import { emitToAll } from "../../utils/chat/ws";
import { withTimeout } from "../../utils/quiz/promise";
import { config } from "../../config/env";
import crypto from "crypto";
import path from "path";
import { extractUserId } from "../../utils/auth/user";
import { calculateCredits, checkCredits, consumeCredits, estimateTokens, getDefaultModelName } from "../../services/credits";

const ns = new Map<string, Set<any>>();
const nlog = (...a: any) => console.log("[smartnotes]", ...a);

export function smartnotesRoutes(app: any) {
  app.ws("/ws/smartnotes", (ws: any, req: any) => {
    const u = new URL(req.url, "http://localhost");
    const id = u.searchParams.get("noteId");
    if (!id) return ws.close(1008, "noteId required");

    let s = ns.get(id);
    if (!s) {
      s = new Set();
      ns.set(id, s);
    }
    s.add(ws);

    nlog("ws open", id, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", noteId: id }));

    ws.on("error", (e: any) => nlog("ws err", id, e?.message || e));
    ws.on("close", () => {
      s!.delete(ws);
      if (s!.size === 0) ns.delete(id);
      nlog("ws close", id, "left:", s!.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  app.post("/smartnotes", async (req: any, res: any) => {
    try {
      const { topic, notes, filePath } = req.body || {};
      if (!topic && !notes && !filePath) {
        return res
          .status(400)
          .send({ ok: false, error: "Provide topic, notes, or filePath" });
      }

      const noteId = crypto.randomUUID();
      nlog("start", noteId, "input:", { topic, notes, filePath });

      const model = getDefaultModelName();
      let pendingCredits: number | undefined;
      let currentCredits: number | undefined;
      let inputText = [topic, notes].filter(Boolean).join("\n").trim();
      if (filePath && !inputText) {
        try { inputText = fs.readFileSync(filePath, "utf8"); } catch { /* ignore */ }
      }
      if (!inputText) {
        inputText = String(topic || notes || filePath || "smartnotes").trim();
      }
      // Pre-check credits (do not consume yet)
      try {
        const uid = extractUserId(req);
        if (uid && inputText) {
          const check = await checkCredits(uid, { inputText, outputRatio: 2, model });
          pendingCredits = check.credits;
          currentCredits = check.currentCredits;
          if (!check.sufficient) {
            return res.status(402).send({ ok: false, error: "INSUFFICIENT_CREDITS" });
          }
        }
      } catch (err: any) {
        if (err?.message === "INSUFFICIENT_CREDITS") {
          return res.status(402).send({ ok: false, error: "INSUFFICIENT_CREDITS" });
        }
        nlog("credit check failed", err?.message || err);
      }

      // Fallback: if we couldn't compute pendingCredits (e.g., no uid or check failed), estimate locally
      if (pendingCredits === undefined && inputText) {
        try {
          const inputTokensEst = estimateTokens(inputText, model);
          const outputTokensEst = Math.max(inputTokensEst * 2, 0);
          const est = await calculateCredits(inputTokensEst, outputTokensEst, model);
          pendingCredits = est.credits;
        } catch (err: any) {
          nlog("credit fallback estimate failed", err?.message || err);
        }
      }
      // Ensure we always send an explicit pending credits number to avoid UI defaulting to 1
      if (pendingCredits === undefined) {
        pendingCredits = 0;
      }

      res
        .status(202)
        .send({
          ok: true,
          noteId,
          stream: `/ws/smartnotes?noteId=${noteId}`,
          credits: currentCredits,
          pendingCredits,
          pending: true,
        });

      setImmediate(async () => {
        try {
          emitToAll(ns.get(noteId), { type: "phase", value: "generating" });
          if (currentCredits !== undefined) {
            emitToAll(ns.get(noteId), {
              type: "credits",
              credits: currentCredits,
              pending: true,
              pendingCredits,
            });
          }
          const result = await withTimeout(
            handleSmartNotes({ topic, notes, filePath }),
            120000,
            "handleSmartNotes"
          );
          nlog("generated", noteId, result.file);
          emitToAll(ns.get(noteId), {
            type: "file",
            file: `${config.url}/storage/smartnotes/${path.basename(
              result.file
            )}`,
          });
          try {
            const uid = extractUserId(req);
            if (uid) {
              const inputTokens = result.usage?.inputTokens ?? estimateTokens(inputText, model);
              const outputTokens = result.usage?.outputTokens ?? Math.max(inputTokens * 2, 0);
              const actual = await calculateCredits(inputTokens, outputTokens, model);
              const remaining = await consumeCredits(uid, actual.credits, {
                aiModel: model,
                taskType: "smartnotes",
                inputTokens,
                outputTokens,
                inputHash: inputText ? crypto.createHash("sha256").update(inputText).digest("hex") : null,
                meta: { noteId, hasFile: !!filePath, topicPreview: String(topic || "").slice(0, 200) },
              });
              emitToAll(ns.get(noteId), {
                type: "credits",
                credits: remaining,
                spent: actual.credits,
                inputTokens,
                outputTokens,
              });
            }
          } catch (err: any) {
            nlog("credit consume failed", err?.message || err);
            emitToAll(ns.get(noteId), { type: "credits_error", error: err?.message || "credit_consume_failed" });
          }
          emitToAll(ns.get(noteId), { type: "done" });
          nlog("done", noteId);
        } catch (e: any) {
          nlog("error", noteId, e?.message || e);
          emitToAll(ns.get(noteId), {
            type: "error",
            error: e?.message || "failed",
          });
        }
      });
    } catch (e: any) {
      nlog("500 route err", e?.message || e);
      res.status(500).send({ ok: false, error: e?.message || "internal" });
    }
  });
}
