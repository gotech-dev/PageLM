import { useState, useEffect } from "react";
import { useLanguage } from "../../lib/LanguageContext";

export default function FocusTimer() {
    const { t } = useLanguage();
    const [minutes, setMinutes] = useState(25);
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<"focus" | "short" | "long">("focus");

    useEffect(() => {
        let interval: any;

        if (isActive) {
            interval = setInterval(() => {
                if (seconds === 0) {
                    if (minutes === 0) {
                        clearInterval(interval);
                        setIsActive(false);
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification(t.planner.focusTimer.sessionComplete);
                        }
                    } else {
                        setMinutes(minutes - 1);
                        setSeconds(59);
                    }
                } else {
                    setSeconds(seconds - 1);
                }
            }, 1000);
        } else {
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, [isActive, minutes, seconds]);

    const toggleTimer = () => {
        setIsActive(!isActive);
    };

    const resetTimer = (newMode: "focus" | "short" | "long" = mode) => {
        setIsActive(false);
        setMode(newMode);
        if (newMode === "focus") setMinutes(25);
        else if (newMode === "short") setMinutes(5);
        else setMinutes(15);
        setSeconds(0);
    };

    const totalSeconds = mode === "focus" ? 25 * 60 : mode === "short" ? 5 * 60 : 15 * 60;
    const currentSeconds = minutes * 60 + seconds;
    const progress = ((totalSeconds - currentSeconds) / totalSeconds) * 100;

    // SVG Circle Props
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * progress) / 100;

    return (
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center relative overflow-hidden">

            <div className="relative w-64 h-64 mb-6 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="50%" cy="50%" r={radius}
                        className="stroke-zinc-800 fill-none"
                        strokeWidth="8"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="50%" cy="50%" r={radius}
                        className={`fill-none transition-all duration-1000 ease-linear ${isActive ? 'stroke-emerald-500' : 'stroke-zinc-600'}`}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={-strokeDashoffset} // Negative for clockwise fill or check direction
                    />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl font-mono text-stone-200 font-light tracking-tighter">
                        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                    </div>
                    <div className="text-xs text-stone-500 mt-2 flex gap-2">
                        <button onClick={() => resetTimer("focus")} className={`hover:text-stone-300 ${mode === 'focus' ? 'text-emerald-400 font-bold' : ''}`}>{t.planner.focusTimer.pomodoro}</button>
                        <span>/</span>
                        <button onClick={() => resetTimer("short")} className={`hover:text-stone-300 ${mode === 'short' ? 'text-emerald-400 font-bold' : ''}`}>{t.planner.focusTimer.shortBreak}</button>
                        <span>/</span>
                        <button onClick={() => resetTimer("long")} className={`hover:text-stone-300 ${mode === 'long' ? 'text-emerald-400 font-bold' : ''}`}>{t.planner.focusTimer.longBreak}</button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={toggleTimer}
                    className={`px-8 py-2 rounded-full font-medium transition-all border ${isActive
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/50 hover:bg-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20"
                        }`}
                >
                    {isActive ? t.planner.focusTimer.pause : t.planner.focusTimer.start}
                </button>

                <button
                    onClick={() => resetTimer()}
                    className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    title={t.planner.focusTimer.reset}
                >
                    ↺
                </button>
            </div>

            <div className="absolute top-4 left-4 flex gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </div>
        </div>
    );
}
