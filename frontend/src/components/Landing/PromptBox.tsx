import React from "react";
import { useLanguage } from "../../lib/LanguageContext";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onPickFile: () => void;
  onRemoveFile: () => void;
  stagedFileName: string | null;
  busy?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

export default function PromptBox({
  value,
  onChange,
  onSend,
  onPickFile,
  onRemoveFile,
  stagedFileName,
  busy,
  onDragOver,
  onDrop,
}: Props) {
  const { t } = useLanguage();

  return (
    <div
      className="rounded-t-3xl bg-stone-950 border border-stone-900 shadow-[inset_0_3px_15px] shadow-stone-900/50 flex items-start group"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex-1 p-4">
        {stagedFileName && (
          <div className="mb-4 inline-flex items-center gap-3 bg-stone-900/40 border border-stone-800 rounded-2xl px-3 py-2 max-w-full backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6 text-rose-500/60" fill="currentColor">
                <path d="M9 2a1 1 0 0 0-1 1v4H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9Zm5 5H10V4h4v3Z" />
              </svg>
            </div>
            <div className="flex flex-col -space-y-0.5 min-w-0 flex-1">
              <span className="text-stone-200 text-sm truncate max-w-[300px]" title={stagedFileName}>{stagedFileName}</span>
              <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">{t.landing.attached}</span>
            </div>
            <button onClick={onRemoveFile} className="flex-shrink-0 text-stone-500 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition-all" aria-label={t.common.remove}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          rows={1}
          placeholder={t.landing.promptPlaceholder}
          className="w-full text-stone-100 bg-transparent rounded-2xl p-2 outline-none resize-none leading-relaxed min-h-[50px] placeholder:text-stone-600 transition-all focus:placeholder:text-stone-700"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          aria-label="Main prompt"
        />
      </div>

      <div className="h-full w-fit p-3.5 flex flex-col space-y-3">
        <button
          className="rounded-full bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-white transition-all p-2.5 shadow-lg active:scale-95"
          aria-label={t.landing.addFiles}
          onClick={onPickFile}
          disabled={busy}
          title={stagedFileName ?? t.landing.addFiles}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path
              fillRule="evenodd"
              d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm3.75-2.75a.75.75 0 0 0 1.5 0V9.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0l-3.25 3.5a.75.75 0 0 0 1.1 1.02l1.95-2.1v4.59Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          onClick={onSend}
          disabled={busy || !value.trim()}
          className="rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all p-2.5 disabled:opacity-30 disabled:grayscale disabled:shadow-none active:scale-95"
          aria-label={t.common.send}
          title={busy ? t.common.pleaseWait : t.common.send}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}