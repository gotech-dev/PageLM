import { useEffect, useState } from "react";
import { useLanguage } from "../lib/LanguageContext";
import { CREDITS_INSUFFICIENT_EVENT } from "../lib/api";

export default function OutOfCreditsModal() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onInsufficient = () => setOpen(true);
    if (typeof window !== "undefined") {
      window.addEventListener(CREDITS_INSUFFICIENT_EVENT, onInsufficient as EventListener);
      return () => window.removeEventListener(CREDITS_INSUFFICIENT_EVENT, onInsufficient as EventListener);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="max-w-md w-full bg-stone-950 border border-red-900/70 rounded-3xl shadow-2xl p-6 text-stone-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-full bg-red-900/40 text-red-200 p-2">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v3.75m0 3.75h.007v.007H12v-.007Zm0-15a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
            </svg>
          </div>
          <div className="text-lg font-semibold text-red-100">{t.chat.outOfCreditsTitle}</div>
        </div>
        <p className="text-sm text-stone-300 leading-6 mb-5">{t.chat.outOfCredits}</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 transition-colors">
            {t.common.back}
          </button>
        </div>
      </div>
    </div>
  );
}
