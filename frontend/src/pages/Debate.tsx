import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../lib/LanguageContext";
import { env } from "../config/env";

type DebateMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

type DebateSession = {
    id: string;
    topic: string;
    position: "for" | "against";
    messages: DebateMessage[];
    createdAt: number;
    status?: "active" | "user_surrendered" | "ai_conceded" | "completed";
    winner?: "user" | "ai" | "draw";
};

type DebateAnalysis = {
    winner: "user" | "ai" | "draw";
    reason: string;
    userStrengths: string[];
    aiStrengths: string[];
    userWeaknesses: string[];
    aiWeaknesses: string[];
    keyMoments: string[];
    overallAssessment: string;
};

export default function Debate() {
    const { t } = useLanguage();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [topic, setTopic] = useState("");
    const [position, setPosition] = useState<"for" | "against">("for");
    const [debateId, setDebateId] = useState<string | null>(
        searchParams.get("debateId")
    );
    const [session, setSession] = useState<DebateSession | null>(null);
    const [messages, setMessages] = useState<DebateMessage[]>([]);
    const [argument, setArgument] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isDebateEnded, setIsDebateEnded] = useState(false);
    const [analysis, setAnalysis] = useState<DebateAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const analysisWsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [analysisPhase, setAnalysisPhase] = useState<string>("");

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent]);

    const fetchAnalysis = useCallback(async () => {
        if (!debateId) return;

        setIsAnalyzing(true);
        setAnalysisPhase(t.debate.analyzing || "Analyzing debate...");

        const wsUrl = env.backend.replace(/^http/, "ws") + `/ws/debate/analyze?debateId=${debateId}`;
        const analysisWs = new WebSocket(wsUrl);

        analysisWs.onopen = () => console.log("Analysis WebSocket connected");
        analysisWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case "ready": break;
                case "phase": setAnalysisPhase(data.value); break;
                case "complete":
                    setAnalysis(data.analysis);
                    setSession(data.session);
                    setIsAnalyzing(false);
                    setAnalysisPhase("");
                    analysisWs.close();
                    break;
                case "error":
                    setError(data.error);
                    setIsAnalyzing(false);
                    setAnalysisPhase("");
                    analysisWs.close();
                    break;
            }
        };
        analysisWs.onerror = () => {
            setError("Analysis connection error");
            setIsAnalyzing(false);
            setAnalysisPhase("");
        };
        analysisWsRef.current = analysisWs;

        try {
            const response = await fetch(`${env.backend}/debate/${debateId}/analyze`, { method: "POST" });
            const data = await response.json();
            if (!data.ok && data.error) {
                setError(data.error);
                setIsAnalyzing(false);
                setAnalysisPhase("");
                analysisWs.close();
            }
        } catch (err) {
            setError((err as Error).message);
            setIsAnalyzing(false);
        }
    }, [debateId, t.debate.analyzing]);

    const connectWebSocket = useCallback((id: string) => {
        const wsUrl = env.backend.replace(/^http/, "ws") + `/ws/debate?debateId=${id}`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case "user_argument":
                    setMessages((prev) => [...prev, { role: "user", content: data.content, timestamp: Date.now() }]);
                    break;
                case "ai_thinking":
                    setIsStreaming(true);
                    setStreamingContent("");
                    break;
                case "ai_token":
                    setStreamingContent((prev) => prev + data.token);
                    break;
                case "ai_complete":
                    setMessages((prev) => [...prev, { role: "assistant", content: data.content, timestamp: Date.now() }]);
                    setIsStreaming(false);
                    setStreamingContent("");
                    break;
                case "ai_concede":
                    setMessages((prev) => [...prev, { role: "assistant", content: `I must concede this debate. ${data.reason}`, timestamp: Date.now() }]);
                    setIsStreaming(false);
                    setIsDebateEnded(true);
                    setTimeout(() => fetchAnalysis(), 1000);
                    break;
                case "error":
                    setError(data.error);
                    setIsStreaming(false);
                    break;
            }
        };
        ws.onerror = () => setError("Connection error");
        wsRef.current = ws;
    }, [fetchAnalysis]);

    const fetchDebateSession = useCallback(async (id: string) => {
        try {
            const response = await fetch(`${env.backend}/debate/${id}`);
            const data = await response.json();
            if (data.ok) {
                setSession(data.session);
                setMessages(data.session.messages);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    }, []);

    useEffect(() => {
        if (debateId) {
            fetchDebateSession(debateId);
            connectWebSocket(debateId);
        }
        return () => {
            wsRef.current?.close();
            analysisWsRef.current?.close();
        };
    }, [debateId, connectWebSocket, fetchDebateSession]);

    const startDebate = async () => {
        if (!topic.trim()) return;
        try {
            const response = await fetch(`${env.backend}/debate/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: topic.trim(), position }),
            });
            const data = await response.json();
            if (data.ok) {
                setDebateId(data.debateId);
                setSession(data.session);
                setMessages([]);
                navigate(`/debate?debateId=${data.debateId}`);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const submitArgument = async () => {
        if (!argument.trim() || !debateId || isStreaming) return;
        const arg = argument.trim();
        setArgument("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        try {
            const response = await fetch(`${env.backend}/debate/${debateId}/argue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ argument: arg }),
            });
            const data = await response.json();
            if (!data.ok) setError(data.error);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleSurrender = async () => {
        if (!debateId || isDebateEnded) return;
        if (!confirm(t.debate.surrenderConfirm)) return;
        try {
            const response = await fetch(`${env.backend}/debate/${debateId}/surrender`, { method: "POST" });
            const data = await response.json();
            if (data.ok) {
                setIsDebateEnded(true);
                fetchAnalysis();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    if (!debateId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 lg:pl-28 lg:pr-4 bg-black">
                <div className="max-w-2xl w-full space-y-8">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl lg:text-5xl font-bold text-white">{t.debate.startTitle}</h1>
                        <p className="text-lg text-stone-400">{t.debate.startSubtitle}</p>
                    </div>
                    <div className="bg-stone-950/90 backdrop-blur-sm border border-stone-900 rounded-2xl p-8 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-2">{t.debate.topicLabel}</label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder={t.debate.topicPlaceholder}
                                className="w-full px-4 py-3 bg-stone-900/70 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                onKeyDown={(e) => e.key === "Enter" && startDebate()}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-3">{t.debate.positionLabel}</label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setPosition("for")}
                                    className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${position === "for" ? "bg-green-600 text-white" : "bg-stone-900/70 text-stone-400"}`}
                                >
                                    <div className="text-2xl mb-1">👍</div>
                                    <div>{t.debate.positionFor}</div>
                                    <div className="text-xs mt-1 opacity-80">{t.debate.forDesc}</div>
                                </button>
                                <button
                                    onClick={() => setPosition("against")}
                                    className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${position === "against" ? "bg-red-600 text-white" : "bg-stone-900/70 text-stone-400"}`}
                                >
                                    <div className="text-2xl mb-1">👎</div>
                                    <div>{t.debate.positionAgainst}</div>
                                    <div className="text-xs mt-1 opacity-80">{t.debate.againstDesc}</div>
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={startDebate}
                            disabled={!topic.trim()}
                            className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg"
                        >
                            {t.debate.begin}
                        </button>
                    </div>
                    {error && <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full lg:pl-28 bg-black">
            <div className="flex-shrink-0 border-b border-zinc-900 bg-stone-950/90 backdrop-blur-sm px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white mb-1">{session?.topic || "Debate"}</h1>
                        <div className="flex items-center gap-3 text-sm">
                            <span className={`px-3 py-1 rounded-full font-semibold ${session?.position === "for" ? "bg-green-600/20 text-green-400 border border-green-600/30" : "bg-red-600/20 text-red-400 border border-red-600/30"}`}>
                                {t.sidebar.cards}: {session?.position === "for" ? t.debate.positionFor : t.debate.positionAgainst}
                            </span>
                            <span className="text-stone-500">vs</span>
                            <span className="px-3 py-1 rounded-full font-semibold bg-purple-600/20 text-purple-400 border border-purple-600/30">
                                AI: {session?.position === "for" ? t.debate.positionAgainst : t.debate.positionFor}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => { setDebateId(null); setSession(null); setMessages([]); navigate("/debate"); }}
                        className="px-4 py-2 bg-stone-900/70 border border-zinc-800 text-stone-300 rounded-lg hover:bg-stone-800"
                    >
                        {t.debate.newDebate}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scroll">
                {messages.length === 0 && !isStreaming && (
                    <div className="flex items-center justify-center h-full text-center space-y-4 max-w-md mx-auto">
                        <div className="text-6xl">⚖️</div>
                        <h2 className="text-2xl font-bold text-white">{t.debate.ready}</h2>
                        <p className="text-stone-400">{t.debate.readyDesc}</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-3xl flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-2">
                                {msg.role === "assistant" && <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">AI</div>}
                                <span className="text-sm font-semibold text-stone-400">{msg.role === "user" ? t.common.back : t.debate.title} Opponent</span>
                                {msg.role === "user" && <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${session?.position === "for" ? "bg-green-600" : "bg-red-600"}`}>U</div>}
                            </div>
                            <div className={`px-6 py-4 rounded-2xl shadow-lg text-white ${msg.role === "user" ? (session?.position === "for" ? "bg-green-600" : "bg-red-600") : "bg-stone-900 border border-zinc-800"}`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {isStreaming && (
                    <div className="flex justify-start">
                        <div className="max-w-3xl items-start flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">AI</div>
                                <span className="text-sm font-semibold text-stone-400">AI Opponent</span>
                            </div>
                            <div className="px-6 py-4 rounded-2xl bg-stone-900 border border-zinc-800 text-white">
                                <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}<span className="inline-block w-2 h-5 bg-purple-500 ml-1 animate-pulse" /></p>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 border-t border-zinc-900 bg-stone-950/90 p-4">
                <div className="max-w-4xl mx-auto space-y-3">
                    <div className="flex gap-3">
                        <textarea
                            ref={textareaRef}
                            value={argument}
                            onChange={(e) => {
                                setArgument(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitArgument(); } }}
                            placeholder={isDebateEnded ? t.debate.ended : (isStreaming ? t.debate.waitingAi : t.debate.arguePlaceholder)}
                            disabled={isStreaming || isDebateEnded}
                            className="flex-1 px-4 py-3 bg-stone-900 border border-zinc-800 rounded-xl text-white outline-none resize-none disabled:opacity-50"
                            rows={1}
                            style={{ minHeight: "50px", maxHeight: "200px" }}
                        />
                        <button
                            onClick={submitArgument}
                            disabled={!argument.trim() || isStreaming || isDebateEnded}
                            className={`px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-50 ${session?.position === "for" ? "bg-green-600" : "bg-red-600"}`}
                        >
                            {isStreaming ? t.common.pleaseWait : t.debate.argue}
                        </button>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={handleSurrender}
                            disabled={isStreaming || messages.length === 0 || isDebateEnded}
                            className="px-4 py-2 bg-orange-600/20 border border-orange-600/40 text-orange-400 rounded-lg hover:bg-orange-600/30 disabled:opacity-50 text-sm font-semibold"
                        >
                            🏳️ {t.debate.surrender}
                        </button>
                    </div>
                </div>
            </div>

            {(isDebateEnded && analysis) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-stone-950 border border-zinc-900 rounded-2xl max-w-4xl w-full p-8 space-y-6">
                        <div className="text-center space-y-4">
                            <div className="text-6xl">{analysis.winner === "user" ? "🏆" : analysis.winner === "ai" ? "🤖" : "🤝"}</div>
                            <h2 className="text-3xl font-bold text-white">{analysis.winner === "user" ? t.debate.winner.user : (analysis.winner === "ai" ? t.debate.winner.ai : t.debate.winner.draw)}</h2>
                            <p className="text-lg text-stone-400">{analysis.reason}</p>
                        </div>
                        <div className="bg-stone-900 border border-zinc-800 rounded-xl p-6">
                            <h3 className="text-xl font-bold text-white mb-3">📊 {t.debate.assessment}</h3>
                            <p className="text-stone-300 leading-relaxed">{analysis.overallAssessment}</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-5">
                                <h3 className="text-lg font-bold text-green-400 mb-3">💪 {t.debate.strengths}</h3>
                                <ul className="space-y-2">{analysis.userStrengths.map((s, i) => <li key={i} className="text-stone-300 text-sm flex gap-2">✓ {s}</li>)}</ul>
                            </div>
                            <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-5">
                                <h3 className="text-lg font-bold text-red-400 mb-3">📉 {t.debate.weaknesses}</h3>
                                <ul className="space-y-2">{analysis.userWeaknesses.map((w, i) => <li key={i} className="text-stone-300 text-sm flex gap-2">✗ {w}</li>)}</ul>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => { setDebateId(null); setSession(null); setMessages([]); setIsDebateEnded(false); setAnalysis(null); navigate("/debate"); }} className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-xl">{t.debate.newDebate}</button>
                            <button onClick={() => { setIsDebateEnded(false); setAnalysis(null); }} className="px-6 py-3 bg-stone-900 text-stone-300 rounded-xl shadow-lg">{t.debate.reviewDebate}</button>
                        </div>
                    </div>
                </div>
            )}

            {isAnalyzing && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-white font-semibold">{t.debate.analyzing}</p>
                        {analysisPhase && <p className="text-sky-400 text-sm animate-pulse">{analysisPhase}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
