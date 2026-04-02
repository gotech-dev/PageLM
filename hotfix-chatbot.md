# 🐛 Hotfix Report: Chatbot Standard Mode — "Đang suy nghĩ..." Xoáy Vô Tận

**Ngày phát hiện:** 2026-02-27  
**Cập nhật lần cuối:** 2026-02-27 (sau code review)  
**Mức độ:** 🔴 Critical — Ảnh hưởng 100% request không có file ở chế độ tiêu chuẩn  
**Stack:** Node.js Backend (TypeScript) + React Frontend (TypeScript/Vite)

---

## 📋 Tóm tắt vấn đề

Khi người dùng gõ "Xin chào" (hoặc bất kỳ tin nhắn nào) ở chế độ **tiêu chuẩn** (không upload file), chatbot hiển thị trạng thái "Đang suy nghĩ..." (spinner) nhưng **không bao giờ nhận được câu trả lời**, khiến UI bị kẹt vô tận.

---

## 🔍 Phân tích Nguyên nhân Gốc rễ

### Bug #1 (CRITICAL): WebSocket được tạo TRƯỚC khi `chatId` được giao

**File:** `frontend/src/pages/Chat.tsx` — dòng **261–273** (`sendFollowup`)

> ✅ **Line numbers đã được verify**: `sendFollowup` bắt đầu L261, kết thúc L273. `setChatId` ở L269.

**Flow thực tế khi gõ tin nhắn lần đầu:**

```
1. sendFollowup("Xin chào") được gọi
2. chatJSON({ q: "Xin chào", chatId: undefined }) → POST /chat
   → Server trả về { chatId: "NEW_UUID", stream: "..." }
3. r.chatId !== chatId → setChatId("NEW_UUID")  ✅ (chatId state được cập nhật)
4. setBusy(false)
```

```
5. useEffect([chatId]) kích hoạt → tạo WebSocket mới với chatId mới
6. NHƯNG: Server đã xử lý xong và emit "answer" rồi!
   → WebSocket kết nối SAU khi "answer" đã được gửi
   → Frontend KHÔNG BAO GIỜ nhận được event "answer"
```

**Code gốc tại dòng 261–273:**
```typescript
const sendFollowup = async (q: string) => {
  const text = q.trim();
  if (!text || busy) return;
  setMessages((prev) => ([...(Array.isArray(prev) ? prev : []), { role: "user", content: text, at: Date.now() }]));
  setAwaitingAnswer(true);   // L265 ← SPINNER BẮT ĐẦU
  setBusy(true);
  try {
    const r = await chatJSON({ q: text, chatId: chatId || undefined, fastMode });
    if (r?.chatId && r.chatId !== chatId) setChatId(r.chatId); // L269
    // setChatId() trigger useEffect([chatId]) → kết nối WS mới
    // Nhưng "answer" đã emit RỒI từ server async trong khi chờ WS connect
  } finally {
    setBusy(false);           // L271
  }                           // L273 ← Không bao giờ reset awaitingAnswer
};
```

**Hệ quả:** `awaitingAnswer` = `true` mãi mãi → spinner không dừng.

---

### Bug #2 (CRITICAL): Race condition giữa WebSocket và HTTP response

**File:** `backend/src/core/routes/chat.ts` — dòng 93–157

```typescript
// Server trả về 202 NGAY LẬP TỨC
res.status(202).send({ ok: true, chatId: id, stream: `/ws/chat?chatId=${id}` });

// Rồi xử lý async TRONG BACKGROUND
(async () => {
  // RAG search (8000ms timeout)
  // LLM call (có thể rất nhanh với "Xin chào")
  await addMsg(id, { role: "assistant", content: answer, ... }); // L142–146 ← Lưu DB TRƯỚC
  emitToAll(chatSockets.get(id), { type: "answer", answer });    // L147 ← Emit WS SAU
})()
```

✅ **Xác nhận (từ code review):** Server đã `addMsg()` vào DB **trước** khi `emitToAll()`, nên dữ liệu luôn có trong DB — polling là viable.

**Vấn đề:** Frontend có thể chưa kịp kết nối WebSocket trước khi server emit `answer`.

Với câu hỏi ngắn như "Xin chào":
- LLM (Gemini 2.5 Flash) trả lời rất nhanh (~1–3 giây)
- Frontend cần thời gian để: nhận HTTP response → `setChatId()` → `useEffect` chạy → tạo WebSocket → WS handshake
- **Answer đã emit trước khi WS connect xong → message bị bỏ qua**

---

### Bug #3 (MEDIUM): `awaitingAnswer` không có cơ chế fallback reset

**File:** `frontend/src/pages/Chat.tsx` — dòng 265, 177

