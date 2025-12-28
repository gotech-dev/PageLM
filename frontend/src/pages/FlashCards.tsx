import { useEffect, useState, useRef } from "react";
import { deleteFlashcard, listFlashcards, generateFlashcardsFromTopics, type SavedFlashcard } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import MarkdownView from "../components/Chat/MarkdownView";

export default function FlashCards() {
  const [items, setItems] = useState<SavedFlashcard[]>([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set()); // Track which cards are flipped
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasTriggeredGenerate = useRef(false);

  // ========== BGTT Integration ==========
  const topicsFromBGTT = searchParams.get("topics") || "";
  const sourceFromBGTT = searchParams.get("source") || "";
  const examNameFromBGTT = searchParams.get("exam_name") || ""; // Tên môn học
  const wrongQuestionsRaw = searchParams.get("wrong_questions") || ""; // Câu hỏi sai

  const isFromExam = sourceFromBGTT === "exam";
  const bgttTopics = topicsFromBGTT ? topicsFromBGTT.split(",").map(t => t.trim()) : [];
  const wrongQuestions = wrongQuestionsRaw ? wrongQuestionsRaw.split("|||").filter(q => q.trim()) : [];
  // ========================================

  const load = async () => {
    try {
      const { flashcards } = await listFlashcards();
      setItems((flashcards || []).sort((a, b) => b.created - a.created));
    } catch { }
  };

  // Auto-generate flashcards when coming from BGTT exam
  useEffect(() => {
    const autoGenerate = async () => {
      // Only trigger once and if we have valid topics from exam
      if (!isFromExam || bgttTopics.length === 0 || hasTriggeredGenerate.current) {
        return;
      }

      hasTriggeredGenerate.current = true;
      setGenerating(true);
      setGenerationProgress(`Đang tạo flashcards cho ${bgttTopics.length} chủ đề ${examNameFromBGTT ? `(${examNameFromBGTT})` : ''}...`);

      try {
        const result = await generateFlashcardsFromTopics(bgttTopics, {
          examName: examNameFromBGTT,
          wrongQuestions: wrongQuestions
        });

        if (result.ok && result.flashcards) {
          setGenerationProgress(`✅ Đã tạo ${result.flashcards.length} flashcards!`);
          // Reload to show new flashcards
          await load();
        } else {
          setGenerationProgress(`❌ Lỗi: ${result.error || 'Không thể tạo flashcards'}`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Không thể tạo flashcards';
        console.error('[FlashCards] Auto-generate error:', err);

        // Nếu timeout, vẫn thử reload vì backend có thể đã tạo xong
        if (errMsg.includes('timeout') || errMsg.includes('Failed to fetch')) {
          setGenerationProgress('⏳ Đang tải flashcards đã tạo...');
          await load();
          setGenerationProgress('✅ Đã tải xong! Kiểm tra flashcards bên dưới.');
        } else {
          setGenerationProgress(`❌ Lỗi: ${errMsg}`);
        }
      } finally {
        setGenerating(false);
        // Reload lại lần nữa sau 2s để chắc chắn
        setTimeout(async () => {
          await load();
          navigate('/flashcards', { replace: true });
        }, 2000);
      }
    };

    load();
    autoGenerate();
  }, [isFromExam, bgttTopics.length]);

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteFlashcard(id);
    } catch { }
    await load();
    setBusy(false);
  };

  const clearAll = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      await Promise.all(items.map((i) => deleteFlashcard(i.id).catch(() => { })));
    } catch { }
    await load();
    setBusy(false);
  };

  return (
    <div className="min-h-screen w-full px-4 lg:pl-28 lg:pr-4">
      <div className="max-w-6xl mx-auto pt-6 pb-14 px-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-stone-950 border border-zinc-800 hover:bg-stone-900"
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" className="size-5 text-stone-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold text-white">My Learning Bag</h1>
          </div>
          <button
            onClick={clearAll}
            disabled={busy || !items.length}
            className="px-4 py-2 rounded-2xl bg-red-900/20 border border-red-800 text-red-300 hover:bg-red-900/30 disabled:opacity-50"
          >
            Clear All
          </button>
        </div>

        {/* Generating Progress Banner */}
        {(generating || generationProgress) && (
          <div className={`mb-6 p-6 rounded-2xl border ${generating
            ? 'bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30'
            : generationProgress.startsWith('✅')
              ? 'bg-green-900/30 border-green-500/30'
              : 'bg-red-900/30 border-red-500/30'
            }`}>
            <div className="flex items-center gap-4">
              {generating && (
                <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              )}
              <div>
                <p className="text-white font-medium">{generationProgress}</p>
                {generating && bgttTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {bgttTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Flashcards Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((it) => {
            const isExpanded = expandedCards.has(it.id);

            const toggleCard = () => {
              setExpandedCards(prev => {
                const newSet = new Set(prev);
                if (newSet.has(it.id)) {
                  newSet.delete(it.id);
                } else {
                  newSet.add(it.id);
                }
                return newSet;
              });
            };

            return (
              <div key={it.id} className="rounded-2xl bg-stone-950 border border-zinc-800 overflow-hidden">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 p-4 pb-2">
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    {it.tag === "note" ? "note" : "flashcard"}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(it.id); }}
                    disabled={busy}
                    className="p-2 rounded-lg bg-stone-950 border border-zinc-800 hover:bg-stone-900 disabled:opacity-50"
                    aria-label="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-stone-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.75 9.75a.75.75 0 0 1 .75.75v6a.75.75 0 1 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm3.75.75a.75.75 0 0 0-1.5 0v6a.75.75 0 1 0 1.5 0v-6Z" />
                      <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h4.443A2.25 2.25 0 0 1 10.315 4.5h2.37A2.25 2.25 0 0 1 14.807 6H19.5a.75.75 0 0 1 0 1.5h-.708l-1.03 12.06A2.25 2.25 0 0 1 15.52 21H8.48a2.25 2.25 0 0 1-2.242-2.44L5.208 7.5H4.5A.75.75 0 0 1 3.75 6.75ZM9.75 6a.75.75 0 0 1 .671-.75h2.37a.75.75 0 0 1 .671.75H9.75Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Clickable Card Body */}
                <div
                  onClick={toggleCard}
                  className="px-4 pb-4 cursor-pointer hover:bg-stone-900/50 transition-colors"
                >
                  {/* Question */}
                  <div className="text-white font-medium mb-3">
                    <MarkdownView md={it.question} />
                  </div>

                  {/* Answer - shown when expanded */}
                  {isExpanded ? (
                    <div className="pt-3 border-t border-zinc-800">
                      <div className="text-xs uppercase tracking-wide text-green-400 mb-2">Trả lời</div>
                      <div className="text-stone-300">
                        <MarkdownView md={it.answer} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-stone-500 text-sm py-2">
                      👆 Click để xem đáp án
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {!items.length && !generating && (
          <div className="mt-16 text-center text-stone-400">
            {isFromExam
              ? "Đang chuẩn bị flashcards cho bạn..."
              : "Your bag is empty. Add flashcards or notes from the chat."
            }
          </div>
        )}
      </div>
    </div>
  );
}