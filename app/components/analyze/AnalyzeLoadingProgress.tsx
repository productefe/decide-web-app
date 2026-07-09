"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, Search, Star, Sparkles } from "lucide-react";

const STEP_MS = 3000;

type Step = {
  label: string;
  icon: LucideIcon;
};

type Props = {
  steps: Step[];
};

export function AnalyzeLoadingProgress({ steps }: Props) {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    setCompletedCount(0);
    const timers = steps.map((_, i) =>
      window.setTimeout(() => setCompletedCount(i + 1), (i + 1) * STEP_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  const progress = Math.min(completedCount / steps.length, 1);
  const isComplete = completedCount >= steps.length;
  const size = 72;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative mx-auto w-full max-w-sm py-1 text-center">
      <div
        className="pointer-events-none absolute -top-2 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl"
        aria-hidden
      />

      <p className="relative mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-4 py-1.5 text-xs font-semibold text-secondary shadow-sm">
        <span className="size-1.5 animate-pulse rounded-full bg-secondary" aria-hidden />
        Analiz sürüyor
      </p>

      <div className="relative mx-auto mb-4 size-16" aria-hidden>
        <svg width={size} height={size} className="block rotate-[-90deg] mx-auto">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="color-mix(in srgb, var(--secondary) 12%, transparent)"
            stroke="color-mix(in srgb, var(--secondary) 25%, transparent)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill={isComplete ? "var(--secondary)" : "transparent"}
            stroke="var(--secondary)"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={isComplete ? 0 : dashOffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset,fill] duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Sparkles
            className={`size-6 transition-colors duration-500 ${isComplete ? "text-secondary-foreground" : "text-secondary"}`}
            aria-hidden
          />
        </span>
      </div>

      <h2 className="relative text-lg font-semibold text-foreground sm:text-xl">Bakıyoruz...</h2>
      <p className="relative mt-1 text-sm text-muted-foreground">Bu birkaç saniye sürebilir</p>

      <div className="relative mt-4 grid gap-1.5 text-left">
        {steps.map(({ label, icon: Icon }, i) => {
          const done = i < completedCount;
          const active = i === completedCount && !isComplete;
          return (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all duration-500 ${
                done
                  ? "bg-secondary/15 border-secondary/40 text-secondary font-medium shadow-sm"
                  : active
                    ? "bg-gradient-to-r from-card to-secondary/[0.06] border-secondary/30 ring-1 ring-secondary/10"
                    : "bg-muted/80 border-border text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  done
                    ? "bg-secondary/20 text-secondary"
                    : active
                      ? "bg-secondary/15 text-secondary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="leading-snug">{label}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export const DEFAULT_LOADING_STEPS: Step[] = [
  { label: "Parçalar bulunuyor", icon: Eye },
  { label: "Mağazaları tarıyoruz", icon: Search },
  { label: "En iyi eşleşmeleri seçiyoruz", icon: Star },
  { label: "Sonuçları hazırlıyoruz", icon: Sparkles },
];