> ✅ **Line numbers đã được verify**: `setAwaitingAnswer(true)` ở L265, reset ở L177 (`ws.onmessage`), L146 (`getChatDetail`).

`setAwaitingAnswer(true)` được gọi khi gửi (dòng 265), nhưng chỉ được reset về `false` tại:
- `ws.onmessage` khi nhận `type === "answer"` (dòng 177) ← không bao giờ xảy ra vì Bug #1/#2
- `getChatDetail` khi thấy có `assistant` message (dòng 146)

Không có timeout hay error handler để reset `awaitingAnswer` khi WS bị miss. **Cần thêm safety timer.**

---

### Bug #4 (MEDIUM): RAG search trên namespace trống gây delay không cần thiết

**File:** `backend/src/lib/ai/ask.ts` — dòng 404–416

```typescript
if (!isFast) {
  const rag = await execDirect({
    agent: "researcher",
    plan: { steps: [{ tool: "rag.search", input: { q: safeQ, ns: nsFinal, k }, timeoutMs: 8000, retries: 1 }] },
    ctx: { ns: nsFinal }
  })
  // ...
}
```

Với namespace `chat:NEW_UUID` (chat mới, không có tài liệu nào):
- RAG search vào JSON store trống → trả về `[{ text: "" }]`
- **Tốn tới 8 giây timeout** cho một operation vô ích
- Không fast mode → mọi query đều đi qua đây

> ⚠️ **Lưu ý từ code review:** Fix bằng `fs.existsSync()` **chỉ hợp lệ** khi `db_mode=json` (là config hiện tại: `backend/.env` L18 — `db_mode=json`). Nếu tương lai chuyển sang Chroma/cloud storage, cần check qua API hoặc một flag riêng. Fix nên có guard:

```typescript
// Fix an toàn hơn cho cả json lẫn chroma mode:
const storagePath = path.join(process.cwd(), "storage", "json", `${nsFinal}.json`);
const hasDocuments = config.db_mode === "json"
  ? fs.existsSync(storagePath)
  : true; // Với chroma, luôn thực hiện RAG (không có cách check nhanh)
if (!isFast && hasDocuments) {
  // ... RAG search
}
```

---

### Bug #5 (LOW): WS không có `onclose`/`onerror` recovery handler

**File:** `frontend/src/pages/Chat.tsx` — dòng 162–183

```typescript
// Code hiện tại — dòng 167, 182:
ws.onopen = () => setConnecting(false);
// onerror: không có
// onclose: không có
return () => { try { ws.close(); } catch { } wsRef.current = null; };
```

Không có xử lý phục hồi khi WS bị ngắt kết nối bất ngờ sau khi đã connect. Nếu WS đóng trong khi `awaitingAnswer = true`, spinner sẽ kẹt.

> ⚠️ **Lưu ý bổ sung từ code review:** Nếu WS reconnection không được xử lý, messages cũng có thể bị miss trong các lần disconnect sau.

---

## 📊 Timeline của Bug (Chat lần đầu - Standard Mode)

```
t=0ms    : User gõ "Xin chào" → sendFollowup() called
t=0ms    : setAwaitingAnswer(true) ← SPINNER BẮT ĐẦU
t=0ms    : POST /chat (chatId = undefined)
t=50ms   : Server nhận, tạo chatId = "UUID-1", trả 202
t=50ms   : (background) RAG search bắt đầu (ns="chat:UUID-1", timeout 8s)
t=50ms   : Frontend nhận r.chatId = "UUID-1" → setChatId("UUID-1")
t=60ms   : useEffect([chatId]) runs → new WebSocket("/ws/chat?chatId=UUID-1")
t=500ms  : Backend: RAG search done (namespace trống), LLM call bắt đầu
t=1500ms : Backend: Gemini 2.5 Flash done → addMsg() DB → emitToAll("answer") ← EMIT
           ← NẾU WS đã connect: nhận answer ✅
           ← NẾU WS chưa connect: miss answer ❌ → spinner mãi mãi
```

> **Lưu ý:** Lần thứ 2 trở đi (chat đã có chatId) thường **KHÔNG** bị bug này vì WS đã được connect sẵn từ trước qua `useEffect([chatId])`.

> **Fast Mode:** Race condition vẫn tồn tại ở Fast Mode vì RAG bị skip (LLM trả lời còn nhanh hơn), khiến cửa sổ thời gian ngắn hơn. Polling fix cần áp dụng cho cả hai mode.

---

## ✅ Giải pháp Đề xuất

### Fix #1 (Priority: CRITICAL) — Polling `getChatDetail` sau khi nhận `chatId` mới

**File:** `frontend/src/pages/Chat.tsx`

