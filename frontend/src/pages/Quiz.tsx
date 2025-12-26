import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { quizStart, connectQuizStream, QuizEvent, err as getErr } from "../lib/api";
import LoadingIndicator from "../components/Chat/LoadingIndicator";
import { useLanguage } from "../lib/LanguageContext";

export type Question = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  hint: string;
  imageHtml?: string;
};

export type UA = {
  questionId: number;
  selectedAnswer: number;
  correct: boolean;
  question: string;
  selectedOption: string;
  correctOption: string;
  explanation: string;
};

export default function Quiz() {
  const { t } = useLanguage();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation() as any;

  const passedTopic = (location?.state && location.state.topic) || "";
  const initialTopic = search.get("topic") || passedTopic || "";

  const [topic, setTopic] = useState(initialTopic);
  const [qs, setQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<UA[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [connecting, setConnecting] = useState(false);

  const closeRef = useRef<null | (() => void)>(null);

  const total = qs.length;
  const q = qs[idx];

  const percentage = useMemo(() => (total ? Math.round((score / total) * 100) : 0), [score, total]);
  const resultVisual = useMemo(() => {
    if (percentage >= 90) return { msg: t.quiz.mastered, cls: "bg-green-900/20 border border-green-700 text-green-200", icon: "🏆" };
    if (percentage >= 70) return { msg: t.quiz.goodJob, cls: "bg-blue-900/20 border border-blue-700 text-blue-200", icon: "🎉" };
    if (percentage >= 50) return { msg: t.quiz.goodEffort, cls: "bg-yellow-900/20 border border-yellow-700 text-yellow-200", icon: "📚" };
    return { msg: t.quiz.keepStudying, cls: "bg-red-900/20 border border-red-700 text-red-200", icon: "💪" };
  }, [percentage, t]);

  useEffect(() => () => { if (closeRef.current) closeRef.current(); }, []);
  useEffect(() => { if (!initialTopic) return; start(initialTopic); }, [initialTopic]);

  function resetQuestionState() {
    setIdx(0);
    setSelected(null);
    setShowHint(false);
    setShowExp(false);
  }

  async function start(t: string) {
    const trimmed = t.trim();
    if (!trimmed) return;
    if (closeRef.current) closeRef.current();

    setQs([]);
    resetQuestionState();
    setScore(0);
    setDone(false);
    setAnswers([]);
    setConnecting(true);

    try {
      const s = await quizStart(trimmed);
      const { close } = connectQuizStream(s.quizId, (ev: QuizEvent) => {
        if (ev.type === "quiz") {
          const arr = takeQuizArray(ev.quiz).map(q => ({
            ...q,
            correct: typeof q.correct === "number" ? Math.max(0, q.correct - 1) : 0
          }));
          setQs(arr);
          resetQuestionState();
          setConnecting(false);
        }
        if (ev.type === "done" || ev.type === "error") {
          setConnecting(false);
        }
      });
      closeRef.current = close;

      if (search.get("topic") !== trimmed) {
        navigate(`/quiz?topic=${encodeURIComponent(trimmed)}`, {
          replace: true,
          state: { topic: trimmed },
        });
      }
    } catch {
      setConnecting(false);
    }
  }

  const onSelect = (i: number) => { if (!showExp) setSelected(i); };

  const onNext = () => {
    if (selected == null || !q) return;
    const correct = selected === q.correct;
    const ua: UA = {
      questionId: idx,
      selectedAnswer: selected,
      correct,
      question: q.question,
      selectedOption: q.options[selected],
      correctOption: q.options[q.correct],
      explanation: q.explanation,
    };
    setAnswers(a => [...a, ua]);
    setShowExp(true);
    if (correct) setScore(s => s + 1);
    setTimeout(() => {
      if (idx === total - 1) setDone(true);
      else {
        setIdx(n => n + 1);
        setSelected(null);
        setShowHint(false);
        setShowExp(false);
      }
    }, 350);
  };

  const newTopic = () => { setDone(false); setQs([]); setTopic(""); setAnswers([]); resetQuestionState(); setScore(0); };

  return (
    <div className="flex flex-col min-h-screen w-full px-4 lg:pl-28 lg:pr-4">
      <div className="w-full max-w-4xl mx-auto p-4 pt-8 pb-24 my-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to='/'
              className="p-2 rounded-xl bg-stone-950 border border-zinc-800 hover:bg-stone-900 transition-colors"
              aria-label={t.common.back}>
              <svg viewBox="0 0 24 24" className="size-5 text-stone-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">{t.quiz.title}</h1>
          </div>
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/20 to-blue-500/20 border border-sky-500/30 text-sky-300 text-xs font-medium">
            {t.common.beta}
          </div>
        </div>

        {qs.length === 0 && !connecting && !done && (
          <TopicBar
            value={topic}
            onChange={setTopic}
            onStart={() => start(topic)}
            t={t}
          />
        )}

        {connecting && (
          <div className="mt-10"><LoadingIndicator label={t.quiz.building} /></div>
        )}

        {qs.length > 0 && !done && q && (
          <>
            <QuizHeader topic={topic || t.quiz.title} idx={idx} total={total} score={score} t={t} />
            <QuestionCard
              q={q}
              selected={selected}
              showExp={showExp}
              showHint={showHint}
              onSelect={onSelect}
              onHint={() => setShowHint(true)}
              onNext={onNext}
              isLast={idx === total - 1}
              t={t}
            />
          </>
        )}

        {done && (
          <ResultsPanel
            score={score}
            total={total}
            percentage={percentage}
            visual={resultVisual}
            answers={answers}
            onRetake={() => { resetQuestionState(); setScore(0); setDone(false); setAnswers([]); }}
            onReview={() => setReviewOpen(true)}
            onNewTopic={newTopic}
            t={t}
          />
        )}

        {reviewOpen && (
          <ReviewModal answers={answers} onClose={() => setReviewOpen(false)} t={t} />
        )}
      </div>
    </div>
  );
}

function TopicBar({ value, onChange, onStart, t }: any) {
  return (
    <div className="bg-stone-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
      <h2 className="text-lg font-medium text-white mb-4">{t.quiz.newTopic}</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.landing.promptPlaceholder}
          className="flex-1 bg-stone-950 border border-zinc-900 rounded-xl px-4 py-2 text-white outline-none focus:border-sky-500 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && onStart()}
        />
        <button
          onClick={onStart}
          className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl transition-colors"
        >
          {t.common.send}
        </button>
      </div>
    </div>
  );
}

function QuizHeader({ topic, idx, total, score, t }: any) {
  const prog = ((idx + 1) / total) * 100;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">{topic}</span>
        <span className="text-xs font-bold text-stone-500">{t.quiz.score}: {score}/{total}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-stone-900 rounded-full overflow-hidden border border-zinc-800">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${prog}%` }} />
        </div>
        <span className="text-xs font-bold text-white whitespace-nowrap">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function QuestionCard({ q, selected, showExp, showHint, onSelect, onHint, onNext, isLast, t }: any) {
  return (
    <div className="bg-stone-950/80 border border-zinc-900 rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl md:text-2xl font-semibold text-white mb-8 leading-relaxed">
        {q.question}
      </h2>

      <div className="grid grid-cols-1 gap-3 mb-8">
        {q.options.map((opt: string, i: number) => {
          let cls = "w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 flex items-center gap-4 group ";
          if (showExp) {
            if (i === q.correct) cls += "bg-green-500/10 border-green-500/50 text-green-200";
            else if (i === selected) cls += "bg-red-500/10 border-red-500/50 text-red-200";
            else cls += "bg-stone-900/30 border-zinc-900 text-stone-500";
          } else if (selected === i) {
            cls += "bg-sky-500/10 border-sky-500 text-white ring-1 ring-sky-500/50";
          } else {
            cls += "bg-stone-900/50 border-zinc-800 text-stone-300 hover:border-zinc-700 hover:bg-stone-900/80";
          }

          return (
            <button key={i} onClick={() => onSelect(i)} className={cls} disabled={showExp}>
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border ${selected === i ? 'bg-sky-500 border-sky-400 text-white' : 'bg-stone-950 border-zinc-800 text-stone-500 group-hover:border-zinc-600 group-hover:text-stone-300'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 font-medium">{opt}</span>
              {showExp && i === q.correct && <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 text-green-500"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4.004-5.504Z" clipRule="evenodd" /></svg>}
              {showExp && i === selected && i !== q.correct && <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 text-red-500"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" /></svg>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        {!showExp && (
          <button onClick={onHint} className="text-stone-500 hover:text-sky-400 text-sm font-medium transition-colors flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4"><path d="M10 1a6 6 0 0 0-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 0 0 .572.729 6.016 6.016 0 0 0 2.856 0A.75.75 0 0 0 12 15.1v-.644c0-1.013.763-1.957 1.815-2.825A6 6 0 0 0 10 1ZM8.863 17.414a.75.75 0 0 0-.226 1.483 9.066 9.066 0 0 0 2.726 0 .75.75 0 0 0-.226-1.483 7.553 7.553 0 0 1-2.274 0Z" /></svg>
            {t.quiz.review}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onNext}
          disabled={selected === null}
          className={`px-8 py-3 rounded-2xl font-bold transition-all ${selected !== null ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20' : 'bg-stone-900 text-zinc-600 border border-zinc-800'}`}
        >
          {isLast ? t.quiz.finish : t.quiz.next}
        </button>
      </div>

      {showHint && !showExp && (
        <div className="mt-6 p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 text-sky-200 text-sm animate-in fade-in slide-in-from-top-2">
          <span className="font-bold mr-2 text-sky-400">Hint:</span> {q.hint}
        </div>
      )}

      {showExp && (
        <div className="mt-6 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-stone-300 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="font-bold mb-2 text-white flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-sky-400"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
            Explanation
          </div>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function ResultsPanel({ score, total, percentage, visual, answers, onRetake, onReview, onNewTopic, t }: any) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className={`p-8 rounded-3xl mb-8 ${visual.cls} animate-in fade-in zoom-in-95 duration-500`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-4xl">{visual.icon}</span>
          <h2 className="text-2xl font-bold">{t.quiz.results}</h2>
        </div>
        <p className="text-xl mb-6 opacity-90">{visual.msg}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{t.quiz.score}</div>
            <div className="text-3xl font-bold">{percentage}%</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{t.quiz.results}</div>
            <div className="text-3xl font-bold">{score}/{total}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={onReview} className="flex-1 min-w-[140px] py-4 bg-stone-900 border border-zinc-800 hover:bg-stone-800 text-white font-bold rounded-2xl transition-all">
          {t.quiz.review}
        </button>
        <button onClick={onRetake} className="flex-1 min-w-[140px] py-4 bg-stone-900 border border-zinc-800 hover:bg-stone-800 text-white font-bold rounded-2xl transition-all">
          {t.quiz.retake}
        </button>
        <button onClick={onNewTopic} className="w-full py-5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-sky-900/20">
          {t.quiz.newTopic}
        </button>
      </div>
    </div>
  );
}

function ReviewModal({ answers, onClose, t }: any) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-stone-950 border border-zinc-900 rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-stone-900/30">
          <h3 className="text-xl font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis mr-4">{t.quiz.review}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {answers.map((a: UA, i: number) => (
            <div key={i} className="border-b border-zinc-900 pb-8 last:border-0 last:pb-0">
              <div className="flex items-start gap-4 mb-4">
                <span className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${a.correct ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {i + 1}
                </span>
                <p className="text-white font-medium text-lg leading-relaxed">{a.question}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-2xl bg-stone-900/50 border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-stone-500 tracking-widest mb-1">Your Answer</div>
                  <div className={`text-sm ${a.correct ? 'text-green-400' : 'text-red-400'}`}>{a.selectedOption}</div>
                </div>
                {!a.correct && (
                  <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/20">
                    <div className="text-[10px] uppercase font-bold text-green-500/60 tracking-widest mb-1">Correct Answer</div>
                    <div className="text-sm text-green-400">{a.correctOption}</div>
                  </div>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10">
                <div className="text-[10px] uppercase font-bold text-sky-500/60 tracking-widest mb-1">Explanation</div>
                <div className="text-sm text-sky-200/80 leading-relaxed">{a.explanation}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function takeQuizArray(q: any): Question[] {
  if (Array.isArray(q)) return q;
  if (q && typeof q === 'object') {
    if (Array.isArray(q.questions)) return q.questions;
    if (Array.isArray(q.quiz)) return takeQuizArray(q.quiz);
  }
  return [];
}