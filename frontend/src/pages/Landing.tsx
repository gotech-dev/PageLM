import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PromptRail from "../components/Landing/PromptRail";
import PromptBox from "../components/Landing/PromptBox";
import ExploreTopics from "../components/Landing/ExploreTopics";
import { chatMultipart, chatJSON } from "../lib/api";
import { useLanguage } from "../lib/LanguageContext";

export default function Landing() {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"Chat" | "Quiz">("Chat");
  const [responseLength, setResponseLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [fastMode, setFastMode] = useState(false);
  const [showFast, setShowFast] = useState(false);
  const [showMode, setShowMode] = useState(false);
  const [showLength, setShowLength] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const onPickFile = () => fileRef.current?.click();
  const onRemoveFile = () => setStagedFile(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setStagedFile(f);
  };
  const onDropZoneDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    setStagedFile(f);
  };

  const onSend = async (override?: string) => {
    if (busy) return;
    const q = (override ?? prompt).trim();
    if (!q && !stagedFile) return;

    if (mode === "Quiz") {
      navigate(`/quiz?topic=${encodeURIComponent(q)}`, { state: { topic: q } });
      return;
    }

    setBusy(true);
    try {
      if (stagedFile) {
        const { chatId } = await chatMultipart(q || " ", [stagedFile], undefined, fastMode);
        navigate(`/chat?chatId=${encodeURIComponent(chatId)}&q=${encodeURIComponent(q)}&fastMode=${fastMode}`);
        return;
      }
      const r = await chatJSON({ q, fastMode });
      navigate(`/chat?chatId=${encodeURIComponent(r.chatId)}&q=${encodeURIComponent(q)}&fastMode=${fastMode}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full px-4 lg:pl-28 lg:pr-4">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto my-20 md:my-4 w-full px-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl text-white font-semibold pl-3 border-l-2 border-sky-500 mb-8">
          {t.landing.title}
        </h1>

        <PromptBox
          value={prompt}
          onChange={setPrompt}
          onSend={() => onSend()}
          onPickFile={onPickFile}
          onRemoveFile={onRemoveFile}
          stagedFileName={stagedFile?.name || null}
          busy={busy}
          onDragOver={onDropZoneDragOver}
          onDrop={onDropZoneDrop}
        />

        <div className="flex flex-col w-full bg-stone-950 border border-stone-900 border-t-0 rounded-b-3xl shadow-xl">
          <div className="flex items-center p-0.5 overflow-x-auto md:overflow-visible no-scrollbar md:border-b border-stone-900 shrink-0">
            <div className="relative flex-1 md:flex-1 shrink-0">
              <div
                onClick={() => setShowMode(!showMode)}
                className="flex items-center justify-between md:justify-center space-x-3 p-3 rounded-xl hover:bg-white/5 duration-300 transition-all cursor-pointer"
              >
                <div className="flex flex-col -space-y-0.5 min-w-fit">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{t.landing.promptMode}</span>
                  <span className="text-sm font-semibold text-white">{mode === "Chat" ? t.landing.chatMode : t.landing.quizMode}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-3 text-stone-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {showMode && (
                <div className="absolute top-full left-0 mt-1 p-1 w-full bg-stone-950 border border-stone-800 rounded-xl shadow-2xl z-20">
                  {["Chat", "Quiz"].map((opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setMode(opt as "Chat" | "Quiz");
                        setShowMode(false);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-stone-800 transition rounded-lg ${mode === opt ? "text-sky-400" : "text-white"
                        }`}
                    >
                      {opt === "Chat" ? t.landing.chatMode : t.landing.quizMode}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-stone-900 shrink-0" />

            <div className="relative flex-1 md:flex-1 shrink-0">
              <div
                onClick={() => setShowLength(!showLength)}
                className="flex items-center justify-between md:justify-center space-x-3 p-3 rounded-xl hover:bg-white/5 duration-300 transition-all cursor-pointer">
                <div className="flex flex-col -space-y-0.5 min-w-fit">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{t.landing.responseLength}</span>
                  <span className="text-sm font-semibold text-white">
                    {responseLength === "Short" ? t.landing.lengths.short : responseLength === "Medium" ? t.landing.lengths.medium : t.landing.lengths.long}
                  </span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-3 text-stone-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {showLength && (
                <div className="absolute top-full left-0 mt-1 p-1 w-full bg-stone-950 border border-stone-800 rounded-xl shadow-2xl z-20">
                  {(["Short", "Medium", "Long"] as const).map((opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setResponseLength(opt);
                        setShowLength(false);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-stone-800 transition rounded-lg ${responseLength === opt ? "text-sky-400" : "text-white"
                        }`}
                    >
                      {opt === "Short" ? t.landing.lengths.short : opt === "Medium" ? t.landing.lengths.medium : opt === "Long" ? t.landing.lengths.long : opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-stone-900 shrink-0" />

            <div className="relative flex-1 md:flex-1 shrink-0">
              <div
                onClick={() => setShowFast(!showFast)}
                className="flex items-center justify-between md:justify-center space-x-3 p-3 rounded-xl hover:bg-white/5 duration-300 transition-all cursor-pointer">
                <div className="flex flex-col -space-y-0.5 min-w-fit">
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{t.landing.fastMode}</span>
                  <span className="text-sm font-semibold text-white">{fastMode ? t.landing.fastModeFast : t.landing.fastModeStandard}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-3 text-stone-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {showFast && (
                <div className="absolute top-full left-0 mt-1 p-1 w-full bg-stone-950 border border-stone-800 rounded-xl shadow-2xl z-20">
                  {[
                    { label: t.landing.fastModeStandard, value: false },
                    { label: t.landing.fastModeFast, value: true }
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      onClick={() => {
                        setFastMode(opt.value);
                        setShowFast(false);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-stone-800 transition rounded-lg ${fastMode === opt.value ? "text-sky-400" : "text-white"
                        }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 bg-stone-900/10 border-t border-stone-900/50 md:border-t-0 rounded-b-3xl overflow-hidden">
            <PromptRail onSend={(p) => onSend(p)} />
          </div>
        </div>
      </div>

      <ExploreTopics />

      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
    </div>
  );
}