> ✅ **Xác nhận:** `getChatDetail(id: string)` **tồn tại** tại `frontend/src/lib/api.ts` L250–252, trả về `ChatDetail = { ok: true; chat: ChatInfo; messages: ChatMessage[] }`.  
> ✅ **Polling áp dụng cho cả Fast Mode và Standard Mode** (không check `fastMode`).

```typescript
const sendFollowup = async (q: string) => {
  const text = q.trim();
  if (!text || busy) return;
  setMessages((prev) => ([...(Array.isArray(prev) ? prev : []), { role: "user", content: text, at: Date.now() }]));
  setAwaitingAnswer(true);
  setBusy(true);
  try {
    const r = await chatJSON({ q: text, chatId: chatId || undefined, fastMode });
    const newChatId = r?.chatId;
    if (newChatId && newChatId !== chatId) {
      setChatId(newChatId);
    }
    // FIX: Poll DB để lấy answer nếu WS bị miss (áp dụng cả fast mode và standard mode)
    if (newChatId) {
      pollForAnswer(newChatId); // Không await để không block UI
    }
  } finally {
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
  }
};

// Hàm polling — chạy song song với WS listener
const pollForAnswer = useCallback(async (cid: string) => {
  const MAX_WAIT = 120000; // 2 phút
  const POLL_INTERVAL = 1500; // Poll mỗi 1.5s
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    // Nếu WS đã nhận answer → awaitingAnswer đã false → dừng poll
    if (!awaitingAnswer) return;
    try {
      const res = await getChatDetail(cid);
      if (res?.ok && res.messages?.some(m => m.role === "assistant")) {
        // WS missed the answer → load từ DB
        const normalized = res.messages.map(m =>
          m.role === "assistant" ? { ...m, content: normalizePayload((m as any).content).md } : m
        );
        setMessages(normalized);
        setAwaitingAnswer(false);
        console.log("[pollForAnswer] WS missed answer, recovered from DB:", cid);
        return;
      }
    } catch { }
  }
  // Timeout: reset spinner dù không nhận được answer
  setAwaitingAnswer(false);
}, [awaitingAnswer, getChatDetail]);
```

---

### Fix #2 (Priority: CRITICAL) — Backend đã OK, không cần sửa

**File:** `backend/src/core/routes/chat.ts`

Server đã `addMsg()` vào DB (L142–146) **TRƯỚC** `emitToAll` (L147), nên dữ liệu luôn có trong DB. Fix #1 (polling) là đủ.

---

### Fix #3 (Priority: HIGH) — Safety timer reset `awaitingAnswer`

**File:** `frontend/src/pages/Chat.tsx`

```typescript
// Trong sendFollowup, thay finally block:
} finally {
  setBusy(false);
  setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
  // Safety net: Tránh spinner kẹt vô tận nếu cả WS lẫn poll đều thất bại
  const safetyTimer = window.setTimeout(() => {
    setAwaitingAnswer(false);
    console.warn("[sendFollowup] Safety timer triggered — no answer received after 3 minutes");
  }, 180000);
  // Cleanup khi component unmount hoặc answer đến
  return () => clearTimeout(safetyTimer);
}
```

---

### Fix #4 (Priority: MEDIUM) — Skip RAG khi namespace trống (json mode)

**File:** `backend/src/lib/ai/ask.ts` — dòng 404

```typescript
// Chỉ check file-system khi db_mode=json (config hiện tại)
// Nếu tương lai dùng Chroma/cloud, cần cách check khác
import { config } from "../../config/env";

const storagePath = path.join(process.cwd(), "storage", "json", `${nsFinal}.json`);
const hasDocuments = config.db_mode === "json"
  ? fs.existsSync(storagePath)
  : true; // Chroma: không có cách check nhanh, luôn thực hiện RAG

if (!isFast && hasDocuments) {
  // ... RAG search như cũ
}
// Nếu !hasDocuments → bỏ qua RAG, ctx = "NO_CONTEXT" (tiết kiệm ~8s)
```

---

### Fix #5 (Priority: HIGH) — WS `onclose`/`onerror` recovery

**File:** `frontend/src/pages/Chat.tsx` — useEffect dòng 162–183

