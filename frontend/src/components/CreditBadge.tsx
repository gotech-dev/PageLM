import { useEffect, useState } from "react";
import { getCurrentUser, isLoggedIn, CREDITS_EVENT, updateCachedCredits } from "../lib/api";

export function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    getCurrentUser()
      .then((res) => {
        if (res?.user?.credits !== undefined && res?.user?.credits !== null) {
          const val = Number(res.user.credits);
          setCredits(val);
          updateCachedCredits(val);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onCredits = (ev: Event) => {
      const detail = (ev as CustomEvent<number>).detail;
      const val = Number(detail);
      if (!Number.isFinite(val)) return;
      setCredits(val);
    };
    if (typeof window !== "undefined") {
      window.addEventListener(CREDITS_EVENT, onCredits as EventListener);
      return () => window.removeEventListener(CREDITS_EVENT, onCredits as EventListener);
    }
  }, []);

  if (!isLoggedIn() || credits === null) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50">
      <div className="flex items-center gap-2 bg-white text-emerald-700 font-semibold px-4 py-2 rounded-full shadow-lg border border-emerald-100">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700">
          $
        </span>
        <span className="tabular-nums tracking-tight">{credits.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
