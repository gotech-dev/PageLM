import { useEffect, useState } from "react";
import { getCurrentUser, isLoggedIn } from "../lib/api";

export function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    getCurrentUser()
      .then((res) => {
        if (res?.user?.credits !== undefined && res?.user?.credits !== null) {
          setCredits(Number(res.user.credits));
          // keep localStorage user in sync if present
          const stored = localStorage.getItem("user");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              parsed.credits = res.user.credits;
              localStorage.setItem("user", JSON.stringify(parsed));
            } catch { /* ignore */ }
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!isLoggedIn() || credits === null) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-white text-emerald-700 font-semibold px-4 py-2 rounded-full shadow-lg border border-emerald-100">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700">
          $
        </span>
        <span className="tabular-nums tracking-tight">{credits.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