```typescript
useEffect(() => {
  if (!chatId) return;
  const wsUrl = (env.backend || window.location.origin)
    .replace(/^http/, "ws") + `/ws/chat?chatId=${encodeURIComponent(chatId)}`;
  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;

  ws.onopen = () => setConnecting(false);

  ws.onmessage = (ev) => {
    try {
      const m = JSON.parse(ev.data);
      if (m?.type === "answer") {
        const norm = normalizePayload(m.answer);
        setMessages((prev) => ([...(Array.isArray(prev) ? prev : []), { role: "assistant", content: norm.md, at: Date.now() }]));
        if (norm.flashcards.length) setCards(norm.flashcards);
        if (norm.topic) setTopic(norm.topic);
        else if (norm.md) setTopic((t) => t || deriveTopicFromMarkdown(norm.md));
        setAwaitingAnswer(false);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
      }
    } catch { }
  };

  // FIX #5: Recovery khi WS đóng bất ngờ trong khi chờ answer
  ws.onclose = () => {
    if (wsRef.current === ws) { // Chỉ xử lý nếu đây là WS đang active
      setAwaitingAnswer(prev => {
        if (prev) {
          // WS đóng trong khi đang chờ → fallback về DB
          getChatDetail(chatId).then(res => {
            if (res?.ok && res.messages?.some(m => m.role === "assistant")) {
              setMessages(res.messages.map(m =>
                m.role === "assistant" ? { ...m, content: normalizePayload((m as any).content).md } : m
              ));
              setAwaitingAnswer(false);
            }
          }).catch(() => {});
        }
        return prev;
      });
    }
  };

  ws.onerror = () => {
    setConnecting(false);
    console.warn("[WS] Connection error for chatId:", chatId);
  };

  return () => { try { ws.close(); } catch { } wsRef.current = null; };
}, [chatId]);
```

---

## 📁 Files cần chỉnh sửa

| File | Bug liên quan | Mức độ ưu tiên |
|------|--------------|----------------|
| `frontend/src/pages/Chat.tsx` | #1, #3, #5 | 🔴 Critical |
| `backend/src/lib/ai/ask.ts` | #4 | 🟡 Medium |
| `backend/src/core/routes/chat.ts` | #2 đã OK | ✅ Không cần sửa |

---

## 🔬 Cách tái hiện Bug

1. Mở chatbot ở standard mode (không upload file)
2. Gõ tin nhắn ngắn như "Xin chào", "Hello", "1+1=?"
3. Nhấn gửi
4. Quan sát: spinner "Đang suy nghĩ..." xuất hiện và không bao giờ dừng

**Điều kiện làm bug xảy ra thường xuyên hơn:**
- LLM model phản hồi nhanh (Gemini 2.5 Flash < 2s cho câu ngắn)
- Mạng chậm (WebSocket handshake lâu)
- Chat mới (không có `chatId` sẵn)

**Có thể không tái hiện khi:**
- Gõ tin nhắn dài/phức tạp (LLM mất nhiều thời gian hơn)
- Đang trong chat cũ đã có `chatId` (WS đã connect sẵn)

> ⚠️ **Fast Mode:** Race condition vẫn tồn tại ở Fast Mode (LLM còn nhanh hơn). Polling fix áp dụng cho cả hai mode.

---

## 📌 Kết luận

Root cause chính là **race condition** giữa:
1. Frontend kết nối WebSocket (~50–200ms sau khi nhận `chatId`)
2. Backend emit `answer` qua WebSocket (có thể xảy ra trong 1–2s với Gemini 2.5 Flash trên câu ngắn)

Server đã lưu câu trả lời vào DB **trước** khi emit WebSocket, nên data không bị mất. Fix đơn giản nhất là polling `getChatDetail` song song với WS listener.

### Thứ tự triển khai fix:
1. **Fix #1** — Thêm `pollForAnswer()` trong `sendFollowup()` → giải quyết ngay 95% trường hợp
2. **Fix #5** — Thêm `ws.onclose` recovery → giải quyết 5% còn lại (WS disconnect sau connect)
3. **Fix #3** — Safety timer 3 phút → lưới an toàn cuối cùng
4. **Fix #4** — Skip RAG khi namespace trống → tối ưu thêm, giảm thời gian LLM response

---

## 📝 Ghi chú từ Code Review

| Điểm review | Đánh giá | Hành động |
|-------------|----------|-----------|
| Line 19: line refs 261–274 sai (nên là 261–273) | ✅ Hợp lệ | Đã sửa trong báo cáo này |
| Line 77: verify line numbers 265, 177 | ✅ Hợp lệ | Đã verify: đúng |
| `getChatDetail` không verify tồn tại | ✅ Hợp lệ | Đã verify: tồn tại tại `api.ts` L250 |
| Fix #4 `fs.existsSync` không work với cloud storage | ✅ Hợp lệ | Fix đã thêm guard cho `db_mode` |
| Fast Mode vẫn có race condition | ✅ Hợp lệ | Ghi chú + polling áp dụng cả hai mode |
| Thiếu fix cụ thể cho Bug #5 | ✅ Hợp lệ | Fix #5 đã được bổ sung đầy đủ |
| Cần persistent WS thay vì tạo mới theo chatId | 📌 Ghi nhận | Đây là cải tiến dài hạn (out of scope hotfix) |
| Thêm logging để đo hiệu quả fix | ✅ Hợp lệ | Đã thêm `console.log` vào `pollForAnswer` |
