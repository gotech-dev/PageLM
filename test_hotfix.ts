
import { handleAsk } from "./backend/src/lib/ai/ask";
import { config } from "./backend/src/config/env";

async function testChat() {
    console.log("--- START TEST: CHAT LOGIC ---");
    console.log("LLM Provider:", config.provider);
    console.log("Gemini Model:", config.gemini_model);

    const q = "Xin chào, bạn là ai?";
    const ns = `test-chat-${Date.now()}`;

    console.log(`\nTesting with NEW namespace: ${ns}`);
    console.log("Check logs for: '[handleAsk] Skipping RAG search'");

    const start = Date.now();
    try {
        const result = await handleAsk({
            q,
            namespace: ns,
            fastMode: false
        });
        const end = Date.now();

        console.log("\n--- RESULT ---");
        console.log("Status: OK");
        console.log("Topic:", result.topic);
        console.log("Answer Context Length:", result.answer.length);
        console.log("Answer (preview):", result.answer.slice(0, 100) + "...");
        console.log("Time Taken:", (end - start), "ms");

        if ((end - start) < 8000) {
            console.log("✅ SUCCESS: Latency is low (RAG was skipped).");
        } else {
            console.log("⚠️ WARNING: Latency is still high. Check if RAG search is 8s.");
        }
    } catch (err: any) {
        console.error("❌ FAILED with error:", err.message);
    }
}

testChat().catch(console.error);
