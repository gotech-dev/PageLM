import { useState } from "react";
import { useLanguage } from "../../lib/LanguageContext";

export default function PromptRail({ onSend }: { onSend?: (prompt: string) => void }) {
  const { t } = useLanguage();
  const PROMPTS = t.landing.suggestedPrompts || [];
  const [busy] = useState(false);

  if (PROMPTS.length === 0) return null;

  return (
    <div className="flex items-center w-full h-full px-4 overflow-hidden group">
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-2 scroll-smooth">
        {PROMPTS.map((p: string, i: number) => (
          <button
            key={i}
            onClick={() => {
              if (onSend) onSend(p);
            }}
            disabled={busy}
            className="whitespace-nowrap px-4 py-1.5 rounded-full bg-stone-900/50 border border-stone-800 hover:border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs transition-all duration-300 active:scale-95 flex-shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Decorative gradient for overflow indication */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-stone-950 to-transparent pointer-events-none" />
    </div>
  );
}