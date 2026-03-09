import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface CheckoutTimerProps {
  minutes: number;
  lang: string;
}

export function CheckoutTimer({ minutes, lang }: CheckoutTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (secondsLeft <= 0) return null;

  const isEn = lang === "en";

  return (
    <div className="w-full bg-destructive/90 text-white py-3 px-4 flex items-center justify-center gap-3 rounded-t-2xl">
      <Timer className="w-5 h-5 animate-pulse" />
      <div className="flex items-center gap-1 font-mono text-lg font-bold tracking-wider">
        <span>{pad(hrs)}</span>
        <span className="animate-pulse">:</span>
        <span>{pad(mins)}</span>
        <span className="animate-pulse">:</span>
        <span>{pad(secs)}</span>
      </div>
      <span className="text-sm font-medium">
        {isEn ? "Hurry, time is running out!" : "Corre, o tempo esta a acabar!"}
      </span>
    </div>
  );
}
